import type { PeaksInstance, PointOptions, PointUpdateOptions } from "./types";
import {
	isBoolean,
	isLinearGradientColor,
	isString,
	isValidTime,
	objectHasProperty,
} from "./utils";

/**
 * A point is a single instant of time, with associated label and color.
 */

export type PointPeaksLike = {
	emit: (eventName: string | symbol, ...args: unknown[]) => unknown;
	readonly points?: Pick<PeaksInstance["points"], "updatePointId">;
};

export const pointOptions = [
	"id",
	"pid",
	"time",
	"labelText",
	"color",
	"editable",
] as const;

export const invalidOptions = ["update", "isVisible", "peaks", "pid"] as const;

export interface PointDefaults {
	readonly pointMarkerColor: string;
}

const DEFAULT_POINT_DEFAULTS: PointDefaults = {
	pointMarkerColor: "",
};

function applyPointDefaults(
	options: PointOptions,
	defaults: PointDefaults = DEFAULT_POINT_DEFAULTS,
): PointOptions {
	return {
		...options,
		color: options.color ?? defaults.pointMarkerColor,
		editable: options.editable ?? false,
		labelText: options.labelText ?? "",
	};
}

/**
 * Validates point options before creation or update.
 *
 * @throws {TypeError} If time is not numeric, labelText is not a string,
 *   editable is not a boolean, or color is not a supported string or gradient.
 * @throws {RangeError} If time is negative.
 * @throws {Error} If reserved or internal option names are provided.
 */
export function validatePointOptions(
	options: PointOptions | PointUpdateOptions,
	updating: boolean,
): undefined | never {
	const context = updating ? "update()" : "add()";

	if (!updating || (updating && objectHasProperty(options, "time"))) {
		if (!isValidTime((options as PointOptions).time)) {
			throw new TypeError(
				`peaks.points.${context}: time should be a numeric value`,
			);
		}
	}

	if ((options as PointOptions).time < 0) {
		throw new RangeError(
			`peaks.points.${context}: time should not be negative`,
		);
	}

	if (
		objectHasProperty(options, "labelText") &&
		!(!updating && options.labelText == null) &&
		!isString(options.labelText)
	) {
		throw new TypeError(`peaks.points.${context}: labelText must be a string`);
	}

	if (
		objectHasProperty(options, "editable") &&
		!(!updating && options.editable == null) &&
		!isBoolean(options.editable)
	) {
		throw new TypeError(
			`peaks.points.${context}: editable must be true or false`,
		);
	}

	if (
		objectHasProperty(options, "color") &&
		!(!updating && options.color == null) &&
		!isString(options.color) &&
		!isLinearGradientColor(options.color)
	) {
		throw new TypeError(
			`peaks.points.${context}: color must be a string or a valid linear gradient object`,
		);
	}

	for (const name of invalidOptions) {
		if (objectHasProperty(options, name)) {
			throw new Error(`peaks.points.${context}: invalid option name: ${name}`);
		}
	}

	for (const name of pointOptions) {
		if (objectHasProperty(options, `_${name}`)) {
			throw new Error(`peaks.points.${context}: invalid option name: _${name}`);
		}
	}
}

export interface PointFromOptions {
	readonly peaks: PointPeaksLike;
	readonly pid: number;
	readonly options: PointOptions;
	readonly defaults?: PointDefaults;
}

export class Point {
	[key: string]: unknown;

	private constructor(
		public readonly peaks: PointPeaksLike,
		public readonly pid: number,
		public id: string,
		public time: number,
		public labelText: string,
		public color: string,
		public editable: boolean,
	) {}

	static from(options: PointFromOptions): Point {
		const merged = applyPointDefaults(options.options, options.defaults);
		const instance = new Point(
			options.peaks,
			options.pid,
			merged.id ?? `peaks.point.${options.pid}`,
			merged.time,
			merged.labelText ?? "",
			merged.color ?? "",
			merged.editable ?? false,
		);
		applyUserData(instance, options.options);
		return instance;
	}

	/**
	 * Updates a point and emits a points.update event.
	 *
	 * @throws {TypeError} If the updated id is invalid or any option has the wrong type.
	 * @throws {RangeError} If the updated time is negative.
	 * @throws {Error} If reserved option names are used or the new id conflicts with an existing point.
	 */
	update(options: PointUpdateOptions): undefined | never {
		validatePointOptions(options, true);

		if (Object.hasOwn(options, "id")) {
			if (options.id == null) {
				throw new TypeError("point.update(): invalid id");
			}

			this.peaks.points?.updatePointId(this, options.id);
			this.id = options.id;
		}

		if (Object.hasOwn(options, "time") && options.time !== undefined) {
			this.time = options.time;
		}
		if (
			Object.hasOwn(options, "labelText") &&
			options.labelText !== undefined
		) {
			this.labelText = options.labelText;
		}
		if (Object.hasOwn(options, "color") && options.color !== undefined) {
			this.color = options.color;
		}
		if (Object.hasOwn(options, "editable") && options.editable !== undefined) {
			this.editable = options.editable;
		}

		applyUserData(this, options);

		this.peaks.emit("points.update", this, options);
	}

	isVisible(startTime: number, endTime: number): boolean {
		return this.time >= startTime && this.time < endTime;
	}

	setTime(time: number): void {
		this.time = time;
	}
}

function applyUserData(
	point: Point,
	options: PointOptions | PointUpdateOptions,
): void {
	for (const key of Object.keys(options)) {
		if (!pointOptions.includes(key as keyof PointOptions)) {
			point[key] = (options as Record<string, unknown>)[key];
		}
	}
}
