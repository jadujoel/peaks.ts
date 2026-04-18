import { Point, setDefaultPointOptions, validatePointOptions } from "./point";
import type { PeaksInstance, PointOptions } from "./types";
import { extend, isNullOrUndefined, objectHasProperty } from "./utils";

/**
 * Handles all functionality related to the adding, removing and manipulation
 * of points. A point is a single instant of time.
 */

export class WaveformPoints {
	private _peaks: PeaksInstance;
	private _points: Point[];
	private _pointsById: Record<string, Point>;
	private _pointsByPid: Record<number, Point>;
	private _pointIdCounter: number;
	private _pointPid: number;

	constructor(peaks: PeaksInstance) {
		this._peaks = peaks;
		this._points = [];
		this._pointsById = {};
		this._pointsByPid = {};
		this._pointIdCounter = 0;
		this._pointPid = 0;
	}

	/**
	 * Returns a new unique point id value.
	 */

	private _getNextPointId(): string {
		return `peaks.point.${this._pointIdCounter++}`;
	}

	/**
	 * Returns a new unique point id value, for internal use within
	 * Peaks.js only.
	 */

	private _getNextPid(): number {
		return this._pointPid++;
	}

	/**
	 * Adds a new point object.
	 */

	private _addPoint(point: Point): void {
		this._points.push(point);

		this._pointsById[point.id] = point;
		this._pointsByPid[point.pid] = point;
	}

	/**
	 * Creates a new point object.
	 *
	 * @throws {TypeError} If any point option has the wrong type.
	 * @throws {RangeError} If the point time is negative.
	 * @throws {Error} If reserved or internal option names are provided.
	 */

	private _createPoint(options: PointOptions): Point | never {
		const pointOptions = {} as PointOptions;

		extend(pointOptions, options as unknown as Record<string, unknown>);

		if (isNullOrUndefined(pointOptions.id)) {
			pointOptions.id = this._getNextPointId();
		}

		const pid = this._getNextPid();

		setDefaultPointOptions(pointOptions, this._peaks.options);

		validatePointOptions(pointOptions, false);

		return new Point(this._peaks, pid, pointOptions);
	}

	/**
	 * Returns all points.
	 */

	getPoints(): Point[] {
		return this._points;
	}

	/**
	 * Returns the point with the given id, or undefined if not found.
	 */

	getPoint(id: string): Point | undefined {
		return this._pointsById[id];
	}

	/**
	 * Returns all points within a given time region.
	 *
	 * @param startTime The start of the time region, in seconds.
	 * @param endTime The end of the time region, in seconds.
	 */

	find(startTime: number, endTime: number): Point[] {
		return this._points.filter((point) => point.isVisible(startTime, endTime));
	}

	/**
	 * Adds one or more points to the timeline.
	 *
	 * @throws {TypeError} If any point option has the wrong type.
	 * @throws {RangeError} If a point time is negative.
	 * @throws {Error} If a duplicate id or reserved option name is provided.
	 */

	add(...args: PointOptions[] | [PointOptions[]]): Point | Point[] | never {
		const arrayArgs = Array.isArray(args[0]);
		const points: PointOptions[] = arrayArgs
			? (args[0] as PointOptions[])
			: (args as PointOptions[]);

		const created = points.map((pointOptions: PointOptions) => {
			const point = this._createPoint(pointOptions);

			if (objectHasProperty(this._pointsById, point.id)) {
				throw new Error("peaks.points.add(): duplicate id");
			}

			return point;
		});

		created.forEach((point: Point) => {
			this._addPoint(point);
		});

		this._peaks.emit("points.add", {
			points: created,
		});

		return arrayArgs ? created : (created[0] as Point);
	}

	/**
	 * Updates the lookup tables for a point id change.
	 *
	 * @throws {Error} If the new point id already exists.
	 */
	updatePointId(point: Point, newPointId: string): undefined | never {
		if (this._pointsById[point.id]) {
			if (this._pointsById[newPointId]) {
				throw new Error("point.update(): duplicate id");
			} else {
				delete this._pointsById[point.id];
				this._pointsById[newPointId] = point;
			}
		}
	}

	/**
	 * Returns the indexes of points that match the given predicate.
	 *
	 * @param predicate Predicate function to find matching points.
	 * @returns An array of indexes into the points array of
	 *   the matching elements.
	 */

	private _findPoint(predicate: (point: Point) => boolean): number[] {
		const indexes: number[] = [];

		for (let i = 0, length = this._points.length; i < length; i++) {
			const point = this._points[i];

			if (point && predicate(point)) {
				indexes.push(i);
			}
		}

		return indexes;
	}

	/**
	 * Removes the points at the given array indexes.
	 *
	 * @param indexes The array indexes to remove.
	 * @returns The removed Point objects.
	 */

	private _removeIndexes(indexes: number[]): Point[] {
		const removed: Point[] = [];

		for (const idx of indexes) {
			const index = idx - removed.length;

			const itemRemoved = this._points.splice(index, 1)[0];

			if (itemRemoved) {
				delete this._pointsById[itemRemoved.id];
				delete this._pointsByPid[itemRemoved.pid];

				removed.push(itemRemoved);
			}
		}

		return removed;
	}

	/**
	 * Removes all points that match a given predicate function.
	 *
	 * After removing the points, this function emits a
	 * points.remove event with the removed Point objects.
	 *
	 * @param predicate A predicate function that identifies which
	 *   points to remove.
	 * @returns The removed Point objects.
	 */

	private _removePoints(predicate: (point: Point) => boolean): Point[] {
		const indexes = this._findPoint(predicate);

		const removed = this._removeIndexes(indexes);

		this._peaks.emit("points.remove", {
			points: removed,
		});

		return removed;
	}

	/**
	 * Removes the given point.
	 */

	remove(point: Point): Point[] {
		return this._removePoints((p) => p === point);
	}

	/**
	 * Removes any points with the given id.
	 */

	removeById(pointId: string): Point[] {
		return this._removePoints((point) => point.id === pointId);
	}

	/**
	 * Removes any points at the given time.
	 */

	removeByTime(time: number): Point[] {
		return this._removePoints((point) => point.time === time);
	}

	/**
	 * Removes all points.
	 *
	 * After removing the points, this function emits a
	 * points.remove_all event.
	 */

	removeAll(): void {
		this._points = [];
		this._pointsById = {};
		this._pointsByPid = {};
		this._peaks.emit("points.remove_all");
	}
}
