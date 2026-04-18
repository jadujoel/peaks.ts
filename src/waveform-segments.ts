import {
	Segment,
	setDefaultSegmentOptions,
	validateSegmentOptions,
} from "./segment";
import type { PeaksInstance, SegmentOptions } from "./types";
import { extend, isNullOrUndefined, objectHasProperty } from "./utils";

/**
 * Handles all functionality related to the adding, removing and manipulation
 * of segments.
 */
class WaveformSegments {
	private _peaks: PeaksInstance;
	private _segments: Segment[];
	private _segmentsById: Record<string, Segment>;
	private _segmentsByPid: Record<number, Segment>;
	private _segmentIdCounter: number;
	private _segmentPid: number;
	private _isInserting: boolean;

	constructor(peaks: PeaksInstance) {
		this._peaks = peaks;
		this._segments = [];
		this._segmentsById = {};
		this._segmentsByPid = {};
		this._segmentIdCounter = 0;
		this._segmentPid = 0;
		this._isInserting = false;
	}

	private _getNextSegmentId(): string {
		return `peaks.segment.${this._segmentIdCounter++}`;
	}

	private _getNextPid(): number {
		return this._segmentPid++;
	}

	private _addSegment(segment: Segment): void {
		this._segments.push(segment);

		this._segmentsById[segment.id] = segment;
		this._segmentsByPid[segment.pid] = segment;
	}

	/**
	 * Creates a new segment object.
	 *
	 * @throws {TypeError} If required segment options are missing or have the wrong type.
	 * @throws {RangeError} If the segment times are invalid.
	 * @throws {Error} If reserved or internal option names are provided.
	 */
	private _createSegment(options: SegmentOptions): Segment | never {
		const segmentOptions = {} as SegmentOptions;

		extend(segmentOptions, options as unknown as Record<string, unknown>);

		if (isNullOrUndefined(segmentOptions.id)) {
			segmentOptions.id = this._getNextSegmentId();
		}

		const pid = this._getNextPid();

		setDefaultSegmentOptions(
			segmentOptions,
			this._peaks.options.segmentOptions,
		);

		validateSegmentOptions(segmentOptions, false);

		return new Segment(this._peaks, pid, segmentOptions);
	}

	getSegments(): Segment[] {
		return this._segments;
	}

	getSegment(id: string): Segment | undefined {
		return this._segmentsById[id];
	}

	getSegmentsAtTime(time: number): Segment[] {
		return this._segments.filter(
			(segment: Segment) => time >= segment.startTime && time < segment.endTime,
		);
	}

	/**
	 * Returns all segments that overlap a given time region.
	 *
	 * @param startTime The start of the time region, in seconds.
	 * @param endTime The end of the time region, in seconds.
	 */
	find(startTime: number, endTime: number): Segment[] {
		return this._segments.filter((segment: Segment) =>
			segment.isVisible(startTime, endTime),
		);
	}

	private _getSortedSegments(): Segment[] {
		return this._segments
			.slice()
			.sort((a: Segment, b: Segment) => a.startTime - b.startTime);
	}

	findPreviousSegment(segment: Segment): Segment | undefined {
		const sortedSegments = this._getSortedSegments();

		const index = sortedSegments.findIndex((s: Segment) => s.id === segment.id);

		if (index !== -1) {
			return sortedSegments[index - 1];
		}

		return undefined;
	}

	findNextSegment(segment: Segment): Segment | undefined {
		const sortedSegments = this._getSortedSegments();

		const index = sortedSegments.findIndex((s: Segment) => s.id === segment.id);

		if (index !== -1) {
			return sortedSegments[index + 1];
		}

		return undefined;
	}

	/**
	 * Adds one or more segments to the timeline.
	 *
	 * @throws {TypeError} If required segment options are missing or have the wrong type.
	 * @throws {RangeError} If the segment times are invalid.
	 * @throws {Error} If a duplicate id or reserved option name is provided.
	 */
	add(
		...args: SegmentOptions[] | [SegmentOptions[]]
	): Segment | Segment[] | never {
		const arrayArgs = Array.isArray(args[0]);
		const segments: SegmentOptions[] = arrayArgs
			? (args[0] as SegmentOptions[])
			: (args as SegmentOptions[]);

		const created = segments.map((segmentOptions: SegmentOptions) => {
			const segment = this._createSegment(segmentOptions);

			if (objectHasProperty(this._segmentsById, segment.id)) {
				throw new Error("peaks.segments.add(): duplicate id");
			}

			return segment;
		});

		created.forEach((segment: Segment) => {
			this._addSegment(segment);
		});

		this._peaks.emit("segments.add", {
			segments: created,
			insert: this._isInserting,
		});

		return arrayArgs ? created : (created[0] as Segment);
	}

	/**
	 * Updates the lookup tables for a segment id change.
	 *
	 * @throws {Error} If the new segment id already exists.
	 */
	updateSegmentId(segment: Segment, newSegmentId: string): undefined | never {
		if (this._segmentsById[segment.id]) {
			if (this._segmentsById[newSegmentId]) {
				throw new Error("segment.update(): duplicate id");
			} else {
				delete this._segmentsById[segment.id];
				this._segmentsById[newSegmentId] = segment;
			}
		}
	}

	/**
	 * Returns the indexes of segments that match the given predicate.
	 */
	private _findSegment(predicate: (segment: Segment) => boolean): number[] {
		const indexes: number[] = [];

		let i = 0;

		for (const segment of this._segments) {
			if (predicate(segment)) {
				indexes.push(i);
			}
			i++;
		}

		return indexes;
	}

	/**
	 * Removes the segments at the given array indexes.
	 */
	private _removeIndexes(indexes: number[]): Segment[] {
		const removed: Segment[] = [];

		for (const idx of indexes) {
			const index = idx - removed.length;

			const itemRemoved = this._segments.splice(index, 1)[0];

			if (itemRemoved) {
				delete this._segmentsById[itemRemoved.id];
				delete this._segmentsByPid[itemRemoved.pid];

				removed.push(itemRemoved);
			}
		}

		return removed;
	}

	/**
	 * Removes all segments that match a given predicate function.
	 * After removing the segments, emits a `segments.remove` event.
	 */
	private _removeSegments(predicate: (segment: Segment) => boolean): Segment[] {
		const indexes = this._findSegment(predicate);

		const removed = this._removeIndexes(indexes);

		this._peaks.emit("segments.remove", {
			segments: removed,
		});

		return removed;
	}

	remove(segment: Segment): Segment[] {
		return this._removeSegments((s: Segment) => s === segment);
	}

	removeById(segmentId: string): Segment[] {
		return this._removeSegments((segment: Segment) => segment.id === segmentId);
	}

	/**
	 * Removes any segments with the given start time, and optional end time.
	 */
	removeByTime(startTime: number, endTime?: number): Segment[] {
		endTime = typeof endTime === "number" ? endTime : 0;

		let filter: (segment: Segment) => boolean;

		if (endTime > 0) {
			filter = (segment: Segment) =>
				segment.startTime === startTime && segment.endTime === endTime;
		} else {
			filter = (segment: Segment) => segment.startTime === startTime;
		}

		return this._removeSegments(filter);
	}

	/**
	 * Removes all segments.
	 * After removing the segments, emits a `segments.remove_all` event.
	 */
	removeAll(): void {
		this._segments = [];
		this._segmentsById = {};
		this._segmentsByPid = {};
		this._peaks.emit("segments.remove_all");
	}

	setInserting(value: boolean): void {
		this._isInserting = value;
	}

	isInserting(): boolean {
		return this._isInserting;
	}
}

export default WaveformSegments;
