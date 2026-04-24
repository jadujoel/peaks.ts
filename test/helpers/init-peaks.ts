// Transitional adapter that exposes the historical callback-style API
// over the new Promise-based `Peaks.from`. New tests should
// `await Peaks.from(opts)` (or `Peaks.tryFrom` for a `Result`) directly.

import { Peaks } from "../../src/main";
import type { PeaksConfiguration } from "../../src/types";

export type InitPeaksCallback = (err?: Error, instance?: Peaks) => void;

export function initPeaks(
	opts: PeaksConfiguration,
	callback: InitPeaksCallback,
): void {
	Peaks.from(opts).then(
		(instance) => {
			callback(undefined, instance);
		},
		(error: unknown) => {
			callback(error as Error);
		},
	);
}
