import { err, ok, type Result } from "neverthrow";

/**
 * Time signature for a {@link TempoSection}.
 */
export interface TimeSignature {
	readonly numerator: number;
	readonly denominator: number;
}

/**
 * A single section in a piecewise-constant {@link TempoMap}.
 */
export interface TempoSection {
	readonly time: number;
	readonly bpm: number;
	readonly signature?: TimeSignature;
}

/**
 * Grid step expressed as a note fraction. String shorthand for the common
 * cases or an object for triplets / dotted variants.
 */
export type GridStep =
	| "1/1"
	| "1/2"
	| "1/4"
	| "1/8"
	| "1/16"
	| "1/32"
	| { readonly numerator: number; readonly denominator: number }
	| {
			readonly denominator: number;
			readonly tuplet: "triplet" | "dotted";
	  };

export interface TempoMapFromOptions {
	readonly sections: readonly TempoSection[];
}

export interface TempoMapConstantOptions {
	readonly bpm: number;
	readonly signature?: TimeSignature;
}

export const DEFAULT_TIME_SIGNATURE: TimeSignature = {
	denominator: 4,
	numerator: 4,
};

/**
 * A piecewise-constant tempo map. Sections are sorted ascending by time
 * and the first section starts at `time === 0`.
 */
export class TempoMap {
	private constructor(public readonly sections: readonly TempoSection[]) {}

	/**
	 * Build a tempo map from a (sorted) list of sections.
	 *
	 * @throws never - returns a `Result` instead of throwing.
	 */
	static from(options: TempoMapFromOptions): Result<TempoMap, Error> {
		const sections = options.sections;
		if (!Array.isArray(sections) || sections.length === 0) {
			return err(new Error("TempoMap requires at least one section"));
		}
		const first = sections[0];
		if (!first || first.time !== 0) {
			return err(new Error("TempoMap first section must start at time 0"));
		}
		for (let i = 0; i < sections.length; i++) {
			const section = sections[i];
			if (!section) {
				return err(new Error("TempoMap section is missing"));
			}
			if (!Number.isFinite(section.time) || section.time < 0) {
				return err(new Error("TempoMap section time must be >= 0"));
			}
			if (!Number.isFinite(section.bpm) || section.bpm <= 0) {
				return err(new Error("TempoMap section bpm must be > 0"));
			}
			if (i > 0) {
				const previous = sections[i - 1];
				if (previous && section.time <= previous.time) {
					return err(
						new Error("TempoMap sections must be in ascending time order"),
					);
				}
			}
			const signature = section.signature;
			if (signature !== undefined) {
				if (signature.numerator <= 0 || signature.denominator <= 0) {
					return err(
						new Error("TempoMap section signature values must be > 0"),
					);
				}
			}
		}
		return ok(new TempoMap(sections.slice()));
	}

	/**
	 * Convenience constructor for a constant-tempo map.
	 *
	 * @throws never
	 */
	static constant(options: TempoMapConstantOptions): TempoMap {
		const result = TempoMap.from({
			sections: [
				{
					bpm: options.bpm,
					signature: options.signature ?? DEFAULT_TIME_SIGNATURE,
					time: 0,
				},
			],
		});
		// `constant` is only invoked with valid constant data — `from`
		// errors here would indicate a programming error, so we throw.
		if (result.isErr()) {
			throw result.error;
		}
		return result.value;
	}
}

/**
 * Returns the {@link TempoSection} active at the given time. Sections are
 * half-open `[time, nextTime)`; the last section extends to infinity.
 */
export function tempoSectionAt(map: TempoMap, time: number): TempoSection {
	const sections = map.sections;
	let lo = 0;
	let hi = sections.length - 1;
	let result = sections[0] as TempoSection;
	while (lo <= hi) {
		const mid = (lo + hi) >> 1;
		const section = sections[mid] as TempoSection;
		if (section.time <= time) {
			result = section;
			lo = mid + 1;
		} else {
			hi = mid - 1;
		}
	}
	return result;
}

