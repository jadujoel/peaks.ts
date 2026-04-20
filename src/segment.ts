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
	private readonly _peaks: SegmentPeaksLike;
	private readonly _pid: number;
	private _id!: string;
	private _startTime!: number;
	private _endTime!: number;
	private _labelText!: string;
	private _color!: string;
	private _borderColor!: string;
	private _editable!: boolean;
	private _markers!: boolean;
	private _overlay!: boolean;

	static from(options: SegmentFromOptions): Segment {
		const merged = applySegmentDefaults(options.options, options.defaults);
		return new Segment(options.peaks, options.pid, merged);
	}

	private constructor(
		peaks: SegmentPeaksLike,
		pid: number,
		options: SegmentOptions,
	) {
		this._peaks = peaks;
		this._pid = pid;
		this._id = options.id ?? `peaks.segment.${pid}`;
		this._startTime = options.startTime;
		this._endTime = options.endTime;
		this._labelText = options.labelText ?? "";
		this._color = options.color ?? "";
		this._borderColor = options.borderColor ?? "";
		this._editable = options.editable ?? false;
		this._markers = options.markers ?? false;
		this._overlay = options.overlay ?? false;

		this._setUserData(options);
	}

	_setUserData(options: SegmentOptions | SegmentUpdateOptions): void {
		for (const key in options) {
			if (objectHasProperty(options, key)) {
				if (segmentOptions.indexOf(key) === -1) {
					this[key] = options[key];
				} else {
					this[`_${key}`] = options[key];
				}
			}
		}
	}

	get id(): string {
		return this._id;
	}

	get pid(): number {
		return this._pid;
	}

	get startTime(): number {
		return this._startTime;
	}

	get endTime(): number {
		return this._endTime;
	}

	get labelText(): string {
		return this._labelText;
	}

	get color(): string {
		return this._color;
	}

	get borderColor(): string {
		return this._borderColor;
	}

	get markers(): boolean {
		return this._markers;
	}

	get overlay(): boolean {
		return this._overlay;
	}

	get editable(): boolean {
		return this._editable;
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

			this._peaks.segments?.updateSegmentId(this, options.id);
		}

		this._setUserData(options);

		this._peaks.emit("segments.update", this, options);
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

	_setStartTime(time: number): void {
		this._startTime = time;
	}

	_setEndTime(time: number): void {
		this._endTime = time;
	}
}
