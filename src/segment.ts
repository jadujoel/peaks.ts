import type {
	PeaksInstance,
	SegmentOptions,
	SegmentUpdateOptions,
} from "./types";
import {
	isBoolean,
	isLinearGradientColor,
	isNullOrUndefined,
	isString,
	isValidTime,
	objectHasProperty,
} from "./utils";

export const segmentOptions = [
	"id",
	"pid",
	"startTime",
	"endTime",
	"labelText",
	"color",
	"borderColor",
	"markers",
	"overlay",
	"editable",
] as const;

export const invalidOptions = ["update", "isVisible", "peaks", "pid"] as const;

export interface SegmentDefaults {
	readonly overlay: boolean;
	readonly overlayColor: string;
	readonly waveformColor: string;
	readonly overlayBorderColor: string;
	readonly markers: boolean;
}

const DEFAULT_SEGMENT_DEFAULTS: SegmentDefaults = {
	markers: true,
	overlay: false,
	overlayBorderColor: "",
	overlayColor: "",
	waveformColor: "",
};

function applySegmentDefaults(
	options: SegmentOptions,
	defaults: SegmentDefaults = DEFAULT_SEGMENT_DEFAULTS,
): SegmentOptions {
	return {
		...options,
		borderColor: options.borderColor ?? defaults.overlayBorderColor,
		color:
			options.color ??
			(defaults.overlay ? defaults.overlayColor : defaults.waveformColor),
		editable: options.editable ?? false,
		labelText: options.labelText ?? "",
		markers: options.markers ?? defaults.markers,
		overlay: options.overlay ?? defaults.overlay,
	};
}

/**
 * Validates segment options before creation or update.
 *
 * @throws {TypeError} If required times are missing, values have the wrong type,
 *   or immutable properties are updated.
 * @throws {RangeError} If a time is negative or endTime is earlier than startTime.
 * @throws {Error} If reserved or internal option names are provided.
 */
export function validateSegmentOptions(
	options: SegmentOptions | SegmentUpdateOptions,
	updating: boolean,
): undefined | never {
	const context = updating ? "update()" : "add()";

	if (
		objectHasProperty(options, "startTime") &&
		!isValidTime(options.startTime)
	) {
		throw new TypeError(
			`peaks.segments.${context}: startTime should be a valid number`,
		);
	}

	if (objectHasProperty(options, "endTime") && !isValidTime(options.endTime)) {
		throw new TypeError(
			`peaks.segments.${context}: endTime should be a valid number`,
		);
	}

	if (!updating) {
		if (
			!objectHasProperty(options, "startTime") ||
			!objectHasProperty(options, "endTime")
		) {
			throw new TypeError(
				`peaks.segments.${context}: missing startTime or endTime`,
			);
		}
	}

	if ((options as SegmentOptions).startTime < 0) {
		throw new RangeError(
			`peaks.segments.${context}: startTime should not be negative`,
		);
	}

	if ((options as SegmentOptions).endTime < 0) {
		throw new RangeError(
			`peaks.segments.${context}: endTime should not be negative`,
		);
	}

	if (
		(options as SegmentOptions).endTime < (options as SegmentOptions).startTime
	) {
		throw new RangeError(
			`peaks.segments.${context}: endTime should not be less than startTime`,
		);
	}

	if (
		objectHasProperty(options, "labelText") &&
		!isNullOrUndefined(options.labelText) &&
		!isString(options.labelText)
	) {
		throw new TypeError(
			`peaks.segments.${context}: labelText must be a string`,
		);
	}

	if (updating && objectHasProperty(options, "markers")) {
		throw new TypeError(
			`peaks.segments.${context}: cannot update markers attribute`,
		);
	}

	if (
		objectHasProperty(options, "markers") &&
		!isNullOrUndefined((options as SegmentOptions).markers) &&
		!isBoolean((options as SegmentOptions).markers)
	) {
		throw new TypeError(
			`peaks.segments.${context}: markers must be true or false`,
		);
	}

	if (updating && objectHasProperty(options, "overlay")) {
		throw new TypeError(
			`peaks.segments.${context}: cannot update overlay attribute`,
		);
	}

	if (
		objectHasProperty(options, "overlay") &&
		!isNullOrUndefined((options as SegmentOptions).overlay) &&
		!isBoolean((options as SegmentOptions).overlay)
	) {
		throw new TypeError(
			`peaks.segments.${context}: overlay must be true or false`,
		);
	}

	if (
		objectHasProperty(options, "editable") &&
		!isNullOrUndefined(options.editable) &&
		!isBoolean(options.editable)
	) {
		throw new TypeError(
			`peaks.segments.${context}: editable must be true or false`,
		);
	}

	if (
		objectHasProperty(options, "color") &&
		!isNullOrUndefined(options.color) &&
		!isString(options.color) &&
		!isLinearGradientColor(options.color)
	) {
		throw new TypeError(
			`peaks.segments.${context}: color must be a string or a valid linear gradient object`,
		);
	}

	if (
		objectHasProperty(options, "borderColor") &&
		!isNullOrUndefined(options.borderColor) &&
		!isString(options.borderColor)
	) {
		throw new TypeError(
			`peaks.segments.${context}: borderColor must be a string`,
		);
	}

	for (const name of invalidOptions) {
		if (objectHasProperty(options, name)) {
			throw new Error(
				`peaks.segments.${context}: invalid option name: ${name}`,
			);
		}
	}

	for (const name of segmentOptions) {
		if (objectHasProperty(options, `_${name}`)) {
			throw new Error(
				`peaks.segments.${context}: invalid option name: _${name}`,
			);
		}
	}
}