/**
 * Returns the upper bound time (exclusive) of the section active at `time`,
 * or `+Infinity` if it is the last section.
 */
export function tempoSectionEndAt(map: TempoMap, time: number): number {
	const sections = map.sections;
	const section = tempoSectionAt(map, time);
	const index = sections.indexOf(section);
	const next = sections[index + 1];
	return next ? next.time : Number.POSITIVE_INFINITY;
}

/**
 * Returns the duration in seconds of one grid step under the given
 * tempo section.
 */
export function stepDurationSeconds(
	section: TempoSection,
	step: GridStep,
): number {
	const signature = section.signature ?? DEFAULT_TIME_SIGNATURE;
	const beatSeconds = 60 / section.bpm;
	const quarterSeconds = beatSeconds * (signature.denominator / 4);

	if (typeof step === "string") {
		const denominator = stringDenominator(step);
		return quarterSeconds * (4 / denominator);
	}
	if ("tuplet" in step) {
		const base = quarterSeconds * (4 / step.denominator);
		return step.tuplet === "triplet" ? (base * 2) / 3 : base * 1.5;
	}
	return quarterSeconds * ((4 * step.numerator) / step.denominator);
}

function stringDenominator(step: string): number {
	switch (step) {
		case "1/1":
			return 1;
		case "1/2":
			return 2;
		case "1/4":
			return 4;
		case "1/8":
			return 8;
		case "1/16":
			return 16;
		case "1/32":
			return 32;
		default:
			return 4;
	}
}

/**
 * Snap `time` to the nearest grid line within its active tempo section.
 * Returns `time` unchanged when no map is provided.
 */
export function snapTime(
	map: TempoMap | undefined,
	step: GridStep,
	time: number,
): number {
	if (!map) {
		return time;
	}
	if (!Number.isFinite(time)) {
		return time;
	}
	const section = tempoSectionAt(map, Math.max(0, time));
	const stepSeconds = stepDurationSeconds(section, step);
	if (stepSeconds <= 0) {
		return time;
	}
	const offset = time - section.time;
	const snapped = section.time + Math.round(offset / stepSeconds) * stepSeconds;
	return snapped;
}

/**
 * Yields the grid times in `[startTime, endTime]` for the given step.
 *
 * Iterates each section that overlaps the window, starting at the first
 * grid line `>= startTime` within that section.
 */
export function* gridTimes(
	map: TempoMap,
	step: GridStep,
	startTime: number,
	endTime: number,
): Generator<{ readonly time: number; readonly section: TempoSection }> {
	if (endTime < startTime) {
		return;
	}
	const sections = map.sections;
	for (let i = 0; i < sections.length; i++) {
		const section = sections[i] as TempoSection;
		const next = sections[i + 1];
		const sectionEnd = next ? next.time : endTime + 1;
		if (sectionEnd <= startTime) continue;
		if (section.time > endTime) break;
		const stepSeconds = stepDurationSeconds(section, step);
		if (stepSeconds <= 0) continue;
		const windowStart = Math.max(startTime, section.time);
		const offsetIndex = Math.ceil(
			(windowStart - section.time) / stepSeconds - 1e-9,
		);
		let t = section.time + offsetIndex * stepSeconds;
		while (t <= endTime && t < sectionEnd) {
			if (t >= startTime) {
				yield { section, time: t };
			}
			t += stepSeconds;
		}
	}
}

/**
 * Returns `true` when `time` is the start of a bar in `section`.
 */
export function isBarStart(
	section: TempoSection,
	step: GridStep,
	time: number,
	tolerance = 1e-6,
): boolean {
	const signature = section.signature ?? DEFAULT_TIME_SIGNATURE;
	const stepSeconds = stepDurationSeconds(section, step);
	if (stepSeconds <= 0) return false;
	const beatSeconds = 60 / section.bpm;
	const barSeconds = beatSeconds * signature.numerator;
	const offset = time - section.time;
	const remainder = offset % barSeconds;
	return (
		Math.abs(remainder) < tolerance ||
		Math.abs(remainder - barSeconds) < tolerance
	);
}
