import type { PeaksEvents } from "../../events";
import type { Segment } from "../../segment";

/**
 * Schedules a callback that should run on the next animation frame (or
 * a tick of equivalent granularity). Injected so tests can swap a fake
 * clock for `requestAnimationFrame`.
 */
export type FrameScheduler = (callback: () => void) => void;

const defaultScheduler: FrameScheduler = (callback) => {
	if (typeof globalThis.requestAnimationFrame === "function") {
		globalThis.requestAnimationFrame(callback);
	} else {
		setTimeout(callback, 16);
	}
};

export interface PollingSegmentPlayerFromOptions {
	readonly events: PeaksEvents;
	readonly isPlaying: () => boolean;
	readonly getCurrentTime: () => number;
	readonly seek: (time: number) => void;
	readonly pause: () => void;
	readonly play: () => Promise<void>;
	readonly schedule?: FrameScheduler;
}

/**
 * Polls playback time on the main thread to drive segment looping for
 * drivers that do not natively support it (e.g.
 * `MediaElementAudioDriver`). Extracted from the legacy `Player` so that
 * the Player itself remains free of timing logic and every driver
 * exposes the same uniform `playSegment` surface.
 */
export class PollingSegmentPlayer {
	private constructor(
		private readonly events: PeaksEvents,
		private readonly isPlaying: () => boolean,
		private readonly getCurrentTime: () => number,
		private readonly seekFn: (time: number) => void,
		private readonly pauseFn: () => void,
		private readonly playFn: () => Promise<void>,
		private readonly schedule: FrameScheduler,
		private playingSegment: boolean = false,
		private segment: Segment | undefined = undefined,
		private loop: boolean = false,
	) {}

	static from(options: PollingSegmentPlayerFromOptions): PollingSegmentPlayer {
		return new PollingSegmentPlayer(
			options.events,
			options.isPlaying,
			options.getCurrentTime,
			options.seek,
			options.pause,
			options.play,
			options.schedule ?? defaultScheduler,
		);
	}

	/**
	 * Begins playback of the supplied segment. Resolves once `play()`
	 * resolves; the boundary-checking loop runs on subsequent frames.
	 */
	start(segment: Segment, loop: boolean): Promise<void> {
		this.segment = segment;
		this.loop = loop;

		this.seekFn(segment.startTime);

		this.events.addEventListener("player.playing", this.onFirstPlaying, {
			once: true,
		});

		return this.playFn();
	}

	/**
	 * Cancels segment polling. Idempotent.
	 */
	stop(): void {
		this.playingSegment = false;
		this.segment = undefined;
		this.loop = false;
		this.events.removeEventListener("player.playing", this.onFirstPlaying);
	}

	private onFirstPlaying = (): void => {
		if (!this.playingSegment) {
			this.playingSegment = true;
			this.schedule(this.tick);
		}
	};

	private tick = (): void => {
		if (!this.playingSegment) {
			return;
		}

		if (!this.isPlaying()) {
			this.playingSegment = false;
			return;
		}

		if (this.segment && this.getCurrentTime() >= this.segment.endTime) {
			if (this.loop) {
				this.seekFn(this.segment.startTime);
				this.events.dispatch("player.looped", {});
			} else {
				this.pauseFn();
				this.events.dispatch("player.ended", {});
				this.playingSegment = false;
				return;
			}
		}

		this.schedule(this.tick);
	};
}
