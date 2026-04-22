import type { ClipNodeState } from "@jadujoel/web-audio-clip-node";
import {
	ClipNode,
	getProcessorBlobUrl,
	StreamingClipNode,
} from "@jadujoel/web-audio-clip-node";
import type { PeaksEvents } from "./events";
import type { Segment } from "./segment";
import type { PlayerAdapter, PlayerEventBus, SetSourceOptions } from "./types";

export interface ClipNodePlayerFromOptions {
	readonly context: AudioContext;
	readonly buffer?: AudioBuffer;
	readonly url?: string;
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

export function ensureWorkletModule(context: BaseAudioContext): Promise<void> {
	const existing = moduleLoads.get(context);
	if (existing) {
		return existing;
	}
	const url = getProcessorBlobUrl();
	const promise = context.audioWorklet.addModule(url);
	moduleLoads.set(context, promise);
	return promise;
}

export class ClipNodePlayer implements PlayerAdapter {
	private constructor(
		private readonly context: AudioContext,
		private audioBuffer: AudioBuffer | undefined,
		private url: string | undefined,
		private mediaDuration: number,
		private events: PeaksEvents | undefined,
		private node: ClipNode | undefined,
	) {}

	static from(options: ClipNodePlayerFromOptions): ClipNodePlayer {
		return new ClipNodePlayer(
			options.context,
			options.buffer,
			options.url,
			options.buffer?.duration ?? 0,
			undefined,
			undefined,
		);
	}

	async init(peaks: PlayerEventBus): Promise<void> {
		this.events = peaks.events;
		await ensureWorkletModule(this.context);
		this.createNode();
	}

	dispose(): void {
		this.disposeNode();
		this.events = undefined;
	}

	play(): Promise<void> {
		const node = this.node;
		if (!node) {
			return Promise.reject(new Error("ClipNodePlayer not initialized"));
		}

		return this.context.resume().then(() => {
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

		return this.context.resume().then(() => {
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

		await ensureWorkletModule(this.context);
		this.createNode();
	}

	private createNode(): void {
		const node = this.isStreamingSource()
			? this.createStreamingNode()
			: new ClipNode(this.context);

		this.node = node;
		this.wireEvents(node);
		node.connect(this.context.destination);

		if (node instanceof StreamingClipNode) {
			if (this.url !== undefined) {
				node.url = this.url;
			}
		} else if (this.audioBuffer) {
			node.buffer = this.audioBuffer;
			this.mediaDuration = this.audioBuffer.duration;
			this.events?.dispatch("player.canplay", {});
		}
	}

	private isStreamingSource(): boolean {
		return this.url !== undefined && this.audioBuffer === undefined;
	}

	private createStreamingNode(): StreamingClipNode {
		return new StreamingClipNode(this.context, undefined, {
			defaultFormat: null,
			targetSampleRate: this.context.sampleRate,
		});
	}

	private wireEvents(node: ClipNode): void {
		const events = this.events;
		if (!events) {
			return;
		}

		node.onstarted = () => {
			events.dispatch("player.playing", { time: this.getCurrentTime() });
		};
		node.onresumed = () => {
			events.dispatch("player.playing", { time: this.getCurrentTime() });
		};
		node.onpaused = () => {
			events.dispatch("player.pause", { time: this.getCurrentTime() });
		};
		node.onended = () => {
			events.dispatch("player.ended", {});
		};
		node.onlooped = () => {
			events.dispatch("player.looped", {});
		};
		node.onseeked = () => {
			events.dispatch("player.seeked", { time: this.getCurrentTime() });
		};
		node.ontimeupdate = (time: number) => {
			events.dispatch("player.timeupdate", { time });
		};
		node.ondurationchange = (duration: number) => {
			this.mediaDuration = duration;
		};

		if (node instanceof StreamingClipNode) {
			node.oncanplay = () => {
				events.dispatch("player.canplay", {});
			};
			node.onerror = (error) => {
				events.dispatch("player.error", { error });
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
