import type { Segment } from "./segment";
import type { PeaksInstance, PlayerAdapter, SetSourceOptions } from "./types";
import { isValidTime } from "./utils";

export function getAllPropertiesFrom(adapter: PlayerAdapter): string[] {
	const allProperties: string[] = [];
	let obj = adapter;

	while (obj) {
		Object.getOwnPropertyNames(obj).forEach((p) => {
			allProperties.push(p);
		});

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

	publicAdapterMethods.forEach((method) => {
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
	});
}

/**
 * A wrapper for interfacing with an external player API.
 */

export class Player {
	private _peaks: PeaksInstance | null;
	private _playingSegment: boolean;
	private _segment: Segment | null;
	private _loop: boolean;
	private _adapter: PlayerAdapter;

	/**
	 * Creates a player wrapper around the supplied adapter.
	 *
	 * @throws {TypeError} If the adapter does not implement the required player methods.
	 */
	constructor(peaks: PeaksInstance | null, adapter: PlayerAdapter) {
		this._peaks = peaks;

		this._playingSegment = false;
		this._segment = null;
		this._loop = false;

		validateAdapter(adapter);
		this._adapter = adapter;
	}

	init(): Promise<void> {
		return Promise.resolve(this._adapter.init(this._peaks as PeaksInstance));
	}

	/**
	 * Cleans up the player object.
	 */

	destroy(): void {
		this._playingSegment = false;
		this._loop = false;
		this._segment = null;
		this._adapter.destroy();
	}

	/**
	 * Starts playback.
	 * @returns {Promise}
	 */

	play(): Promise<void> {
		return Promise.resolve(this._adapter.play());
	}

	/**
	 * Pauses playback.
	 */

	pause(): void {
		this._adapter.pause();
	}

	/**
	 * @returns {Boolean} <code>true</code> if playing, <code>false</code>
	 * otherwise.
	 */

	isPlaying(): boolean {
		return this._adapter.isPlaying();
	}

	/**
	 * @returns {boolean} <code>true</code> if seeking
	 */

	isSeeking(): boolean {
		return this._adapter.isSeeking();
	}

	/**
	 * Returns the current playback time position, in seconds.
	 *
	 * @returns {Number}
	 */

	getCurrentTime(): number {
		return this._adapter.getCurrentTime();
	}

	/**
	 * Returns the media duration, in seconds.
	 *
	 * @returns {Number}
	 */

	getDuration(): number {
		return this._adapter.getDuration();
	}

	/**
	 * Seeks to a given time position within the media.
	 *
	 * @param {Number} time The time position, in seconds.
	 */

	seek(time: number): void {
		if (!isValidTime(time)) {
			this._peaks?._logger(
				"peaks.player.seek(): parameter must be a valid time, in seconds",
			);
			return;
		}

		this._adapter.seek(time);
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

		this._segment = segment;
		this._loop = loop;

		// Adapters that natively support segment playback (e.g. ClipNodePlayer
		// using sample-accurate loopStart/loopEnd in an AudioWorklet) handle
		// boundary detection themselves — no main-thread polling needed.
		if (this._adapter.playSegment) {
			return Promise.resolve(this._adapter.playSegment(segment, loop));
		}

		// Set audio time to segment start time
		this.seek(segment.startTime);

		this._peaks?.once("player.playing", () => {
			if (!this._playingSegment) {
				this._playingSegment = true;

				// We need to use requestAnimationFrame here as the timeupdate event
				// doesn't fire often enough.
				window.requestAnimationFrame(this._playSegmentTimerCallback);
			}
		});

		// Start playing audio
		return this.play();
	}

	_playSegmentTimerCallback = (): void => {
		if (!this.isPlaying()) {
			this._playingSegment = false;
			return;
		} else if (
			this._segment &&
			this.getCurrentTime() >= this._segment.endTime
		) {
			if (this._loop) {
				this.seek(this._segment.startTime);
			} else {
				this.pause();
				this._peaks?.emit("player.ended");
				this._playingSegment = false;
				return;
			}
		}

		window.requestAnimationFrame(this._playSegmentTimerCallback);
	};

	_setSource(options: SetSourceOptions): Promise<void> {
		if (this._adapter.setSource) {
			return this._adapter.setSource(options);
		}
		return Promise.reject(
			new Error("Player adapter does not support setSource"),
		);
	}
}
