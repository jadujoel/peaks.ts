// TODO: This is a transitional test adapter that bridges the old
// callback-style `Peaks.from` signature used pervasively by the unit tests
// to the new `ResultAsync`-returning `Peaks.from` API. New tests should
// `await Peaks.from(opts)` and inspect the returned `Result` directly.

import { Peaks } from "../../src/main";
import type { PeaksConfiguration } from "../../src/types";

export type InitPeaksCallback = (err?: Error, instance?: Peaks) => void;

export function initPeaks(
	opts: PeaksConfiguration,
	callback: InitPeaksCallback,
): void {
	Peaks.from(opts).then(
		(result) => {
			if (result.isErr()) {
				callback(result.error);
				return;
			}
			callback(undefined, result.value);
		},
		(error: unknown) => {
			callback(error instanceof Error ? error : new Error(String(error)));
		},
	);
}
