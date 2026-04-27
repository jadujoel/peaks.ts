import type { ClipNodeState } from "@jadujoel/web-audio-clip-node";
import {
	ClipNode,
	getProcessorBlobUrl,
	StreamingClipNode,
} from "@jadujoel/web-audio-clip-node";
import type { PeaksEvents } from "../../../events";
import type {
	AudioDriver,
	AudioDriverContext,
	AudioSource,
	PlaySegmentOptions,
} from "../types";

export interface ClipNodeAudioDriverFromUrlOptions<
	TURL extends string = string,
> {
	readonly context: AudioContext;
	readonly url: TURL;
	readonly duration?: number;
}

export interface ClipNodeAudioDriverFromBufferOptions {
	readonly context: AudioContext;
	readonly buffer: AudioBuffer;
	readonly duration?: number;
}

export type ClipNodeAudioDriverFromOptions =
	| ClipNodeAudioDriverFromUrlOptions
	| ClipNodeAudioDriverFromBufferOptions;

export const PLAYING_STATES: ReadonlySet<ClipNodeState> = new Set([
	"started",
	"resumed",
]);

const moduleLoads = new WeakMap<BaseAudioContext, Promise<void>>();

export function isUrlOptions<TURL extends string>(
	options: ClipNodeAudioDriverFromOptions,
): options is ClipNodeAudioDriverFromUrlOptions<TURL> {
	return "url" in options;
}

export function isBufferOptions(
	options: ClipNodeAudioDriverFromOptions,
): options is ClipNodeAudioDriverFromBufferOptions {
	return "buffer" in options;
}

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

export class ClipNodeAudioDriver implements AudioDriver {
	private constructor(
		private readonly context: AudioContext,
		private events: PeaksEvents | undefined,
		private buffer: AudioBuffer | undefined,
		private url: string | undefined,
		private duration: number,
		private node: ClipNode | undefined,
	) {}

	static from(options: ClipNodeAudioDriverFromOptions): ClipNodeAudioDriver {
		if (isUrlOptions(options)) {
			return new ClipNodeAudioDriver(
				options.context,
				undefined,
				undefined,
				options.url,
				options.duration ?? 0,
				undefined,
			);
		}
		return new ClipNodeAudioDriver(
			options.context,
			undefined,
			options.buffer,
			undefined,
			options.duration ?? options.buffer?.duration ?? 0,
			undefined,
		);
	}

	async init(ctx: AudioDriverContext): Promise<void> {
		this.events = ctx.events;
		await ensureWorkletModule(this.context);
		this.createNode();
	}

	dispose(): void {
		this.disposeNode();
	}

	play(): Promise<void> {
		const node = this.node;
		if (!node) {
			return Promise.reject(new Error("ClipNodeAudioDriver not initialized"));
		}

		return this.context.resume().then(() => {
			if (node.state === "paused") {
				node.resume();
				return;
			}
			node.start();
		});
	}

	pause(): void {
		const node = this.node;
		if (!node) {
			return;
		}
		node.pause();
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
		return this.node?.duration ?? this.duration;
	}

	seek(time: number): void {
		if (this.node) {
			this.node.currentTime = time;
		}
	}

	playSegment(options: PlaySegmentOptions): Promise<void> {
		const node = this.node;
		if (!node) {
			return Promise.reject(new Error("ClipNodeAudioDriver not initialized"));
		}

		const { segment, loop } = options;

		return this.context.resume().then(() => {
			node.stop();
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

	async setSource(source: AudioSource): Promise<void> {
		this.disposeNode();
		// Preserve existing buffer/url when the caller only updates side
		// options like `stereo`. This lets `peaks.setSource({ webAudio:
		// { stereo: true } })` work without re-passing the buffer.
		if (source.webAudio?.buffer !== undefined) {
			this.buffer = source.webAudio.buffer;
		}
		if (source.mediaUrl !== undefined) {
			this.url = source.mediaUrl;
		}
		this.duration = this.buffer?.duration ?? 0;
		await ensureWorkletModule(this.context);
		this.createNode();
	}

	getSource(): AudioSource | undefined {
		if (!this.buffer && this.url === undefined) {
			return undefined;
		}
		return {
			...(this.url !== undefined ? { mediaUrl: this.url } : {}),
			webAudio: {
				...(this.buffer !== undefined ? { buffer: this.buffer } : {}),
				context: this.context,
			},
		};
	}

	private createNode(): void {
		if (this.node) {
			return;
		}
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
		} else if (this.buffer) {
			node.buffer = this.buffer;
			this.duration = this.buffer.duration;
			this.events?.dispatch("player.canplay", {});
		}
	}

	private isStreamingSource(): boolean {
		return this.url !== undefined && this.buffer === undefined;
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
			this.duration = duration;
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
