import type { PeaksConfiguration, PlayerAdapter } from "../../types";
import { ClipNodeAudioDriver } from "./clip-node/driver";
import { MediaElementAudioDriver } from "./media-element/driver";
import type {
	AudioDriver,
	AudioDriverContext,
	AudioSource,
	PlaySegmentOptions,
} from "./types";

/**
 * Wraps a legacy duck-typed {@link PlayerAdapter} in the
 * {@link AudioDriver} interface so existing demo code that supplies
 * `PeaksConfiguration.player` keeps working. Marked `@deprecated` —
 * remove together with `PeaksConfiguration.player` in peaks-16.
 *
 * @deprecated Use {@link MediaElementAudioDriver} or
 * {@link ClipNodeAudioDriver} (or your own {@link AudioDriver}) instead.
 */
export class LegacyAdapterAudioDriver implements AudioDriver {
	private constructor(private readonly adapter: PlayerAdapter) {}

	static wrap(adapter: PlayerAdapter): LegacyAdapterAudioDriver {
		return new LegacyAdapterAudioDriver(adapter);
	}

	init(ctx: AudioDriverContext): Promise<void> {
		return Promise.resolve(this.adapter.init({ events: ctx.events }));
	}

	dispose(): void {
		this.adapter.dispose?.();
	}

	play(): Promise<void> {
		return Promise.resolve(this.adapter.play());
	}

	pause(): void {
		this.adapter.pause();
	}

	isPlaying(): boolean {
		return this.adapter.isPlaying();
	}

	isSeeking(): boolean {
		return this.adapter.isSeeking();
	}

	getCurrentTime(): number {
		return this.adapter.getCurrentTime();
	}

	getDuration(): number {
		return this.adapter.getDuration();
	}

	seek(time: number): void {
		this.adapter.seek(time);
	}

	playSegment(options: PlaySegmentOptions): Promise<void> {
		const native = this.adapter.playSegment;
		if (native) {
			return Promise.resolve(
				native.call(this.adapter, options.segment, options.loop),
			);
		}
		// Adapter does not implement segment playback natively. Defer to
		// the simpler "seek then play" behaviour the legacy Player used
		// to perform — full polling should now happen inside a real
		// AudioDriver, not in the legacy shim.
		this.adapter.seek(options.segment.startTime);
		return Promise.resolve(this.adapter.play());
	}

	setSource(source: AudioSource): Promise<void> {
		if (!this.adapter.setSource) {
			return Promise.reject(
				new Error("Legacy player adapter does not support setSource"),
			);
		}
		return this.adapter.setSource(source);
	}
}

/**
 * Builds the default {@link AudioDriver} from a {@link PeaksConfiguration}.
 * Single source of audio backend selection, replacing the multi-branch
 * adapter wiring previously spread across `main.ts`.
 */
export function buildDefaultAudioDriver(
	config: PeaksConfiguration,
): AudioDriver | TypeError {
	if (config.player) {
		return LegacyAdapterAudioDriver.wrap(config.player);
	}
	if (config.mediaElement) {
		return MediaElementAudioDriver.from({
			mediaElement: config.mediaElement,
		});
	}
	const audioContext = config.audioContext ?? config.webAudio?.audioContext;
	const audioBuffer = config.webAudio?.audioBuffer;
	const url = typeof config.mediaUrl === "string" ? config.mediaUrl : undefined;

	if (audioContext && (audioBuffer ?? url)) {
		return audioBuffer
			? ClipNodeAudioDriver.from({ buffer: audioBuffer, context: audioContext })
			: ClipNodeAudioDriver.from({ context: audioContext, url: url as string });
	}

	return new TypeError(
		"Provide one of: mediaElement, player, or audioContext with audioBuffer/mediaUrl",
	);
}
