import { Point, validatePointOptions } from "../point";
import type { PeaksInstance, PointOptions } from "../types";
import type { Writable } from "../utils";
import { extend, isNullOrUndefined } from "../utils";

/**
 * Handles all functionality related to the adding, removing and manipulation
 * of points. A point is a single instant of time.
 */

export interface WaveformPointsFromOptions {
	readonly peaks: PeaksInstance;
}

export class WaveformPoints {
	private constructor(
		public readonly peaks: PeaksInstance,
		private readonly points: Point[] = [],
		private readonly byId: Map<string, Point> = new Map(),
		private readonly byPid: Map<number, Point> = new Map(),
		private idCounter: number = 0,
		private pidCounter: number = 0,
	) {}

	static from(options: WaveformPointsFromOptions): WaveformPoints {
		return new WaveformPoints(options.peaks);
	}

	/**
	 * Returns all points.
	 */
	getPoints(): Point[] {
		return this.points;
	}

	/**
	 * Returns the point with the given id, or undefined if not found.
	 */
	getPoint(id: string): Point | undefined {
		return this.byId.get(id);
	}

	/**
	 * Returns all points within a given time region.
	 *
	 * @param startTime The start of the time region, in seconds.
	 * @param endTime The end of the time region, in seconds.
	 */
	find(startTime: number, endTime: number): Point[] {
		return this.points.filter((point) => point.isVisible(startTime, endTime));
	}

	/**
	 * Adds one or more points to the timeline.
	 *
	 * @throws {TypeError} If any point option has the wrong type.
	 * @throws {RangeError} If a point time is negative.
	 * @throws {Error} If a duplicate id or reserved option name is provided.
	 */
	add(
		...args: readonly PointOptions[] | readonly [readonly PointOptions[]]
	): Point | Point[] | never {
		const isInputArray = Array.isArray(args[0]);
		const points: PointOptions[] = isInputArray
			? args[0]
			: (args as PointOptions[]);

		const created = points.map((pointOptions: PointOptions) => {
			const point = this.createPoint(pointOptions);
			if (this.byId.has(point.id)) {
				throw new Error("peaks.points.add(): duplicate id");
			}
			return point;
		});

		for (const point of created) {
			this.addPoint(point);
		}

		this.peaks.emit("points.add", {
			points: created,
		});

		return isInputArray ? created : (created[0] as Point);
	}

	/**
	 * Updates the lookup tables for a point id change.
	 *
	 * @throws {Error} If the new point id already exists.
	 */
	updatePointId(point: Point, newPointId: string): undefined | never {
		if (!this.byId.has(point.id)) {
			return;
		}
		if (this.byId.has(newPointId)) {
			throw new Error("point.update(): duplicate id");
		} else {
			this.byId.delete(point.id);
			this.byId.set(newPointId, point);
		}
	}

	/**
	 * Removes the given point.
	 */
	remove(point: Point): Point[] {
		return this.removePoints((p) => p === point);
	}

	/**
	 * Removes any points with the given id.
	 */
	removeById(pointId: string): Point[] {
		return this.removePoints((point) => point.id === pointId);
	}

	/**
	 * Removes any points at the given time.
	 */
	removeByTime(time: number): Point[] {
		return this.removePoints((point) => point.time === time);
	}

	/**
	 * Removes all points.
	 *
	 * After removing the points, this function emits a
	 * points.remove_all event.
	 */
	removeAll(): void {
		this.points.length = 0;
		this.byId.clear();
		this.byPid.clear();
		this.peaks.emit("points.remove_all");
	}

	/**
	 * Returns a new unique point id value.
	 */
	private nextPointName(): string {
		return `peaks.point.${this.idCounter++}`;
	}

	/**
	 * Returns a new unique point id value, for internal use within
	 * Peaks.js only.
	 */
	private nextPid(): number {
		return this.pidCounter++;
	}

	/**
	 * Adds a new point object.
	 */
	private addPoint(point: Point): void {
		this.points.push(point);
		this.byId.set(point.id, point);
		this.byPid.set(point.pid, point);
	}

	/**
	 * Creates a new point object.
	 *
	 * @throws {TypeError} If any point option has the wrong type.
	 * @throws {RangeError} If the point time is negative.
	 * @throws {Error} If reserved or internal option names are provided.
	 */
	private createPoint(options: PointOptions): Point | never {
		const pointOptions = {} as Writable<PointOptions>;
		extend(pointOptions, options as unknown as Record<string, unknown>);

		if (isNullOrUndefined(pointOptions.id)) {
			pointOptions.id = this.nextPointName();
		}

		const pid = this.nextPid();

		validatePointOptions(pointOptions, false);

		return Point.from({
			defaults: {
				pointMarkerColor: this.peaks.options.pointMarkerColor ?? "",
			},
			options: pointOptions,
			peaks: this.peaks,
			pid,
		});
	}

	/**
	 * Returns the indexes of points that match the given predicate.
	 *
	 * @param predicate Predicate function to find matching points.
	 * @returns An array of indexes into the points array of
	 *   the matching elements.
	 */
	private findPoint(predicate: (point: Point) => boolean): number[] {
		const indexes: number[] = [];
		for (let i = 0, length = this.points.length; i < length; i++) {
			const point = this.points[i];
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
	private removeByIndexes(indexes: readonly number[]): Point[] {
		const removed: Point[] = [];
		for (const idx of indexes) {
			const index = idx - removed.length;
			const itemRemoved = this.points.splice(index, 1)[0];
			if (itemRemoved === undefined) {
				continue;
			}
			this.byId.delete(itemRemoved.id);
			this.byPid.delete(itemRemoved.pid);
			removed.push(itemRemoved);
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
	private removePoints(predicate: (point: Point) => boolean): Point[] {
		const indexes = this.findPoint(predicate);

		const removed = this.removeByIndexes(indexes);

		this.peaks.emit("points.remove", {
			points: removed,
		});

		return removed;
	}
}
