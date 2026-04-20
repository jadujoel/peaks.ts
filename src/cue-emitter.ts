import { Cue } from "./cue";
import type { Point } from "./point";
import type { Segment } from "./segment";
import type { PeaksInstance } from "./types";

export const EVENT_TYPE_POINT = 0;
export const EVENT_TYPE_SEGMENT_ENTER = 1;
export const EVENT_TYPE_SEGMENT_EXIT = 2;

export const EVENT_TYPES = {
	forward: {
		[Cue.POINT]: EVENT_TYPE_POINT,
		[Cue.SEGMENT_START]: EVENT_TYPE_SEGMENT_ENTER,
		[Cue.SEGMENT_END]: EVENT_TYPE_SEGMENT_EXIT,
	},
	reverse: {
		[Cue.POINT]: EVENT_TYPE_POINT,
		[Cue.SEGMENT_START]: EVENT_TYPE_SEGMENT_EXIT,
		[Cue.SEGMENT_END]: EVENT_TYPE_SEGMENT_ENTER,
	},
} as const;

const EVENT_NAMES = {
	[EVENT_TYPE_POINT]: "points.enter",
	[EVENT_TYPE_SEGMENT_ENTER]: "segments.enter",
	[EVENT_TYPE_SEGMENT_EXIT]: "segments.exit",
} as const;

const EVENT_ATTRIBUTES = {
	[EVENT_TYPE_POINT]: "point",
	[EVENT_TYPE_SEGMENT_ENTER]: "segment",
	[EVENT_TYPE_SEGMENT_EXIT]: "segment",
} as const;

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

export function getSegmentIdComparator(id: string) {
	return function compareSegmentIds(segment: Segment) {
		return segment.id === id;
	};
}

export const EVENTS = [
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
] as const;

/**
 * CueEmitter is responsible for emitting `points.enter`,
 * `segments.enter`, and `segments.exit` events.
 */
export interface CueEmitterFromOptions {
	readonly peaks: PeaksInstance;
}

export class CueEmitter {
	private readonly cues: Cue[];
	private previousTime: number;
	private rAFHandle: number | undefined;
	private readonly activeSegments: Record<string, Segment>;

	static from(options: CueEmitterFromOptions): CueEmitter {
		const emitter = new CueEmitter(options.peaks);
		emitter.addEventHandlers();
		return emitter;
	}

	private constructor(public readonly peaks: PeaksInstance) {
		this.cues = [];
		this.previousTime = -1;
		this.updateCues = this.updateCues.bind(this);
		this.onPlaying = this.onPlaying.bind(this);
		this.onSeeked = this.onSeeked.bind(this);
		this.onTimeUpdate = this.onTimeUpdate.bind(this);
		this.onAnimationFrame = this.onAnimationFrame.bind(this);
		this.rAFHandle = undefined;
		this.activeSegments = {};
	}

	/**
	 * Updates the list of cues when points or segments are mutated.
	 */
	private updateCues(): void {
		const points = this.peaks.points.getPoints();
		const segments = this.peaks.segments.getSegments();

		this.cues.length = 0;

		for (const point of points) {
			this.cues.push(
				Cue.from({ time: point.time, type: Cue.POINT, id: point.id }),
			);
		}

		for (const segment of segments) {
			this.cues.push(
				Cue.from({
					time: segment.startTime,
					type: Cue.SEGMENT_START,
					id: segment.id,
				}),
			);
			this.cues.push(
				Cue.from({
					time: segment.endTime,
					type: Cue.SEGMENT_END,
					id: segment.id,
				}),
			);
		}

		this.cues.sort(Cue.sorter);

		const time = this.peaks.player.getCurrentTime();

		this.updateActiveSegments(time);
	}

