import type { ClipNodeState } from "@jadujoel/web-audio-clip-node";
import {
	ClipNode,
	getProcessorBlobUrl,
	StreamingClipNode,
} from "@jadujoel/web-audio-clip-node";
import type { Segment } from "./segment";
import type { PeaksInstance, PlayerAdapter, SetSourceOptions } from "./types";

export interface ClipNodePlayerOptions {
	readonly audioContext: AudioContext;
	readonly audioBuffer?: AudioBuffer;
	readonly url?: string;
	/** Override the worklet processor module URL. Defaults to an embedded blob URL. */
	readonly processorUrl?: string;
}

export const PLAYING_STATES: ReadonlySet<ClipNodeState> = new Set([
	"started",
	"resumed",
]);

export const STARTABLE_STATES: ReadonlySet<ClipNodeState> = new Set([
	"initial",
	"stopped",
	"ended",
]);

const moduleLoads = new WeakMap<BaseAudioContext, Promise<void>>();

export function ensureWorkletModule(
	audioContext: BaseAudioContext,
	processorUrl: string | undefined,
): Promise<void> {
	const existing = moduleLoads.get(audioContext);
	if (existing) {
		return existing;
	}
	const url = processorUrl ?? getProcessorBlobUrl();
	const promise = audioContext.audioWorklet.addModule(url);
	moduleLoads.set(audioContext, promise);
	return promise;
}

export interface ClipNodePlayerFromOptions {
	readonly options: ClipNodePlayerOptions;
}

export class ClipNodePlayer implements PlayerAdapter {
	private readonly audioContext: AudioContext;
	private readonly processorUrl: string | undefined;
	private eventEmitter: PeaksInstance | undefined;
	private node: ClipNode | undefined;
	private audioBuffer: AudioBuffer | undefined;
	private url: string | undefined;
	private mediaDuration: number;

	static from(options: ClipNodePlayerFromOptions): ClipNodePlayer {
		return new ClipNodePlayer(options.options);
	}

	private constructor(options: ClipNodePlayerOptions) {
		this.audioContext = options.audioContext;
		this.audioBuffer = options.audioBuffer;
		this.url = options.url;
		this.processorUrl = options.processorUrl;
		this.eventEmitter = undefined;
		this.node = undefined;
		this.mediaDuration = options.audioBuffer?.duration ?? 0;
	}

	async init(eventEmitter: PeaksInstance): Promise<void> {
		this.eventEmitter = eventEmitter;
		await ensureWorkletModule(this.audioContext, this.processorUrl);
		this.createNode();
	}

	dispose(): void {
		this.disposeNode();
		this.eventEmitter = undefined;
	}

	play(): Promise<void> {
		const node = this.node;
		if (!node) {
			return Promise.reject(new Error("ClipNodePlayer not initialized"));
		}

		return this.audioContext.resume().then(() => {
			if (node.state === "paused") {
				node.resume();
			} else if (STARTABLE_STATES.has(node.state)) {
				node.start();
			}
		});
	}

	pause(): void {
		const node = this.node;
		if (!node) {
			return;
		}
		if (PLAYING_STATES.has(node.state)) {
			node.pause();
		}
	}

	isPlaying(): boolean {
		const node = this.node;
		if (!node) {
			return false;
		}
		return PLAYING_STATES.has(node.state);
	}

	isSeeking(): boolean {
		return this.node?.seeking ?? false;
	}

	getCurrentTime(): number {
		return this.node?.currentTime ?? 0;
	}

	getDuration(): number {
		const nodeDuration = this.node?.duration;
		if (typeof nodeDuration === "number" && nodeDuration > 0) {
			return nodeDuration;
		}
		return this.mediaDuration;
	}

	seek(time: number): void {
		if (this.node) {
			this.node.currentTime = time;
		}
	}

	playSegment(segment: Segment, loop: boolean): Promise<void> {
		const node = this.node;
		if (!node) {
			return Promise.reject(new Error("ClipNodePlayer not initialized"));
		}

		return this.audioContext.resume().then(() => {
			if (
				PLAYING_STATES.has(node.state) ||
				node.state === "paused" ||
				node.state === "scheduled"
			) {
				node.stop();
			}
			node.loop = loop;
			node.loopStart = segment.startTime;
			node.loopEnd = segment.endTime;
			const segmentDuration = segment.endTime - segment.startTime;
			if (loop) {
				node.start(undefined, segment.startTime);
			} else {
				node.start(undefined, segment.startTime, segmentDuration);
			}
		});
	}

	async setSource(options: SetSourceOptions): Promise<void> {
		this.disposeNode();

		this.audioBuffer = options.webAudio?.audioBuffer;
		this.url = options.mediaUrl;
		this.mediaDuration = this.audioBuffer?.duration ?? 0;

		await ensureWorkletModule(this.audioContext, this.processorUrl);
		this.createNode();
	}

	private createNode(): void {
		const node = this.isStreamingSource()
			? this.createStreamingNode()
			: new ClipNode(this.audioContext);

		this.node = node;
		this.wireEvents(node);
		node.connect(this.audioContext.destination);

		if (node instanceof StreamingClipNode) {
			if (this.url !== undefined) {
				node.url = this.url;
			}
		} else if (this.audioBuffer) {
			node.buffer = this.audioBuffer;
			this.mediaDuration = this.audioBuffer.duration;
			this.eventEmitter?.emit("player.canplay");
		}
	}

	private isStreamingSource(): boolean {
		return this.url !== undefined && this.audioBuffer === undefined;
	}

	private createStreamingNode(): StreamingClipNode {
		return new StreamingClipNode(this.audioContext, undefined, {
			defaultFormat: null,
			targetSampleRate: this.audioContext.sampleRate,
		});
	}

	private wireEvents(node: ClipNode): void {
		const emitter = this.eventEmitter;
		if (!emitter) {
			return;
		}

		node.onstarted = () => {
			emitter.emit("player.playing", this.getCurrentTime());
		};
		node.onresumed = () => {
			emitter.emit("player.playing", this.getCurrentTime());
		};
		node.onpaused = () => {
			emitter.emit("player.pause", this.getCurrentTime());
		};
		node.onended = () => {
			emitter.emit("player.ended");
		};
		node.onlooped = () => {
			emitter.emit("player.looped");
		};
		node.onseeked = () => {
			emitter.emit("player.seeked", this.getCurrentTime());
		};
		node.ontimeupdate = (time: number) => {
			emitter.emit("player.timeupdate", time);
		};
		node.ondurationchange = (duration: number) => {
			this.mediaDuration = duration;
		};

		if (node instanceof StreamingClipNode) {
			node.oncanplay = () => {
				emitter.emit("player.canplay");
			};
			node.onerror = (error) => {
				emitter.emit("player.error", error);
			};
		}
	}

	private disposeNode(): void {
		if (!this.node) {
			return;
		}
		try {
			this.node.disconnect();
		} catch {
			// already disconnected
		}
		this.node.dispose();
		this.node = undefined;
	}
}
