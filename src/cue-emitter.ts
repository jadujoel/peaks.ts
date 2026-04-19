import { Cue } from "./cue";
import type { Point } from "./point";
import type { Segment } from "./segment";
import type { PeaksInstance } from "./types";
import { objectHasProperty } from "./utils";

const isHeadless = /HeadlessChrome/.test(navigator.userAgent);

export function isWindowVisible(): boolean {
	if (isHeadless || navigator.webdriver) {
		return false;
	}

	return (
		typeof document === "object" &&
		"visibilityState" in document &&
		document.visibilityState === "visible"
	);
}

export const eventTypes: {
	forward: Record<number, number>;
	reverse: Record<number, number>;
} = {
	forward: {},
	reverse: {},
};

export const EVENT_TYPE_POINT = 0;
export const EVENT_TYPE_SEGMENT_ENTER = 1;
export const EVENT_TYPE_SEGMENT_EXIT = 2;

eventTypes.forward[Cue.POINT] = EVENT_TYPE_POINT;
eventTypes.forward[Cue.SEGMENT_START] = EVENT_TYPE_SEGMENT_ENTER;
eventTypes.forward[Cue.SEGMENT_END] = EVENT_TYPE_SEGMENT_EXIT;

eventTypes.reverse[Cue.POINT] = EVENT_TYPE_POINT;
eventTypes.reverse[Cue.SEGMENT_START] = EVENT_TYPE_SEGMENT_EXIT;
eventTypes.reverse[Cue.SEGMENT_END] = EVENT_TYPE_SEGMENT_ENTER;

const eventNames: Record<number, string> = {};

eventNames[EVENT_TYPE_POINT] = "points.enter";
eventNames[EVENT_TYPE_SEGMENT_ENTER] = "segments.enter";
eventNames[EVENT_TYPE_SEGMENT_EXIT] = "segments.exit";

const eventAttributes: Record<number, string> = {};

eventAttributes[EVENT_TYPE_POINT] = "point";
eventAttributes[EVENT_TYPE_SEGMENT_ENTER] = "segment";
eventAttributes[EVENT_TYPE_SEGMENT_EXIT] = "segment";

/**
 * Given a cue instance, returns the corresponding Point or Segment.
 *
 * @throws {Error} If the cue refers to a missing point or segment, or to an unknown cue type.
 */
export function getPointOrSegment(
	peaks: PeaksInstance,
	cue: Cue,
): Point | Segment | never {
	switch (cue.type) {
		case Cue.POINT: {
			const point = peaks.points.getPoint(cue.id);
			if (!point) {
				throw new Error(`getPointOrSegment: point not found: ${cue.id}`);
			}
			return point;
		}

		case Cue.SEGMENT_START:
		case Cue.SEGMENT_END: {
			const segment = peaks.segments.getSegment(cue.id);
			if (!segment) {
				throw new Error(`getPointOrSegment: segment not found: ${cue.id}`);
			}
			return segment;
		}

		default:
			throw new Error("getPointOrSegment: id not found?");
	}
}

function getSegmentIdComparator(id: string) {
	return function compareSegmentIds(segment: Segment) {
		return segment.id === id;
	};
}

const events = [
	"points.update",
	"points.dragmove",
	"points.add",
	"points.remove",
	"points.remove_all",
	"segments.update",
	"segments.dragged",
	"segments.add",
	"segments.remove",
	"segments.remove_all",
];

/**
 * CueEmitter is responsible for emitting `points.enter`,
 * `segments.enter`, and `segments.exit` events.
 */
export interface CueEmitterFromOptions {
	readonly peaks: PeaksInstance;
}

export class CueEmitter {
	private _cues: Cue[];
	private _peaks: PeaksInstance;
	private _previousTime: number;
	private _rAFHandle: number | undefined;
	private _activeSegments: Record<string, Segment>;

	static from(options: CueEmitterFromOptions): CueEmitter {
		return new CueEmitter(options.peaks);
	}

	private constructor(peaks: PeaksInstance) {
		this._cues = [];
		this._peaks = peaks;
		this._previousTime = -1;
		this._updateCues = this._updateCues.bind(this);
		this._onPlaying = this._onPlaying.bind(this);
		this._onSeeked = this._onSeeked.bind(this);
		this._onTimeUpdate = this._onTimeUpdate.bind(this);
		this._onAnimationFrame = this._onAnimationFrame.bind(this);
		this._rAFHandle = undefined;
		this._activeSegments = {};
		this._attachEventHandlers();
	}

	/**
	 * Updates the list of cues when points or segments are mutated.
	 */
	private _updateCues(): void {
		const points = this._peaks.points.getPoints();
		const segments = this._peaks.segments.getSegments();

		this._cues.length = 0;

		for (const point of points) {
			this._cues.push(
				Cue.from({ time: point.time, type: Cue.POINT, id: point.id }),
			);
		}

		for (const segment of segments) {
			this._cues.push(
				Cue.from({
					time: segment.startTime,
					type: Cue.SEGMENT_START,
					id: segment.id,
				}),
			);
			this._cues.push(
				Cue.from({
					time: segment.endTime,
					type: Cue.SEGMENT_END,
					id: segment.id,
				}),
			);
		}

		this._cues.sort(Cue.sorter);

		const time = this._peaks.player.getCurrentTime();

		this._updateActiveSegments(time);
	}

