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
	if (config.data?.type === "webaudio") {
		const data = config.data;
		if (data.context && data.buffer) {
			return ClipNodeAudioDriver.from({
				buffer: data.buffer,
				context: data.context,
			});
		}
		if (data.context && config.mediaUrl) {
			return ClipNodeAudioDriver.from({
				context: data.context,
				url: config.mediaUrl,
			});
		}
	}

	return new TypeError(
		"Provide one of: mediaElement, audio driver, or data: { type: 'webaudio', context, buffer | mediaUrl }",
	);
}
