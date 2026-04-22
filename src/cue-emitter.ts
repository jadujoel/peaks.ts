import { Cue } from "./cue";
import type { Point } from "./point";
import type { Segment } from "./segment";
import type { PeaksInstance } from "./types";

// ─── Domain: data and pure functions ────────────────────────────────

export const CUE_EVENT_POINT_ENTER = "points.enter" as const;
export const CUE_EVENT_SEGMENT_ENTER = "segments.enter" as const;
export const CUE_EVENT_SEGMENT_EXIT = "segments.exit" as const;

export const TRACKED_EVENTS = [
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

export type CueEventName =
	| typeof CUE_EVENT_POINT_ENTER
	| typeof CUE_EVENT_SEGMENT_ENTER
	| typeof CUE_EVENT_SEGMENT_EXIT;

export interface BuildCuesInput {
	readonly points: readonly Point[];
	readonly segments: readonly Segment[];
}

export type TrackedEventNames = (typeof TRACKED_EVENTS)[number];

export interface CueEmitterFromOptions {
	readonly peaks: PeaksInstance;
}

export type ActiveSegmentsMap = Map<CueEventName | (string & {}), Segment>;

/**
 * Builds a time-sorted list of cues from the given points and segments.
 */
export function buildCues(input: BuildCuesInput): Cue[] {
	const cues: Cue[] = [];

	for (const point of input.points) {
		cues.push(Cue.from({ id: point.id, time: point.time, type: Cue.POINT }));
	}

	for (const segment of input.segments) {
		cues.push(
			Cue.from({
				id: segment.id,
				time: segment.startTime,
				type: Cue.SEGMENT_START,
			}),
		);
		cues.push(
			Cue.from({
				id: segment.id,
				time: segment.endTime,
				type: Cue.SEGMENT_END,
			}),
		);
	}

	cues.sort(Cue.sorter);
	return cues;
}

/**
 * Yields cues crossed by a playhead moving from `previousTime` to `time`,
 * in the order they are crossed. Direction is implied by the sign of
 * `time - previousTime`. Assumes `cues` is sorted by time ascending.
 */
export function* crossedCues(
	cues: readonly Cue[],
	previousTime: number,
	time: number,
): Generator<Cue> {
	const isForward = time > previousTime;
	const start = isForward ? 0 : cues.length - 1;
	const end = isForward ? cues.length : -1;
	const step = isForward ? 1 : -1;

	for (let i = start; isForward ? i < end : i > end; i += step) {
		const cue = cues[i];
		if (!cue) {
			continue;
		}

		const passedPrevious = isForward
			? cue.time > previousTime
			: cue.time < previousTime;
		if (!passedPrevious) {
			continue;
		}

		const reachedCurrent = isForward ? cue.time > time : cue.time < time;
		if (reachedCurrent) {
			return;
		}

		yield cue;
	}
}

/**
 * Maps a cue and playback direction to the emitter event it triggers.
 */
export function cueEventName(cue: Cue, isForward: boolean): CueEventName {
	if (cue.type === Cue.POINT) {
		return CUE_EVENT_POINT_ENTER;
	}

	const entering = isForward
		? cue.type === Cue.SEGMENT_START
		: cue.type === Cue.SEGMENT_END;

	return entering ? CUE_EVENT_SEGMENT_ENTER : CUE_EVENT_SEGMENT_EXIT;
}

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
 * CueEmitter emits `points.enter`, `segments.enter`, and `segments.exit`
 * events on a PeaksInstance as the playhead crosses cues.
 */
export class CueEmitter {
	private constructor(
		private readonly peaks: Pick<
			PeaksInstance,
			"points" | "segments" | "player" | "emit" | "on" | "off"
		>,
		private readonly cues: Cue[] = [],
		private readonly active: ActiveSegmentsMap = new Map(),
		private previousTime: number = -1,
		private rAFHandle: number = -1,
	) {}

	public static from(options: CueEmitterFromOptions): CueEmitter {
		const emitter = new CueEmitter(options.peaks);
		emitter.addEventHandlers();
		return emitter;
	}

	public dispose(): void {
		cancelAnimationFrame(this.rAFHandle);
		this.peaks.off("player.timeupdate", this.onTimeUpdate);
		this.peaks.off("player.playing", this.onPlaying);
		this.peaks.off("player.seeked", this.onSeeked);
		for (const event of TRACKED_EVENTS) {
			this.peaks.off(event, this.rebuildCues);
		}
		this.previousTime = -1;
	}

	private readonly rebuildCues = (): void => {
		const rebuilt = buildCues({
			points: this.peaks.points.getPoints(),
			segments: this.peaks.segments.getSegments(),
		});

		this.cues.length = 0;
		this.cues.push(...rebuilt);

		this.syncActiveSegments(this.peaks.player.getCurrentTime());
	};

	private emitCrossing(cue: Cue, time: number, isForward: boolean): void {
		const kind = cueEventName(cue, isForward);
		if (kind === CUE_EVENT_POINT_ENTER) {
			const point = this.peaks.points.getPoint(cue.id);
			if (!point) {
				return;
			}
			this.peaks.emit(kind, { point, time });
			return;
		}

		const segment = this.peaks.segments.getSegment(cue.id);
		if (!segment) {
			return;
		}

		if (kind === CUE_EVENT_SEGMENT_ENTER) {
			this.active.set(segment.id, segment);
		} else {
			this.active.delete(segment.id);
		}
		this.peaks.emit(kind, { segment, time });
	}

	private emitCueCrossings(time: number, previousTime: number): void {
		const isForward = time > previousTime;
		for (const cue of crossedCues(this.cues, previousTime, time)) {
			this.emitCrossing(cue, time, isForward);
		}
	}

	// onTimeUpdate and onAnimationFrame cooperate: when the window isn't
	// visible, rAF is throttled, so we fall back to timeupdate events.
	private readonly onTimeUpdate = (time: number): void => {
		if (isWindowVisible()) {
			return;
		}

		if (this.peaks.player.isPlaying() && !this.peaks.player.isSeeking()) {
			this.emitCueCrossings(time, this.previousTime);
		}

		this.previousTime = time;
	};

	private readonly onAnimationFrame = (): void => {
		const time = this.peaks.player.getCurrentTime();

		if (!this.peaks.player.isSeeking()) {
			this.emitCueCrossings(time, this.previousTime);
		}

		this.previousTime = time;

		if (this.peaks.player.isPlaying()) {
			this.rAFHandle = requestAnimationFrame(this.onAnimationFrame);
		}
	};

	private readonly onPlaying = (): void => {
		this.previousTime = this.peaks.player.getCurrentTime();
		this.rAFHandle = requestAnimationFrame(this.onAnimationFrame);
	};

	private readonly onSeeked = (time: number): void => {
		this.previousTime = time;
		this.syncActiveSegments(time);
	};

	/**
	 * Reconciles the active-segment set against the segments overlapping
	 * `time`, emitting segments.enter and segments.exit for the diff.
	 */
	private syncActiveSegments(time: number): void {
		const current = this.peaks.segments.getSegmentsAtTime(time);
		const currentIds = new Set(current.map((segment) => segment.id));

		for (const [id, segment] of this.active) {
			if (!currentIds.has(id)) {
				this.peaks.emit(CUE_EVENT_SEGMENT_EXIT, { segment, time });
				this.active.delete(id);
			}
		}

		for (const segment of current) {
			if (!this.active.has(segment.id)) {
				this.active.set(segment.id, segment);
				this.peaks.emit(CUE_EVENT_SEGMENT_ENTER, { segment, time });
			}
		}
	}

	private addEventHandlers(): void {
		this.peaks.on("player.timeupdate", this.onTimeUpdate);
		this.peaks.on("player.playing", this.onPlaying);
		this.peaks.on("player.seeked", this.onSeeked);

		for (const event of TRACKED_EVENTS) {
			this.peaks.on(event, this.rebuildCues);
		}

		this.rebuildCues();
	}
}
