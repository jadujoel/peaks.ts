import type { PeaksEvents } from "../../../events";
import type {
	AudioDriver,
	AudioDriverContext,
	AudioSource,
	PlaySegmentOptions,
} from "../types";

export interface FakeAudioDriverEvent {
	readonly name: string;
	readonly time: number;
	readonly payload: unknown;
}

export interface FakeAudioDriverFromOptions {
	readonly duration?: number;
	readonly currentTime?: number;
}

/**
 * Deterministic, synchronous in-memory {@link AudioDriver} for unit
 * tests. Time only advances when {@link FakeAudioDriver.tick} is
 * called; segment loop boundaries are checked synchronously inside the
 * tick.
 */
export class FakeAudioDriver implements AudioDriver {
	private constructor(
		private currentTime: number,
		private duration: number,
		private playing: boolean = false,
		private seeking: boolean = false,
		private events: PeaksEvents | undefined = undefined,
		private segmentStart: number | undefined = undefined,
		private segmentEnd: number | undefined = undefined,
		private looping: boolean = false,
		public readonly log: FakeAudioDriverEvent[] = [],
	) {}

	static default(): FakeAudioDriver {
		return new FakeAudioDriver(0, 60);
	}

	static from(options: FakeAudioDriverFromOptions): FakeAudioDriver {
		return new FakeAudioDriver(
			options.currentTime ?? 0,
			options.duration ?? 60,
		);
	}

	init(ctx: AudioDriverContext): Promise<void> {
		this.events = ctx.events;
		return Promise.resolve();
	}

	dispose(): void {
		this.events = undefined;
		this.playing = false;
		this.segmentStart = undefined;
		this.segmentEnd = undefined;
	}

	play(): Promise<void> {
		this.playing = true;
		this.dispatch("player.playing", { time: this.currentTime });
		return Promise.resolve();
	}

	pause(): void {
		if (!this.playing) {
			return;
		}
		this.playing = false;
		this.dispatch("player.pause", { time: this.currentTime });
	}

	isPlaying(): boolean {
		return this.playing;
	}

	isSeeking(): boolean {
		return this.seeking;
	}

	getCurrentTime(): number {
		return this.currentTime;
	}

	getDuration(): number {
		return this.duration;
	}

	seek(time: number): void {
		this.seeking = true;
		this.currentTime = time;
		this.seeking = false;
		this.dispatch("player.seeked", { time });
	}

	playSegment(options: PlaySegmentOptions): Promise<void> {
		this.segmentStart = options.segment.startTime;
		this.segmentEnd = options.segment.endTime;
		this.looping = options.loop;
		this.seek(options.segment.startTime);
		return this.play();
	}

	setSource(source: AudioSource): Promise<void> {
		this.currentTime = 0;
		this.duration = source.webAudio?.audioBuffer?.duration ?? this.duration;
		this.dispatch("player.canplay", {});
		return Promise.resolve();
	}

	/**
	 * Advances the deterministic clock by `seconds` and synchronously
	 * dispatches segment loop boundary events.
	 */
	tick(seconds: number): void {
		if (!this.playing) {
			return;
		}
		this.currentTime += seconds;
		this.dispatch("player.timeupdate", { time: this.currentTime });

		const end = this.segmentEnd;
		if (end !== undefined && this.currentTime >= end) {
			if (this.looping && this.segmentStart !== undefined) {
				this.currentTime = this.segmentStart;
				this.dispatch("player.looped", {});
			} else {
				this.playing = false;
				this.dispatch("player.ended", {});
				this.segmentStart = undefined;
				this.segmentEnd = undefined;
			}
		}
	}

	private dispatch(name: string, payload: unknown): void {
		this.log.push({ name, payload, time: this.currentTime });
		// biome-ignore lint/suspicious/noExplicitAny: dispatch is name-keyed
		this.events?.dispatch(name as any, payload as any);
	}
}