/**
 * A segment is a region of time, with associated label and color.
 */

export type SegmentPeaksLike = {
	emit: (eventName: string | symbol, ...args: unknown[]) => unknown;
	readonly segments?: Pick<PeaksInstance["segments"], "updateSegmentId">;
};

export interface SegmentFromOptions {
	readonly peaks: SegmentPeaksLike;
	readonly pid: number;
	readonly options: SegmentOptions;
	readonly defaults?: SegmentDefaults;
}

export class Segment {
	[key: string]: unknown;

	#peaks: SegmentPeaksLike;
	#pid: number;
	#id: string;
	#startTime: number;
	#endTime: number;
	#labelText: string;
	#color: string;
	#borderColor: string;
	#editable: boolean;
	#markers: boolean;
	#overlay: boolean;

	static from(options: SegmentFromOptions): Segment {
		const merged = applySegmentDefaults(options.options, options.defaults);
		return new Segment(options.peaks, options.pid, merged);
	}

	private constructor(
		peaks: SegmentPeaksLike,
		pid: number,
		options: SegmentOptions,
	) {
		this.#peaks = peaks;
		this.#pid = pid;
		this.#id = options.id ?? `peaks.segment.${pid}`;
		this.#startTime = options.startTime;
		this.#endTime = options.endTime;
		this.#labelText = options.labelText ?? "";
		this.#color = options.color ?? "";
		this.#borderColor = options.borderColor ?? "";
		this.#editable = options.editable ?? false;
		this.#markers = options.markers ?? false;
		this.#overlay = options.overlay ?? false;

		this.setUserData(options);
	}

	private setUserData(options: SegmentOptions | SegmentUpdateOptions): void {
		if (objectHasProperty(options, "id") && options.id !== undefined) {
			this.#id = options.id;
		}
		if (
			objectHasProperty(options, "startTime") &&
			options.startTime !== undefined
		) {
			this.#startTime = options.startTime;
		}
		if (
			objectHasProperty(options, "endTime") &&
			options.endTime !== undefined
		) {
			this.#endTime = options.endTime;
		}
		if (
			objectHasProperty(options, "labelText") &&
			options.labelText !== undefined
		) {
			this.#labelText = options.labelText;
		}
		if (objectHasProperty(options, "color") && options.color !== undefined) {
			this.#color = options.color;
		}
		if (
			objectHasProperty(options, "borderColor") &&
			options.borderColor !== undefined
		) {
			this.#borderColor = options.borderColor;
		}
		if (
			objectHasProperty(options, "editable") &&
			options.editable !== undefined
		) {
			this.#editable = options.editable;
		}
		for (const key in options) {
			if (
				objectHasProperty(options, key) &&
				!segmentOptions.includes(key as (typeof segmentOptions)[number])
			) {
				this[key] = (options as Record<string, unknown>)[key];
			}
		}
	}

	get id(): string {
		return this.#id;
	}

	get pid(): number {
		return this.#pid;
	}

	get startTime(): number {
		return this.#startTime;
	}

	get endTime(): number {
		return this.#endTime;
	}

	get labelText(): string {
		return this.#labelText;
	}

	get color(): string {
		return this.#color;
	}

	get borderColor(): string {
		return this.#borderColor;
	}

	get markers(): boolean {
		return this.#markers;
	}

	get overlay(): boolean {
		return this.#overlay;
	}

	get editable(): boolean {
		return this.#editable;
	}

	/**
	 * Updates a segment and emits a segments.update event.
	 *
	 * @throws {TypeError} If the updated id is invalid, an immutable property is changed,
	 *   or any option has the wrong type.
	 * @throws {RangeError} If a provided time is negative or endTime is before startTime.
	 * @throws {Error} If reserved option names are used or the new id conflicts with an existing segment.
	 */
	update(options: SegmentUpdateOptions): undefined | never {
		validateSegmentOptions(options, true);

		if (objectHasProperty(options, "id")) {
			if (isNullOrUndefined(options.id)) {
				throw new TypeError("segment.update(): invalid id");
			}

			this.#peaks.segments?.updateSegmentId(this, options.id);
		}

		this.setUserData(options);

		this.#peaks.emit("segments.update", this, options);
	}

	/**
	 * Returns <code>true</code> if the segment overlaps a given time region.
	 *
	 * @param {Number} startTime The start of the time region, in seconds.
	 * @param {Number} endTime The end of the time region, in seconds.
	 * @returns {Boolean}
	 */

	isVisible(startTime: number, endTime: number): boolean {
		// A special case, where the segment has zero duration
		// and is at the start of the region.
		if (this.startTime === this.endTime && this.startTime === startTime) {
			return true;
		}

		// Segment ends before start of region.
		if (this.endTime <= startTime) {
			return false;
		}

		// Segment starts after end of region
		if (this.startTime >= endTime) {
			return false;
		}

		return true;
	}

	setStartTime(time: number): void {
		this.#startTime = time;
	}

	setEndTime(time: number): void {
		this.#endTime = time;
	}
}
