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

export class ClipNodePlayer implements PlayerAdapter {
	private readonly _audioContext: AudioContext;
	private readonly _processorUrl: string | undefined;
	private _eventEmitter: PeaksInstance | null;
	private _node: ClipNode | null;
	private _audioBuffer: AudioBuffer | undefined;
	private _url: string | undefined;
	private _duration: number;

	constructor(options: ClipNodePlayerOptions) {
		this._audioContext = options.audioContext;
		this._audioBuffer = options.audioBuffer;
		this._url = options.url;
		this._processorUrl = options.processorUrl;
		this._eventEmitter = null;
		this._node = null;
		this._duration = options.audioBuffer?.duration ?? 0;
	}

	async init(eventEmitter: PeaksInstance): Promise<void> {
		this._eventEmitter = eventEmitter;
		await ensureWorkletModule(this._audioContext, this._processorUrl);
		this._createNode();
	}

	destroy(): void {
		this._disposeNode();
		this._eventEmitter = null;
	}

	play(): Promise<void> {
		const node = this._node;
		if (!node) {
			return Promise.reject(new Error("ClipNodePlayer not initialized"));
		}

		return this._audioContext.resume().then(() => {
			if (node.state === "paused") {
				node.resume();
			} else if (STARTABLE_STATES.has(node.state)) {
				node.start();
			}
		});
	}

	pause(): void {
		const node = this._node;
		if (!node) {
			return;
		}
		if (PLAYING_STATES.has(node.state)) {
			node.pause();
		}
	}

	isPlaying(): boolean {
		const node = this._node;
		if (!node) {
			return false;
		}
		return PLAYING_STATES.has(node.state);
	}

	isSeeking(): boolean {
		return this._node?.seeking ?? false;
	}

	getCurrentTime(): number {
		return this._node?.currentTime ?? 0;
	}

	getDuration(): number {
		const nodeDuration = this._node?.duration;
		if (typeof nodeDuration === "number" && nodeDuration > 0) {
			return nodeDuration;
		}
		return this._duration;
	}

	seek(time: number): void {
		if (this._node) {
			this._node.currentTime = time;
		}
	}

	playSegment(segment: Segment, loop: boolean): Promise<void> {
		const node = this._node;
		if (!node) {
			return Promise.reject(new Error("ClipNodePlayer not initialized"));
		}

		return this._audioContext.resume().then(() => {
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
		this._disposeNode();

		this._audioBuffer = options.webAudio?.audioBuffer;
		this._url = options.mediaUrl;
		this._duration = this._audioBuffer?.duration ?? 0;

		await ensureWorkletModule(this._audioContext, this._processorUrl);
		this._createNode();
	}

	private _createNode(): void {
		const node = this._isStreamingSource()
			? this._createStreamingNode()
			: new ClipNode(this._audioContext);

		this._node = node;
		this._wireEvents(node);
		node.connect(this._audioContext.destination);

		if (node instanceof StreamingClipNode) {
			if (this._url !== undefined) {
				node.url = this._url;
			}
		} else if (this._audioBuffer) {
			node.buffer = this._audioBuffer;
			this._duration = this._audioBuffer.duration;
			this._eventEmitter?.emit("player.canplay");
		}
	}

	private _isStreamingSource(): boolean {
		return this._url !== undefined && this._audioBuffer === undefined;
	}

	private _createStreamingNode(): StreamingClipNode {
		return new StreamingClipNode(this._audioContext, undefined, {
			defaultFormat: null,
			targetSampleRate: this._audioContext.sampleRate,
		});
	}

	private _wireEvents(node: ClipNode): void {
		const emitter = this._eventEmitter;
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
			this._duration = duration;
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

	private _disposeNode(): void {
		if (!this._node) {
			return;
		}
		try {
			this._node.disconnect();
		} catch {
			// already disconnected
		}
		this._node.dispose();
		this._node = null;
	}
}
