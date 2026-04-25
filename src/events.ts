import { TypedEventTarget } from "@jadujoel/typed-event-target";
import type { Point } from "./point";
import type { Segment } from "./segment";
import type { GridStep, TempoMap } from "./tempo-map";
import type { SnapKind } from "./tempo-map-context";
import type { PointUpdateOptions, SegmentUpdateOptions } from "./types";

export type {
	EventFor,
	TypedEventListener,
	TypedEventListenerObject,
} from "@jadujoel/typed-event-target";

/**
 * Empty payload type used for events that carry no data.
 *
 * `TypedEventTarget` requires a payload object, so events with no payload use
 * an object with no required keys.
 */
export type EmptyPayload = Record<string, never>;

/**
 * Mouse-related event payloads from a {@link Point} marker.
 */
export type PointMouseEvent = {
	readonly point: Point;
	readonly evt: MouseEvent;
};

/**
 * Drag-related event payloads from a {@link Point} marker.
 */
export type PointDragEvent = PointMouseEvent;

/**
 * Click-related event payload from a {@link Point} marker.
 */
export type PointClickEvent = {
	readonly point: Point;
	readonly evt: MouseEvent;
	readonly preventViewEvent: () => void;
};

/**
 * Mouse-related event payload from a {@link Segment} overlay.
 */
export type SegmentMouseEvent = {
	readonly segment: Segment;
	readonly evt: MouseEvent;
};

/**
 * Drag-related event payload from a {@link Segment}.
 */
export type SegmentDragPayload = {
	readonly segment: Segment;
	readonly marker: boolean;
	readonly startMarker: boolean;
	readonly evt: MouseEvent;
};

/**
 * Click-related event payload from a {@link Segment}.
 */
export type SegmentClickPayload = {
	readonly segment: Segment;
	readonly evt: MouseEvent;
	readonly preventViewEvent: () => void;
};

/**
 * Click event payload for the zoomview/overview waveform stages.
 */
export type ViewClickEvent = {
	readonly evt: MouseEvent;
	readonly time: number;
};

/**
 * The closed set of event names emitted on the Peaks event bus, with
 * a payload type for each name.
 */
export type PeaksEventMap = {
	// ── Player events ────────────────────────────────────────────────
	readonly "player.canplay": EmptyPayload;
	readonly "player.error": { readonly error: unknown };
	readonly "player.playing": { readonly time: number };
	readonly "player.pause": { readonly time: number };
	readonly "player.seeked": { readonly time: number };
	readonly "player.timeupdate": { readonly time: number };
	readonly "player.ended": EmptyPayload;
	readonly "player.looped": EmptyPayload;

	// ── Keyboard events ──────────────────────────────────────────────
	readonly "keyboard.space": EmptyPayload;
	readonly "keyboard.tab": EmptyPayload;
	readonly "keyboard.left": EmptyPayload;
	readonly "keyboard.right": EmptyPayload;
	readonly "keyboard.shift_left": EmptyPayload;
	readonly "keyboard.shift_right": EmptyPayload;

	// ── Points lifecycle / interaction ──────────────────────────────
	readonly "points.add": { readonly points: readonly Point[] };
	readonly "points.remove": { readonly points: readonly Point[] };
	readonly "points.remove_all": EmptyPayload;
	readonly "points.update": {
		readonly point: Point;
		readonly options: PointUpdateOptions;
	};
	readonly "points.dragstart": PointDragEvent;
	readonly "points.dragmove": PointDragEvent;
	readonly "points.dragend": PointDragEvent;
	readonly "points.mouseenter": PointMouseEvent;
	readonly "points.mouseleave": PointMouseEvent;
	readonly "points.click": PointClickEvent;
	readonly "points.dblclick": PointClickEvent;
	readonly "points.contextmenu": PointClickEvent;
	readonly "points.enter": { readonly point: Point; readonly time: number };

	// ── Segments lifecycle / interaction ────────────────────────────
	readonly "segments.add": {
		readonly segments: readonly Segment[];
		readonly insert?: boolean;
	};
	readonly "segments.remove": { readonly segments: readonly Segment[] };
	readonly "segments.remove_all": EmptyPayload;
	readonly "segments.update": {
		readonly segment: Segment;
		readonly options: SegmentUpdateOptions;
	};
	readonly "segments.dragstart": SegmentDragPayload;
	readonly "segments.dragmove": SegmentDragPayload;
	readonly "segments.dragged": SegmentDragPayload;
	readonly "segments.dragend": SegmentDragPayload;
	readonly "segments.mouseenter": SegmentMouseEvent;
	readonly "segments.mouseleave": SegmentMouseEvent;
	readonly "segments.mousedown": SegmentMouseEvent;
	readonly "segments.mouseup": SegmentMouseEvent;
	readonly "segments.click": SegmentClickPayload;
	readonly "segments.dblclick": SegmentClickPayload;
	readonly "segments.contextmenu": SegmentClickPayload;
	readonly "segments.insert": { readonly segment: Segment };
	readonly "segments.enter": {
		readonly segment: Segment;
		readonly time: number;
	};
	readonly "segments.exit": {
		readonly segment: Segment;
		readonly time: number;
	};

	// ── View / zoom events ───────────────────────────────────────────
	readonly "zoomview.click": ViewClickEvent;
	readonly "zoomview.dblclick": ViewClickEvent;
	readonly "zoomview.contextmenu": ViewClickEvent;
	readonly "zoomview.update": {
		readonly startTime: number;
		readonly endTime: number;
	};
	readonly "overview.click": ViewClickEvent;
	readonly "overview.dblclick": ViewClickEvent;
	readonly "overview.contextmenu": ViewClickEvent;
	readonly "zoom.update": {
		readonly currentZoom: number;
		readonly previousZoom: number;
	};

	// ── Tempo map / grid / snap ─────────────────────────────────────
	readonly "grid.update": {
		readonly tempoMap: TempoMap | undefined;
		readonly step: GridStep;
	};
	readonly "snap.apply": {
		readonly kind: SnapKind;
		readonly rawTime: number;
		readonly snappedTime: number;
		readonly entityId?: string;
	};
};

/**
 * Strongly-typed event bus for {@link PeaksInstance}.
 */
export type PeaksEvents = TypedEventTarget<PeaksEventMap>;

/**
 * Suffix names allowed on the dynamic `points.<name>` and
 * `segments.<name>` and `<viewName>.<name>` dispatches.
 */
export type PointerInteractionName = "click" | "dblclick" | "contextmenu";

export type ViewName = "zoomview" | "overview";

/**
 * Creates a new typed Peaks event bus.
 */
export function createPeaksEvents(): PeaksEvents {
	return TypedEventTarget.from<PeaksEventMap>();
}