	/**
	 * Emits events for any cues passed through during media playback.
	 */
	private _onUpdate(time: number, previousTime: number): void {
		const isForward = time > previousTime;
		let start: number;
		let end: number;
		let step: number;

		if (isForward) {
			start = 0;
			end = this._cues.length;
			step = 1;
		} else {
			start = this._cues.length - 1;
			end = -1;
			step = -1;
		}

		// Cues are sorted.

		for (let i = start; isForward ? i < end : i > end; i += step) {
			const cue = this._cues[i];

			if (!cue) {
				continue;
			}

			if (isForward ? cue.time > previousTime : cue.time < previousTime) {
				if (isForward ? cue.time > time : cue.time < time) {
					break;
				}

				// Cue falls between time and previousTime.

				const marker = getPointOrSegment(this._peaks, cue);

				const eventType = isForward
					? eventTypes.forward[cue.type]
					: eventTypes.reverse[cue.type];

				if (eventType === undefined) {
					continue;
				}

				if (eventType === EVENT_TYPE_SEGMENT_ENTER) {
					this._activeSegments[(marker as Segment).id] = marker as Segment;
				} else if (eventType === EVENT_TYPE_SEGMENT_EXIT) {
					delete this._activeSegments[(marker as Segment).id];
				}

				const event: Record<string, unknown> = {
					time: time,
				};

				const attrKey = eventAttributes[eventType];
				const eventName = eventNames[eventType];

				if (attrKey) {
					event[attrKey] = marker;
				}

				if (eventName) {
					this._peaks.emit(eventName, event);
				}
			}
		}
	}

	// The next handler and onAnimationFrame are bound together
	// when the window isn't in focus, rAF is throttled
	// falling back to timeUpdate.

	private _onTimeUpdate(time: number): void {
		if (isWindowVisible()) {
			return;
		}

		if (this._peaks.player.isPlaying() && !this._peaks.player.isSeeking()) {
			this._onUpdate(time, this._previousTime);
		}

		this._previousTime = time;
	}

	private _onAnimationFrame(): void {
		const time = this._peaks.player.getCurrentTime();

		if (!this._peaks.player.isSeeking()) {
			this._onUpdate(time, this._previousTime);
		}

		this._previousTime = time;

		if (this._peaks.player.isPlaying()) {
			this._rAFHandle = requestAnimationFrame(this._onAnimationFrame);
		}
	}

	private _onPlaying(): void {
		this._previousTime = this._peaks.player.getCurrentTime();
		this._rAFHandle = requestAnimationFrame(this._onAnimationFrame);
	}

	private _onSeeked(time: number): void {
		this._previousTime = time;

		this._updateActiveSegments(time);
	}

	/**
	 * The active segments is the set of all segments which overlap the current
	 * playhead position. This function updates that set and emits
	 * `segments.enter` and `segments.exit` events.
	 */
	private _updateActiveSegments(time: number): void {
		const activeSegments = this._peaks.segments.getSegmentsAtTime(time);

		// Remove any segments no longer active.

		for (const id in this._activeSegments) {
			if (objectHasProperty(this._activeSegments, id)) {
				const segment = activeSegments.find(getSegmentIdComparator(id));

				if (!segment) {
					this._peaks.emit("segments.exit", {
						segment: this._activeSegments[id],
						time: time,
					});

					delete this._activeSegments[id];
				}
			}
		}

		// Add new active segments.

		for (const segment of activeSegments) {
			if (!(segment.id in this._activeSegments)) {
				this._activeSegments[segment.id] = segment;

				this._peaks.emit("segments.enter", {
					segment: segment,
					time: time,
				});
			}
		}
	}

	private _attachEventHandlers(): void {
		this._peaks.on("player.timeupdate", this._onTimeUpdate);
		this._peaks.on("player.playing", this._onPlaying);
		this._peaks.on("player.seeked", this._onSeeked);

		for (const event of events) {
			this._peaks.on(event, this._updateCues);
		}

		this._updateCues();
	}

	private _detachEventHandlers(): void {
		this._peaks.off("player.timeupdate", this._onTimeUpdate);
		this._peaks.off("player.playing", this._onPlaying);
		this._peaks.off("player.seeked", this._onSeeked);

		for (const event of events) {
			this._peaks.off(event, this._updateCues);
		}
	}

	destroy(): void {
		if (this._rAFHandle) {
			cancelAnimationFrame(this._rAFHandle);
			this._rAFHandle = undefined;
		}

		this._detachEventHandlers();

		this._previousTime = -1;
	}
}
