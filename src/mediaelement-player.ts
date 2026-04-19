import type { PeaksInstance, SetSourceOptions } from "./types";

/**
 * Implementation of Player adapter based on an <audio> or <video> HTML element.
 */

/**
 * Checks whether the given HTMLMediaElement has either a src attribute
 * or any child <source> nodes.
 */

function mediaElementHasSource(mediaElement: HTMLMediaElement): boolean {
	if (mediaElement.src) {
		return true;
	}

	if (mediaElement.querySelector("source")) {
		return true;
	}

	return false;
}

interface SetSourceHandlerFromOptions {
	readonly eventEmitter: PeaksInstance;
	readonly mediaElement: HTMLMediaElement;
}

class SetSourceHandler {
	private _eventEmitter: PeaksInstance;
	private _mediaElement: HTMLMediaElement;
	private _playerCanPlayHandler: () => void;
	private _playerErrorHandler: (err: MediaError) => void;
	private _resolve: (() => void) | undefined;
	private _reject: ((reason: MediaError) => void) | undefined;

	static from(options: SetSourceHandlerFromOptions): SetSourceHandler {
		return new SetSourceHandler(options.eventEmitter, options.mediaElement);
	}

	private constructor(
		eventEmitter: PeaksInstance,
		mediaElement: HTMLMediaElement,
	) {
		this._eventEmitter = eventEmitter;
		this._mediaElement = mediaElement;
		this._playerCanPlayHandler = this._onPlayerCanPlay.bind(this);
		this._playerErrorHandler = this._onPlayerError.bind(this);
	}

	setSource(options: SetSourceOptions): Promise<void> {
		return new Promise((resolve, reject) => {
			this._resolve = resolve;
			this._reject = reject;

			this._eventEmitter.on("player.canplay", this._playerCanPlayHandler);
			this._eventEmitter.on("player.error", this._playerErrorHandler);

			this._mediaElement.setAttribute("src", options.mediaUrl ?? "");

			// Force the media element to load, in case the media element
			// has preload="none".
			if (this._mediaElement.readyState === HTMLMediaElement.HAVE_NOTHING) {
				this._mediaElement.load();
			}
		});
	}

	private _reset(): void {
		this._eventEmitter.removeListener(
			"player.canplay",
			this._playerCanPlayHandler,
		);
		this._eventEmitter.removeListener("player.error", this._playerErrorHandler);
	}

	private _onPlayerCanPlay(): void {
		this._reset();

		this._resolve?.();
	}

	private _onPlayerError(err: MediaError): void {
		this._reset();

		// Return the MediaError object from the media element
		this._reject?.(err);
	}
}

interface MediaListener {
	type: string;
	callback: EventListener;
}

/**
 * A wrapper for interfacing with the HTMLMediaElement API.
 * Initializes the player for a given media element.
 *
 * @param mediaElement The HTML <audio> or <video> element to associate
 *   with the Peaks instance.
 */

export interface MediaElementPlayerFromOptions {
	readonly mediaElement: HTMLMediaElement;
}

export class MediaElementPlayer {
	private _mediaElement: HTMLMediaElement | undefined;
	private _eventEmitter: PeaksInstance | undefined;
	private _listeners: MediaListener[];

	static from(options: MediaElementPlayerFromOptions): MediaElementPlayer {
		return new MediaElementPlayer(options.mediaElement);
	}

	private constructor(mediaElement: HTMLMediaElement) {
		this._mediaElement = mediaElement;
		this._eventEmitter = undefined;
		this._listeners = [];
	}

	/**
	 * Adds an event listener to the media element.
	 *
	 * @param type The event type to listen for.
	 * @param callback An event handler function.
	 */

	private _addMediaListener(type: string, callback: EventListener): void {
		this._listeners.push({ type: type, callback: callback });
		this._mediaElement?.addEventListener(type, callback);
	}

