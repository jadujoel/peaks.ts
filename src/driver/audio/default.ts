import type { PeaksConfiguration } from "../../types";
import { ClipNodeAudioDriver } from "./clip-node/driver";
import { MediaElementAudioDriver } from "./media-element/driver";
import type { AudioDriver } from "./types";

/**
 * Builds the default {@link AudioDriver} from a {@link PeaksConfiguration}.
 * Single source of audio backend selection, replacing the multi-branch
 * adapter wiring previously spread across `main.ts`.
 */
export function buildDefaultAudioDriver(
	config: PeaksConfiguration,
): AudioDriver | TypeError {
	if (config.mediaElement) {
		return MediaElementAudioDriver.from({
			mediaElement: config.mediaElement,
		});
	}
	const audioContext = config.audioContext ?? config.webAudio?.context;
	const audioBuffer = config.webAudio?.buffer;
	const url = typeof config.mediaUrl === "string" ? config.mediaUrl : undefined;

	if (audioContext && (audioBuffer ?? url)) {
		return audioBuffer
			? ClipNodeAudioDriver.from({ buffer: audioBuffer, context: audioContext })
			: ClipNodeAudioDriver.from({ context: audioContext, url: url as string });
	}

	return new TypeError(
		"Provide one of: mediaElement, audio driver, or audioContext with audioBuffer/mediaUrl",
	);
}
