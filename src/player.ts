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

	setSource(options: AudioSource): Promise<void> {
		return this.driver.setSource(options);
	}
}
