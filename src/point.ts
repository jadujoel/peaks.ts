import type { PeaksInstance, PointOptions, PointUpdateOptions } from "./types";
import {
	isBoolean,
	isLinearGradientColor,
	isNullOrUndefined,
	isString,
	isValidTime,
	objectHasProperty,
} from "./utils";

const pointOptions = ["id", "pid", "time", "labelText", "color", "editable"];

const invalidOptions = ["update", "isVisible", "peaks", "pid"];

function setDefaultPointOptions(
	options: PointOptions,
	peaksOptions: { pointMarkerColor: string },
): void {
	if (isNullOrUndefined(options.labelText)) {
		options.labelText = "";
	}

	if (isNullOrUndefined(options.editable)) {
		options.editable = false;
	}

	if (isNullOrUndefined(options.color)) {
		options.color = peaksOptions.pointMarkerColor;
	}
}

function validatePointOptions(
	options: PointOptions | PointUpdateOptions,
	updating: boolean,
): void {
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

	if (objectHasProperty(options, "labelText") && !isString(options.labelText)) {
		throw new TypeError(`peaks.points.${context}: labelText must be a string`);
	}

	if (objectHasProperty(options, "editable") && !isBoolean(options.editable)) {
		throw new TypeError(
			`peaks.points.${context}: editable must be true or false`,
		);
	}

	if (
		objectHasProperty(options, "color") &&
		!isString(options.color) &&
		!isLinearGradientColor(options.color)
	) {
		throw new TypeError(
			`peaks.points.${context}: color must be a string or a valid linear gradient object`,
		);
	}

	invalidOptions.forEach((name) => {
		if (objectHasProperty(options, name)) {
			throw new Error(`peaks.points.${context}: invalid option name: ${name}`);
		}
	});

	pointOptions.forEach((name) => {
		if (objectHasProperty(options, `_${name}`)) {
			throw new Error(`peaks.points.${context}: invalid option name: _${name}`);
		}
	});
}

/**
 * A point is a single instant of time, with associated label and color.
 */

class Point {
	[key: string]: unknown;

	private _peaks: PeaksInstance;
	private _pid: number;
	private _id!: string;
	private _time!: number;
	private _labelText!: string;
	private _color!: string;
	private _editable!: boolean;

	constructor(peaks: PeaksInstance, pid: number, options: PointOptions) {
		this._peaks = peaks;
		this._pid = pid;
		this._setUserData(options);
	}

	_setUserData(options: PointOptions | PointUpdateOptions): void {
		for (const key in options) {
			if (objectHasProperty(options, key)) {
				if (pointOptions.indexOf(key) === -1) {
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

	get time(): number {
		return this._time;
	}

	get labelText(): string {
		return this._labelText;
	}

	get color(): string {
		return this._color;
	}

	get editable(): boolean {
		return this._editable;
	}

	update(options: PointUpdateOptions): void {
		validatePointOptions(options, true);

		if (objectHasProperty(options, "id")) {
			if (isNullOrUndefined(options.id)) {
				throw new TypeError("point.update(): invalid id");
			}

			this._peaks.points.updatePointId(this, options.id);
		}

		this._setUserData(options);

		this._peaks.emit("points.update", this, options);
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

	_setTime(time: number): void {
		this._time = time;
	}
}

export { Point, setDefaultPointOptions, validatePointOptions };
