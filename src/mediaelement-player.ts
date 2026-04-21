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
	private constructor(
		private readonly eventEmitter: PeaksInstance,
		private readonly mediaElement: HTMLMediaElement,
		private resolve: (() => void) | undefined = undefined,
		private reject: ((reason: MediaError) => void) | undefined = undefined,
	) {}

	static from(options: SetSourceHandlerFromOptions): SetSourceHandler {
		return new SetSourceHandler(options.eventEmitter, options.mediaElement);
	}

	setSource(options: SetSourceOptions): Promise<void> {
		return new Promise((resolve, reject) => {
			this.resolve = resolve;
			this.reject = reject;

			this.eventEmitter.on("player.canplay", this.onPlayerCanPlay);
			this.eventEmitter.on("player.error", this.onPlayerError);

			this.mediaElement.setAttribute("src", options.mediaUrl ?? "");

			// Force the media element to load, in case the media element
			// has preload="none".
			if (this.mediaElement.readyState === HTMLMediaElement.HAVE_NOTHING) {
				this.mediaElement.load();
			}
		});
	}

	private reset(): void {
		this.eventEmitter.removeListener("player.canplay", this.onPlayerCanPlay);
		this.eventEmitter.removeListener("player.error", this.onPlayerError);
	}

	private onPlayerCanPlay = (): void => {
		this.reset();

		this.resolve?.();
	};

	private onPlayerError = (err: MediaError): void => {
		this.reset();

		// Return the MediaError object from the media element
		this.reject?.(err);
	};
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
	private constructor(
		private mediaElement: HTMLMediaElement | undefined,
		private eventEmitter: PeaksInstance | undefined = undefined,
		private listeners: MediaListener[] = [],
	) {}

	static from(options: MediaElementPlayerFromOptions): MediaElementPlayer {
		return new MediaElementPlayer(options.mediaElement);
	}

	/**
	 * Adds an event listener to the media element.
	 *
	 * @param type The event type to listen for.
	 * @param callback An event handler function.
	 */

	private addMediaListener(type: string, callback: EventListener): void {
		this.listeners.push({ callback: callback, type: type });
		this.mediaElement?.addEventListener(type, callback);
	}

	init(eventEmitter: PeaksInstance): Promise<void> {
		this.eventEmitter = eventEmitter;
		this.listeners = [];

		this.addMediaListener("timeupdate", () => {
			this.eventEmitter?.emit("player.timeupdate", this.getCurrentTime());
		});

		this.addMediaListener("playing", () => {
			this.eventEmitter?.emit("player.playing", this.getCurrentTime());
		});

		this.addMediaListener("pause", () => {
			this.eventEmitter?.emit("player.pause", this.getCurrentTime());
		});

		this.addMediaListener("ended", () => {
			this.eventEmitter?.emit("player.ended");
		});

		this.addMediaListener("seeked", () => {
			this.eventEmitter?.emit("player.seeked", this.getCurrentTime());
		});

		this.addMediaListener("canplay", () => {
			this.eventEmitter?.emit("player.canplay");
		});

		this.addMediaListener("error", (event: Event) => {
			this.eventEmitter?.emit(
				"player.error",
				(event.target as HTMLMediaElement).error,
			);
		});

		if (!this.mediaElement) {
			return Promise.resolve();
		}

		if (!mediaElementHasSource(this.mediaElement)) {
			return Promise.resolve();
		} else if (
			this.mediaElement.error &&
			this.mediaElement.error.code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED
		) {
			// The media element has a source, but the format is not supported.
			return Promise.reject(this.mediaElement.error);
		}

		const mediaElement = this.mediaElement;

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

	dispose(): void {
		if (!this.mediaElement) {
			return;
		}

		for (const listener of this.listeners) {
			this.mediaElement.removeEventListener(listener.type, listener.callback);
		}

		this.listeners.length = 0;

		this.mediaElement = undefined;
	}

	play(): Promise<void> {
		if (!this.mediaElement) {
			return Promise.resolve();
		}

		return this.mediaElement.play();
	}

	pause(): void {
		this.mediaElement?.pause();
	}

	isPlaying(): boolean {
		if (!this.mediaElement) {
			return false;
		}

		return !this.mediaElement.paused;
	}

	isSeeking(): boolean {
		return this.mediaElement?.seeking ?? false;
	}

	getCurrentTime(): number {
		return this.mediaElement?.currentTime ?? 0;
	}

	getDuration(): number {
		return this.mediaElement?.duration ?? 0;
	}

	seek(time: number): void {
		if (this.mediaElement) {
			this.mediaElement.currentTime = time;
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

		if (!this.eventEmitter || !this.mediaElement) {
			return Promise.reject(
				new Error("peaks.setSource(): player not initialized"),
			);
		}

		const setSourceHandler = SetSourceHandler.from({
			eventEmitter: this.eventEmitter,
			mediaElement: this.mediaElement,
		});

		return setSourceHandler.setSource(options);
	}
}
