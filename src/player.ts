import type { AudioDriver, AudioSource } from "./driver/audio/types";
import type { Segment } from "./segment";
import type { PeaksInstance } from "./types";
import { isValidTime } from "./utils";

export interface PlayerFromOptions {
	readonly peaks: PeaksInstance;
	readonly driver: AudioDriver;
}

export class Player {
	private constructor(
		private readonly peaks: PeaksInstance,
		readonly driver: AudioDriver,
	) {}

	static from(options: PlayerFromOptions): Player {
		return new Player(options.peaks, options.driver);
	}

	init(): Promise<void> {
		return this.driver.init({ events: this.peaks.events });
	}

	dispose(): void {
		this.driver.dispose();
	}

	play(): Promise<void> {
		return this.driver.play();
	}

	pause(): void {
		this.driver.pause();
	}

	isPlaying(): boolean {
		return this.driver.isPlaying();
	}

	isSeeking(): boolean {
		return this.driver.isSeeking();
	}

	getCurrentTime(): number {
		return this.driver.getCurrentTime();
	}

	getDuration(): number {
		return this.driver.getDuration();
	}

	seek(time: number): void {
		if (!isValidTime(time)) {
			this.peaks?.logger(
				"peaks.player.seek(): parameter must be a valid time, in seconds",
			);
			return;
		}

		this.driver.seek(time);
	}

	playSegment(segment: Segment, loop: boolean = false): Promise<void> {
		if (
			!segment ||
			!isValidTime(segment.startTime) ||
			!isValidTime(segment.endTime)
		) {
			return Promise.reject(
				new Error(
					"peaks.player.playSegment(): parameter must be a segment object",
				),
			);
		}

		return this.driver.playSegment({ loop, segment });
	}

	/**
	 * Plays the entire current source on a loop. The looped span runs from
	 * `0` to {@link Player.getDuration} and never inserts a real segment
	 * into the segment store.
	 */
	playLooped(): Promise<void> {
		const duration = this.driver.getDuration();
		if (!isValidTime(duration) || duration <= 0) {
			return Promise.reject(
				new Error("peaks.player.playLooped(): source has no positive duration"),
			);
		}

		const transient = {
			editable: false,
			endTime: duration,
			id: "__peaks_loop_file__",
			labelText: "",
			startTime: 0,
		} as unknown as Segment;

		return this.driver.playSegment({ loop: true, segment: transient });
	}

	setSource(options: AudioSource): Promise<void> {
		return this.driver.setSource(options);
	}

	/**
	 * Updates the active loop's bounds in place. Drivers that natively
	 * loop (e.g. `ClipNode`) update their loop boundary properties and
	 * playback continues without a restart. Polling-based drivers read
	 * the segment reference each tick, so they pick up new bounds
	 * automatically — for those drivers this method is a no-op.
	 */
	setLoopBounds(startTime: number, endTime: number): void {
		this.driver.setLoopBounds?.(startTime, endTime);
	}

	/**
	 * Enables or disables looping on the underlying playback node without
	 * changing playback state. The loop controller calls this in `stop()`
	 * so a subsequent `play()` does not reuse the previous loop config.
	 * No-op for drivers that loop via segment polling.
	 */
	setLooped(loop: boolean): void {
		this.driver.setLooped?.(loop);
	}
}
