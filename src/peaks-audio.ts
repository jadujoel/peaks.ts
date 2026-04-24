import { err, ok, type Result } from "neverthrow";
import { buildDefaultAudioDriver } from "./driver/audio/default";
import type { AudioDriver } from "./driver/audio/types";
import type { PeaksConfiguration } from "./types";

/**
 * Resolves the {@link AudioDriver} from a {@link PeaksConfiguration},
 * preferring an explicitly-supplied `audio` driver over the default
 * fallback inferred from `mediaElement` / `audioContext` settings.
 */
export function resolveAudioDriver(
	config: PeaksConfiguration,
): Result<AudioDriver, Error> {
	if (config.audio) {
		return ok(config.audio);
	}

	const built = buildDefaultAudioDriver(config);
	if (built instanceof TypeError) {
		return err(built);
	}
	return ok(built);
}
