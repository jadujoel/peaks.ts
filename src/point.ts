import type { PeaksEvents } from './events';
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
	readonly events: PeaksEvents;
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
 * TODO: Return a result object instead of throwing errors.
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
	// TODO: remove this allowing any key thing. USe a map or something if you really need to store extra properties somewhere
	[key: string]: unknown;

	private constructor(
		public readonly pid: number,
		public id: string,
		public time: number,
		public labelText: string,
		public color: string,
		public editable: boolean,
		private readonly peaks: PointPeaksLike,
	) {}

	static from(options: PointFromOptions): Point {
		const merged = applyPointDefaults(options.options, options.defaults);
		const instance = new Point(
			options.pid,
			merged.id ?? `peaks.point.${options.pid}`,
			merged.time,
			merged.labelText ?? "",
			merged.color ?? "",
			merged.editable ?? false,
			options.peaks,
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

		if (options.time !== undefined) {
			this.time = options.time;
		}
		if (options.labelText !== undefined) {
			this.labelText = options.labelText;
		}
		if (options.color !== undefined) {
			this.color = options.color;
		}
		if (options.editable !== undefined) {
			this.editable = options.editable;
		}

		applyUserData(this, options);

		this.peaks.events.dispatch("points.update", { options, point: this });
	}

	isVisible(startTime: number, endTime: number): boolean {
		return this.time >= startTime && this.time < endTime;
	}

	setTime(time: number): void {
		this.time = time;
	}

	dispose(): void {
		// No external resources held; included to satisfy the lifecycle contract.
	}
}

// TODO: this is very unsafe and should be refactored out
function applyUserData(
	point: Point,
	options: PointOptions | PointUpdateOptions,
): void {
	for (const key of Object.keys(options)) {
		if (!pointOptions.includes(key as (typeof pointOptions)[number])) {
			point[key] = (options as Record<string, unknown>)[key];
		}
	}
}