	/**
	 * Emits events for any cues passed through during media playback.
	 */
	private onUpdate(time: number, previousTime: number): void {
		const isForward = time > previousTime;
		let start: number;
		let end: number;
		let step: number;

		if (isForward) {
			start = 0;
			end = this.cues.length;
			step = 1;
		} else {
			start = this.cues.length - 1;
			end = -1;
			step = -1;
		}

		// Cues are sorted.
		for (let i = start; isForward ? i < end : i > end; i += step) {
			const cue = this.cues[i];

			if (!cue) {
				continue;
			}

			if (isForward ? cue.time > previousTime : cue.time < previousTime) {
				if (isForward ? cue.time > time : cue.time < time) {
					break;
				}

				// Cue falls between time and previousTime.

				const marker = getPointOrSegment(this.peaks, cue);

				const eventType = isForward
					? EVENT_TYPES.forward[cue.type]
					: EVENT_TYPES.reverse[cue.type];

				if (eventType === undefined) {
					continue;
				}

				if (eventType === EVENT_TYPE_SEGMENT_ENTER) {
					this.activeSegments[(marker as Segment).id] = marker as Segment;
				} else if (eventType === EVENT_TYPE_SEGMENT_EXIT) {
					delete this.activeSegments[(marker as Segment).id];
				}

				const event: Record<string, unknown> = {
					time: time,
				};

				const attrKey = EVENT_ATTRIBUTES[eventType];
				const eventName = EVENT_NAMES[eventType];

				if (attrKey) {
					event[attrKey] = marker;
				}

				if (eventName) {
					this.peaks.emit(eventName, event);
				}
			}
		}
	}

	// The next handler and onAnimationFrame are bound together
	// when the window isn't in focus, rAF is throttled
	// falling back to timeUpdate.

	private onTimeUpdate(time: number): void {
		if (isWindowVisible()) {
			return;
		}

		if (this.peaks.player.isPlaying() && !this.peaks.player.isSeeking()) {
			this.onUpdate(time, this.previousTime);
		}

		this.previousTime = time;
	}

	private onAnimationFrame(): void {
		const time = this.peaks.player.getCurrentTime();

		if (!this.peaks.player.isSeeking()) {
			this.onUpdate(time, this.previousTime);
		}

		this.previousTime = time;

		if (this.peaks.player.isPlaying()) {
			this.rAFHandle = requestAnimationFrame(this.onAnimationFrame);
		}
	}

	private onPlaying(): void {
		this.previousTime = this.peaks.player.getCurrentTime();
		this.rAFHandle = requestAnimationFrame(this.onAnimationFrame);
	}

	private onSeeked(time: number): void {
		this.previousTime = time;

		this.updateActiveSegments(time);
	}

	/**
	 * The active segments is the set of all segments which overlap the current
	 * playhead position. This function updates that set and emits
	 * `segments.enter` and `segments.exit` events.
	 */
	private updateActiveSegments(time: number): void {
		const activeSegments = this.peaks.segments.getSegmentsAtTime(time);

		// Remove any segments no longer active.

		for (const id in this.activeSegments) {
			if (Object.hasOwn(this.activeSegments, id)) {
				const segment = activeSegments.find(getSegmentIdComparator(id));

				if (!segment) {
					this.peaks.emit("segments.exit", {
						segment: this.activeSegments[id],
						time: time,
					});

					delete this.activeSegments[id];
				}
			}
		}

		// Add new active segments.

		for (const segment of activeSegments) {
			if (!(segment.id in this.activeSegments)) {
				this.activeSegments[segment.id] = segment;

				this.peaks.emit("segments.enter", {
					segment: segment,
					time: time,
				});
			}
		}
	}

	private addEventHandlers(): void {
		this.peaks.on("player.timeupdate", this.onTimeUpdate);
		this.peaks.on("player.playing", this.onPlaying);
		this.peaks.on("player.seeked", this.onSeeked);

		for (const event of EVENTS) {
			this.peaks.on(event, this.updateCues);
		}

		this.updateCues();
	}

	private removeEventHandlers(): void {
		this.peaks.off("player.timeupdate", this.onTimeUpdate);
		this.peaks.off("player.playing", this.onPlaying);
		this.peaks.off("player.seeked", this.onSeeked);

		for (const event of EVENTS) {
			this.peaks.off(event, this.updateCues);
		}
	}

	destroy(): void {
		if (this.rAFHandle) {
			cancelAnimationFrame(this.rAFHandle);
			this.rAFHandle = undefined;
		}
		this.removeEventHandlers();
		this.previousTime = -1;
	}
}
