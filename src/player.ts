import type { Segment } from "./segment";
import type { PeaksInstance, PlayerAdapter, SetSourceOptions } from "./types";
import { isValidTime } from "./utils";

export function getAllPropertiesFrom(adapter: PlayerAdapter): string[] {
	const allProperties: string[] = [];
	let obj = adapter;

	while (obj) {
		for (const p of Object.getOwnPropertyNames(obj)) {
			allProperties.push(p);
		}

		obj = Object.getPrototypeOf(obj);
	}

	return allProperties;
}

/**
 * Validates that the supplied player adapter exposes the required public API.
 *
 * @throws {TypeError} If a required adapter method is missing or is not a function.
 */
export function validateAdapter(adapter: PlayerAdapter): undefined | never {
	const publicAdapterMethods = [
		"init",
		"destroy",
		"play",
		"pause",
		"isPlaying",
		"isSeeking",
		"getCurrentTime",
		"getDuration",
		"seek",
	];

	const allProperties = getAllPropertiesFrom(adapter);

	for (const method of publicAdapterMethods) {
		if (!allProperties.includes(method)) {
			throw new TypeError(`Peaks.init(): Player method ${method} is undefined`);
		}

		if (
			typeof (adapter as unknown as Record<string, unknown>)[method] !==
			"function"
		) {
			throw new TypeError(
				`Peaks.init(): Player method ${method} is not a function`,
			);
		}
	}
}

/**
 * A wrapper for interfacing with an external player API.
 */

export interface PlayerFromOptions {
	readonly peaks: PeaksInstance | undefined;
	readonly adapter: PlayerAdapter;
}

export class Player {
	private constructor(
		private readonly peaks: PeaksInstance | undefined,
		private readonly adapter: PlayerAdapter,
		private playingSegment: boolean = false,
		private segment: Segment | undefined = undefined,
		private loop: boolean = false,
	) {}

	/**
	 * Creates a player wrapper around the supplied adapter.
	 *
	 * @throws {TypeError} If the adapter does not implement the required player methods.
	 */
	static from(options: PlayerFromOptions): Player {
		validateAdapter(options.adapter);
		return new Player(options.peaks, options.adapter);
	}

	init(): Promise<void> {
		return Promise.resolve(this.adapter.init(this.peaks as PeaksInstance));
	}

	/**
	 * Cleans up the player object.
	 */

	destroy(): void {
		this.playingSegment = false;
		this.loop = false;
		this.segment = undefined;
		this.adapter.dispose();
	}

	/**
	 * Starts playback.
	 * @returns {Promise}
	 */

	play(): Promise<void> {
		return Promise.resolve(this.adapter.play());
	}

	/**
	 * Pauses playback.
	 */

	pause(): void {
		this.adapter.pause();
	}

	/**
	 * @returns {Boolean} <code>true</code> if playing, <code>false</code>
	 * otherwise.
	 */

	isPlaying(): boolean {
		return this.adapter.isPlaying();
	}

	/**
	 * @returns {boolean} <code>true</code> if seeking
	 */

	isSeeking(): boolean {
		return this.adapter.isSeeking();
	}

	/**
	 * Returns the current playback time position, in seconds.
	 *
	 * @returns {Number}
	 */

	getCurrentTime(): number {
		return this.adapter.getCurrentTime();
	}

	/**
	 * Returns the media duration, in seconds.
	 *
	 * @returns {Number}
	 */

	getDuration(): number {
		return this.adapter.getDuration();
	}

	/**
	 * Seeks to a given time position within the media.
	 *
	 * @param {Number} time The time position, in seconds.
	 */

	seek(time: number): void {
		if (!isValidTime(time)) {
			this.peaks?.logger(
				"peaks.player.seek(): parameter must be a valid time, in seconds",
			);
			return;
		}

		this.adapter.seek(time);
	}

	/**
	 * Plays the given segment.
	 *
	 * @param {Segment} segment The segment denoting the time region to play.
	 * @param {Boolean} loop If true, playback is looped.
	 */

	playSegment(segment: Segment, loop: boolean): Promise<void> {
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

		this.segment = segment;
		this.loop = loop;

		// Adapters that natively support segment playback (e.g. ClipNodePlayer
		// using sample-accurate loopStart/loopEnd in an AudioWorklet) handle
		// boundary detection themselves — no main-thread polling needed.
		if (this.adapter.playSegment) {
			return Promise.resolve(this.adapter.playSegment(segment, loop));
		}

		// Set audio time to segment start time
		this.seek(segment.startTime);

		this.peaks?.once("player.playing", () => {
			if (!this.playingSegment) {
				this.playingSegment = true;

				// We need to use requestAnimationFrame here as the timeupdate event
				// doesn't fire often enough.
				window.requestAnimationFrame(this.playSegmentTimerCallback);
			}
		});

		// Start playing audio
		return this.play();
	}

	private playSegmentTimerCallback = (): void => {
		if (!this.isPlaying()) {
			this.playingSegment = false;
			return;
		} else if (this.segment && this.getCurrentTime() >= this.segment.endTime) {
			if (this.loop) {
				this.seek(this.segment.startTime);
			} else {
				this.pause();
				this.peaks?.emit("player.ended");
				this.playingSegment = false;
				return;
			}
		}

		window.requestAnimationFrame(this.playSegmentTimerCallback);
	};

	setSource(options: SetSourceOptions): Promise<void> {
		if (this.adapter.setSource) {
			return this.adapter.setSource(options);
		}
		return Promise.reject(
			new Error("Player adapter does not support setSource"),
		);
	}
}
