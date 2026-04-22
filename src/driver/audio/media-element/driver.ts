import type { PeaksEvents } from "../../../events";
import { PollingSegmentPlayer } from "../segment-polling";
import type {
	AudioDriver,
	AudioDriverContext,
	AudioSource,
	PlaySegmentOptions,
} from "../types";

/**
 * Implementation of the {@link AudioDriver} interface backed by an
 * `<audio>` or `<video>` HTML element.
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
	readonly events: PeaksEvents;
	readonly mediaElement: HTMLMediaElement;
}

class SetSourceHandler {
	private constructor(
		private readonly events: PeaksEvents,
		private readonly mediaElement: HTMLMediaElement,
		private resolve: (() => void) | undefined = undefined,
		private reject: ((reason: MediaError) => void) | undefined = undefined,
	) {}

	static from(options: SetSourceHandlerFromOptions): SetSourceHandler {
		return new SetSourceHandler(options.events, options.mediaElement);
	}

	setSource(source: AudioSource): Promise<void> {
		return new Promise((resolve, reject) => {
			this.resolve = resolve;
			this.reject = reject;

			this.events.addEventListener("player.canplay", this.onPlayerCanPlay);
			this.events.addEventListener("player.error", this.onPlayerError);

			this.mediaElement.setAttribute("src", source.mediaUrl ?? "");

			// Force the media element to load, in case the media element
			// has preload="none".
			if (this.mediaElement.readyState === HTMLMediaElement.HAVE_NOTHING) {
				this.mediaElement.load();
			}
		});
	}

	private reset(): void {
		this.events.removeEventListener("player.canplay", this.onPlayerCanPlay);
		this.events.removeEventListener("player.error", this.onPlayerError);
	}

	private onPlayerCanPlay = (): void => {
		this.reset();

		this.resolve?.();
	};

	private onPlayerError = (event: { readonly error: unknown }): void => {
		this.reset();

		// Return the MediaError object from the media element
		this.reject?.(event.error as MediaError);
	};
}

interface MediaListener {
	type: string;
	callback: EventListener;
}

export interface MediaElementAudioDriverFromOptions {
	readonly mediaElement: HTMLMediaElement;
}

export class MediaElementAudioDriver implements AudioDriver {
	private constructor(
		private mediaElement: HTMLMediaElement | undefined,
		private events: PeaksEvents | undefined = undefined,
		private listeners: MediaListener[] = [],
		private segmentPlayer: PollingSegmentPlayer | undefined = undefined,
	) {}

	static from(
		options: MediaElementAudioDriverFromOptions,
	): MediaElementAudioDriver {
		return new MediaElementAudioDriver(options.mediaElement);
	}

	private addMediaListener(type: string, callback: EventListener): void {
		this.listeners.push({ callback: callback, type: type });
		this.mediaElement?.addEventListener(type, callback);
	}

	init(ctx: AudioDriverContext): Promise<void> {
		this.events = ctx.events;
		this.listeners = [];

		this.addMediaListener("timeupdate", () => {
			this.events?.dispatch("player.timeupdate", {
				time: this.getCurrentTime(),
			});
		});

		this.addMediaListener("playing", () => {
			this.events?.dispatch("player.playing", {
				time: this.getCurrentTime(),
			});
		});

		this.addMediaListener("pause", () => {
			this.events?.dispatch("player.pause", {
				time: this.getCurrentTime(),
			});
		});

		this.addMediaListener("ended", () => {
			this.events?.dispatch("player.ended", {});
		});

		this.addMediaListener("seeked", () => {
			this.events?.dispatch("player.seeked", {
				time: this.getCurrentTime(),
			});
		});

		this.addMediaListener("canplay", () => {
			this.events?.dispatch("player.canplay", {});
		});

		this.addMediaListener("error", (event: Event) => {
			const error = (event.target as HTMLMediaElement).error;
			if (error) {
				this.events?.dispatch("player.error", { error });
			}
		});

		this.segmentPlayer = PollingSegmentPlayer.from({
			events: this.events,
			getCurrentTime: () => this.getCurrentTime(),
			isPlaying: () => this.isPlaying(),
			pause: () => this.pause(),
			play: () => this.play(),
			seek: (time: number) => this.seek(time),
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

			if (mediaElement.readyState === HTMLMediaElement.HAVE_NOTHING) {
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

	dispose(): void {
		this.segmentPlayer?.stop();
		this.segmentPlayer = undefined;

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

	playSegment(options: PlaySegmentOptions): Promise<void> {
		if (!this.segmentPlayer) {
			return Promise.reject(
				new Error(
					"peaks.player.playSegment(): MediaElementAudioDriver not initialized",
				),
			);
		}
		return this.segmentPlayer.start(options.segment, options.loop);
	}

	setSource(source: AudioSource): Promise<void> {
		if (!source.mediaUrl) {
			return Promise.reject(
				new Error(
					"peaks.setSource(): options must contain a mediaUrl when using mediaElement",
				),
			);
		}

		if (!this.events || !this.mediaElement) {
			return Promise.reject(
				new Error("peaks.setSource(): driver not initialized"),
			);
		}

		const setSourceHandler = SetSourceHandler.from({
			events: this.events,
			mediaElement: this.mediaElement,
		});

		return setSourceHandler.setSource(source);
	}
}
