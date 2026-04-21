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

	private constructor(
		public readonly peaks: SegmentPeaksLike,
		public readonly pid: number,
		public readonly markers: boolean,
		public readonly overlay: boolean,
		public id: string,
		public startTime: number,
		public endTime: number,
		public labelText: string,
		public color: string,
		public borderColor: string,
		public editable: boolean,
	) {}

	static from(options: SegmentFromOptions): Segment {
		const merged = applySegmentDefaults(options.options, options.defaults);
		const instance = new Segment(
			options.peaks,
			options.pid,
			merged.markers ?? false,
			merged.overlay ?? false,
			merged.id ?? `peaks.segment.${options.pid}`,
			merged.startTime,
			merged.endTime,
			merged.labelText ?? "",
			merged.color ?? "",
			merged.borderColor ?? "",
			merged.editable ?? false,
		);
		applyUserData(instance, options.options);
		return instance;
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

			this.peaks.segments?.updateSegmentId(this, options.id);
		}

		applyOptionOverrides(this, options);
		applyUserData(this, options);

		this.peaks.emit("segments.update", this, options);
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
		this.startTime = time;
	}

	setEndTime(time: number): void {
		this.endTime = time;
	}
}

function applyOptionOverrides(
	segment: Segment,
	options: SegmentUpdateOptions,
): void {
	if (objectHasProperty(options, "id") && options.id !== undefined) {
		segment.id = options.id;
	}
	if (
		objectHasProperty(options, "startTime") &&
		options.startTime !== undefined
	) {
		segment.startTime = options.startTime;
	}
	if (objectHasProperty(options, "endTime") && options.endTime !== undefined) {
		segment.endTime = options.endTime;
	}
	if (
		objectHasProperty(options, "labelText") &&
		options.labelText !== undefined
	) {
		segment.labelText = options.labelText;
	}
	if (objectHasProperty(options, "color") && options.color !== undefined) {
		segment.color = options.color;
	}
	if (
		objectHasProperty(options, "borderColor") &&
		options.borderColor !== undefined
	) {
		segment.borderColor = options.borderColor;
	}
	if (
		objectHasProperty(options, "editable") &&
		options.editable !== undefined
	) {
		segment.editable = options.editable;
	}
}

function applyUserData(
	segment: Segment,
	options: SegmentOptions | SegmentUpdateOptions,
): void {
	for (const key in options) {
		if (
			objectHasProperty(options, key) &&
			!segmentOptions.includes(key as (typeof segmentOptions)[number])
		) {
			segment[key] = (options as Record<string, unknown>)[key];
		}
	}
}
