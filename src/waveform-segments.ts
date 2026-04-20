import { Segment, validateSegmentOptions } from "./segment";
import type { PeaksInstance, SegmentOptions } from "./types";
import type { Writable } from "./utils";
import { extend, isNullOrUndefined } from "./utils";

/**
 * Handles all functionality related to the adding, removing and manipulation
 * of segments.
 */
export interface WaveformSegmentsFromOptions {
	readonly peaks: PeaksInstance;
}

export class WaveformSegments {
	private readonly peaks: PeaksInstance;
	private segments: Segment[];
	private segmentsById = new Map<string, Segment>();
	private segmentsByPid = new Map<number, Segment>();
	private segmentIdCounter: number;
	private segmentPid: number;
	private inserting: boolean;

	static from(options: WaveformSegmentsFromOptions): WaveformSegments {
		return new WaveformSegments(options.peaks);
	}

	private constructor(peaks: PeaksInstance) {
		this.peaks = peaks;
		this.segments = [];
		this.segmentIdCounter = 0;
		this.segmentPid = 0;
		this.inserting = false;
	}

	private getNextSegmentId(): string {
		return `peaks.segment.${this.segmentIdCounter++}`;
	}

	private getNextPid(): number {
		return this.segmentPid++;
	}

	private appendSegment(segment: Segment): void {
		this.segments.push(segment);

		this.segmentsById.set(segment.id, segment);
		this.segmentsByPid.set(segment.pid, segment);
	}

	/**
	 * Creates a new segment object.
	 *
	 * @throws {TypeError} If required segment options are missing or have the wrong type.
	 * @throws {RangeError} If the segment times are invalid.
	 * @throws {Error} If reserved or internal option names are provided.
	 */
	private createSegment(options: SegmentOptions): Segment | never {
		const segmentOptions = {} as Writable<SegmentOptions>;

		extend(segmentOptions, options as unknown as Record<string, unknown>);

		if (isNullOrUndefined(segmentOptions.id)) {
			segmentOptions.id = this.getNextSegmentId();
		}

		const pid = this.getNextPid();

		validateSegmentOptions(segmentOptions, false);

		const display = this.peaks.options.segmentOptions;
		return Segment.from({
			defaults: {
				markers: display?.markers ?? true,
				overlay: display?.overlay ?? false,
				overlayBorderColor: display?.overlayBorderColor ?? "",
				overlayColor: display?.overlayColor ?? "",
				waveformColor: display?.waveformColor ?? "",
			},
			options: segmentOptions,
			peaks: this.peaks,
			pid,
		});
	}

	getSegments(): Segment[] {
		return this.segments;
	}

	getSegment(id: string): Segment | undefined {
		return this.segmentsById.get(id);
	}

	getSegmentsAtTime(time: number): Segment[] {
		return this.segments.filter(
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
		return this.segments.filter((segment: Segment) =>
			segment.isVisible(startTime, endTime),
		);
	}

	private getSortedSegments(): Segment[] {
		return this.segments
			.slice()
			.sort((a: Segment, b: Segment) => a.startTime - b.startTime);
	}

	findPreviousSegment(segment: Segment): Segment | undefined {
		const sortedSegments = this.getSortedSegments();

		const index = sortedSegments.findIndex((s: Segment) => s.id === segment.id);

		if (index !== -1) {
			return sortedSegments[index - 1];
		}

		return undefined;
	}

	findNextSegment(segment: Segment): Segment | undefined {
		const sortedSegments = this.getSortedSegments();

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
		const segmentOptionsList: SegmentOptions[] = arrayArgs
			? (args[0] as SegmentOptions[])
			: (args as SegmentOptions[]);

		const created = segmentOptionsList.map((segmentOptions: SegmentOptions) => {
			const segment = this.createSegment(segmentOptions);

			if (this.segmentsById.has(segment.id)) {
				throw new Error("peaks.segments.add(): duplicate id");
			}

			return segment;
		});

		for (const segment of created) {
			this.appendSegment(segment);
		}

		this.peaks.emit("segments.add", {
			insert: this.inserting,
			segments: created,
		});

		return arrayArgs ? created : (created[0] as Segment);
	}

	/**
	 * Updates the lookup tables for a segment id change.
	 *
	 * @throws {Error} If the new segment id already exists.
	 */
	updateSegmentId(segment: Segment, newSegmentId: string): undefined | never {
		if (this.segmentsById.has(segment.id)) {
			if (this.segmentsById.has(newSegmentId)) {
				throw new Error("segment.update(): duplicate id");
			} else {
				this.segmentsById.delete(segment.id);
				this.segmentsById.set(newSegmentId, segment);
			}
		}
	}

	/**
	 * Returns the indexes of segments that match the given predicate.
	 */
	private findSegmentIndexes(
		predicate: (segment: Segment) => boolean,
	): number[] {
		const indexes: number[] = [];

		let i = 0;

		for (const segment of this.segments) {
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
	private removeIndexes(indexes: number[]): Segment[] {
		const removed: Segment[] = [];

		for (const idx of indexes) {
			const index = idx - removed.length;

			const itemRemoved = this.segments.splice(index, 1)[0];

			if (itemRemoved) {
				this.segmentsById.delete(itemRemoved.id);
				this.segmentsByPid.delete(itemRemoved.pid);

				removed.push(itemRemoved);
			}
		}

		return removed;
	}

	/**
	 * Removes all segments that match a given predicate function.
	 * After removing the segments, emits a `segments.remove` event.
	 */
	private removeSegments(predicate: (segment: Segment) => boolean): Segment[] {
		const indexes = this.findSegmentIndexes(predicate);

		const removed = this.removeIndexes(indexes);

		this.peaks.emit("segments.remove", {
			segments: removed,
		});

		return removed;
	}

	remove(segment: Segment): Segment[] {
		return this.removeSegments((s: Segment) => s === segment);
	}

	removeById(segmentId: string): Segment[] {
		return this.removeSegments((segment: Segment) => segment.id === segmentId);
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

		return this.removeSegments(filter);
	}

	/**
	 * Removes all segments.
	 * After removing the segments, emits a `segments.remove_all` event.
	 */
	removeAll(): void {
		this.segments = [];
		this.segmentsById.clear();
		this.segmentsByPid.clear();
		this.peaks.emit("segments.remove_all");
	}

	setInserting(value: boolean): void {
		this.inserting = value;
	}

	isInserting(): boolean {
		return this.inserting;
	}
}
