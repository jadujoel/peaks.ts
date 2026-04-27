import { Point, validatePointOptions } from "../point";
import type { PeaksInstance, PointOptions, PointUpdateOptions } from "../types";

/**
 * Handles all functionality related to the adding, removing and manipulation
 * of points. A point is a single instant of time.
 */

export interface WaveformPointsFromOptions {
	readonly peaks: PeaksInstance;
}

export type PointPredicate = (point: Point) => boolean;

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

		this.peaks.events.dispatch("points.add", {
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
		this.peaks.events.dispatch("points.remove_all", {});
	}

	/**
	 * Applies the same {@link PointUpdateOptions} patch to every existing
	 * point. No-op when there are no points.
	 *
	 * @throws {TypeError|RangeError|Error} Whatever {@link Point.update}
	 *   throws for invalid patches.
	 */
	updateAll(patch: PointUpdateOptions): void {
		for (const point of this.points) {
			point.update(patch);
		}
	}

	/**
	 * Adds a point at the player's current time. Defaults: `editable =
	 * true`, `labelText = "Point"`. Returns the created point.
	 */
	addAtPlayhead(options: AddAtPlayheadPointOptions = {}): Point {
		const created = this.add({
			editable: options.editable ?? true,
			labelText: options.labelText ?? "Point",
			time: this.peaks.player.getCurrentTime(),
			...(options.id !== undefined ? { id: options.id } : {}),
		});

		return Array.isArray(created) ? (created[0] as Point) : created;
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
		const updated = {
			...options,
			id: options.id ?? this.nextPointName(),
		};
		validatePointOptions(updated, false);

		return Point.from({
			defaults: {
				pointMarkerColor: this.peaks.options.pointMarkerColor ?? "",
			},
			options: updated,
			peaks: this.peaks,
			pid: this.nextPid(),
		});
	}

	/**
	 * Returns the indexes of points that match the given predicate.
	 *
	 * @param predicate Predicate function to find matching points.
	 * @returns An array of indexes into the points array of
	 *   the matching elements.
	 */
	private findPoint(predicate: PointPredicate): number[] {
		const indices: number[] = [];
		for (const [index, point] of this.points.entries()) {
			if (predicate(point)) {
				indices.push(index);
			}
		}
		return indices;
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
	private removePoints(predicate: PointPredicate): Point[] {
		const indexes = this.findPoint(predicate);
		const removed = this.removeByIndexes(indexes);
		this.peaks.events.dispatch("points.remove", {
			points: removed,
		});
		return removed;
	}
}

export interface AddAtPlayheadPointOptions {
	/** Defaults to "Point". */
	readonly labelText?: string;
	/** Defaults to true so the new point is immediately draggable. */
	readonly editable?: boolean;
	/** Optional explicit id; one is generated when omitted. */
	readonly id?: string;
}
