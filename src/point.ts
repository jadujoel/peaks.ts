import type { PeaksInstance, PointOptions, PointUpdateOptions } from "./types";
import {
	isBoolean,
	isLinearGradientColor,
	isNullOrUndefined,
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
		!(!updating && isNullOrUndefined(options.labelText)) &&
		!isString(options.labelText)
	) {
		throw new TypeError(`peaks.points.${context}: labelText must be a string`);
	}

	if (
		objectHasProperty(options, "editable") &&
		!(!updating && isNullOrUndefined(options.editable)) &&
		!isBoolean(options.editable)
	) {
		throw new TypeError(
			`peaks.points.${context}: editable must be true or false`,
		);
	}

	if (
		objectHasProperty(options, "color") &&
		!(!updating && isNullOrUndefined(options.color)) &&
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

	#peaks: PointPeaksLike;
	#pid: number;
	#id: string;
	#time: number;
	#labelText: string;
	#color: string;
	#editable: boolean;

	static from(options: PointFromOptions): Point {
		const merged = applyPointDefaults(options.options, options.defaults);
		return new Point(options.peaks, options.pid, merged);
	}

	private constructor(
		peaks: PointPeaksLike,
		pid: number,
		options: PointOptions,
	) {
		this.#peaks = peaks;
		this.#pid = pid;
		this.#id = options.id ?? `peaks.point.${pid}`;
		this.#time = (options as PointOptions).time;
		this.#labelText = options.labelText ?? "";
		this.#color = options.color ?? "";
		this.#editable = options.editable ?? false;
		this.setUserData(options);
	}

	private setUserData(options: PointOptions | PointUpdateOptions): void {
		if (objectHasProperty(options, "id") && options.id !== undefined) {
			this.#id = options.id;
		}
		if (
			objectHasProperty(options, "time") &&
			(options as PointOptions).time !== undefined
		) {
			this.#time = (options as PointOptions).time;
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
			objectHasProperty(options, "editable") &&
			options.editable !== undefined
		) {
			this.#editable = options.editable;
		}
		for (const key in options) {
			if (objectHasProperty(options, key) && !pointOptions.includes(key)) {
				this[key] = options[key];
			}
		}
	}

	get id(): string {
		return this.#id;
	}

	get pid(): number {
		return this.#pid;
	}

	get time(): number {
		return this.#time;
	}

	get labelText(): string {
		return this.#labelText;
	}

	get color(): string {
		return this.#color;
	}

	get editable(): boolean {
		return this.#editable;
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

		if (objectHasProperty(options, "id")) {
			if (isNullOrUndefined(options.id)) {
				throw new TypeError("point.update(): invalid id");
			}

			this.#peaks.points?.updatePointId(this, options.id);
		}

		this.setUserData(options);

		this.#peaks.emit("points.update", this, options);
	}

	/**
	 * Returns <code>true</code> if the point lies with in a given time range.
	 *
	 * @param {Number} startTime The start of the time region, in seconds.
	 * @param {Number} endTime The end of the time region, in seconds.
	 * @returns {Boolean}
	 */

	isVisible(startTime: number, endTime: number): boolean {
		return this.time >= startTime && this.time < endTime;
	}

	setTime(time: number): void {
		this.#time = time;
	}
}