	init(eventEmitter: PeaksInstance): Promise<void> {
		this._eventEmitter = eventEmitter;
		this._listeners = [];

		this._addMediaListener("timeupdate", () => {
			this._eventEmitter?.emit("player.timeupdate", this.getCurrentTime());
		});

		this._addMediaListener("playing", () => {
			this._eventEmitter?.emit("player.playing", this.getCurrentTime());
		});

		this._addMediaListener("pause", () => {
			this._eventEmitter?.emit("player.pause", this.getCurrentTime());
		});

		this._addMediaListener("ended", () => {
			this._eventEmitter?.emit("player.ended");
		});

		this._addMediaListener("seeked", () => {
			this._eventEmitter?.emit("player.seeked", this.getCurrentTime());
		});

		this._addMediaListener("canplay", () => {
			this._eventEmitter?.emit("player.canplay");
		});

		this._addMediaListener("error", (event: Event) => {
			this._eventEmitter?.emit(
				"player.error",
				(event.target as HTMLMediaElement).error,
			);
		});

		if (!this._mediaElement) {
			return Promise.resolve();
		}

		if (!mediaElementHasSource(this._mediaElement)) {
			return Promise.resolve();
		} else if (
			this._mediaElement.error &&
			this._mediaElement.error.code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED
		) {
			// The media element has a source, but the format is not supported.
			return Promise.reject(this._mediaElement.error);
		}

		const mediaElement = this._mediaElement;

		return new Promise((resolve, reject) => {
			const cleanup = () => {
				mediaElement.removeEventListener("loadedmetadata", eventHandler);
				mediaElement.removeEventListener("canplay", eventHandler);
				mediaElement.removeEventListener("error", eventHandler);
			};

			const resolveIfPlayable = (): boolean => {
				if (mediaElement.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
					cleanup();
					resolve();
					return true;
				}

				return false;
			};

			const eventHandler = (event: Event) => {
				if (event.type === "error") {
					cleanup();
					reject((event.target as HTMLMediaElement).error);
				} else {
					resolveIfPlayable();
				}
			};

			// If the media element has preload="none", clicking to seek in the
			// waveform won't work, so here we force the media to load.
			if (mediaElement.readyState === HTMLMediaElement.HAVE_NOTHING) {
				// Wait until the media can actually be played and sought reliably.
				mediaElement.addEventListener("loadedmetadata", eventHandler);
				mediaElement.addEventListener("canplay", eventHandler);
				mediaElement.addEventListener("error", eventHandler);
				mediaElement.load();
			} else if (!resolveIfPlayable()) {
				mediaElement.addEventListener("canplay", eventHandler);
				mediaElement.addEventListener("error", eventHandler);
			} else {
				resolve();
			}
		});
	}

	/**
	 * Cleans up the player object, removing all event listeners from the
	 * associated media element.
	 */

	destroy(): void {
		if (!this._mediaElement) {
			return;
		}

		for (const listener of this._listeners) {
			this._mediaElement.removeEventListener(listener.type, listener.callback);
		}

		this._listeners.length = 0;

		this._mediaElement = undefined;
	}

	play(): Promise<void> {
		if (!this._mediaElement) {
			return Promise.resolve();
		}

		return this._mediaElement.play();
	}

	pause(): void {
		this._mediaElement?.pause();
	}

	isPlaying(): boolean {
		if (!this._mediaElement) {
			return false;
		}

		return !this._mediaElement.paused;
	}

	isSeeking(): boolean {
		return this._mediaElement?.seeking ?? false;
	}

	getCurrentTime(): number {
		return this._mediaElement?.currentTime ?? 0;
	}

	getDuration(): number {
		return this._mediaElement?.duration ?? 0;
	}

	seek(time: number): void {
		if (this._mediaElement) {
			this._mediaElement.currentTime = time;
		}
	}

	setSource(options: SetSourceOptions): Promise<void> {
		if (!options.mediaUrl) {
			return Promise.reject(
				new Error(
					"peaks.setSource(): options must contain a mediaUrl when using mediaElement",
				),
			);
		}

		if (!this._eventEmitter || !this._mediaElement) {
			return Promise.reject(
				new Error("peaks.setSource(): player not initialized"),
			);
		}

		const setSourceHandler = SetSourceHandler.from({
			eventEmitter: this._eventEmitter,
			mediaElement: this._mediaElement,
		});

		return setSourceHandler.setSource(options);
	}
}
