import type { Peaks } from "../../src/main";
import type { SetSourceOptions } from "../../src/types";

// Bridges the new Promise-based `Peaks.setSource` API to the
// callback-style used by the existing unit tests.
export function setSource(
	peaks: Peaks,
	options: SetSourceOptions,
	callback: (err?: Error) => void,
): void {
	peaks.setSource(options).then(
		() => {
			callback();
		},
		(error: unknown) => {
			callback(error as Error);
		},
	);
}
