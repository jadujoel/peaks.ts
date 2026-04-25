import type WaveformData from "waveform-data";
import type { AudioDriver, AudioSource } from "./driver/audio/types";
import type {
	CanvasDriver,
	DriverLayer,
	PeaksPointerEvent,
	XY,
} from "./driver/types";
import type { PeaksEvents, PointerInteractionName } from "./events";
import type { PeaksGroup } from "./peaks-group";
import type { PeaksNode } from "./peaks-node";

import type { Point } from "./point";
import type { ResultCallback } from "./result-callback";
import type { Segment } from "./segment";
import type { GridStep, TempoMap } from "./tempo-map";
import type { SnapKind, TempoMapContext } from "./tempo-map-context";
import type { WaveformColor } from "./utils";

// ─── Logger ─────────────────────────────────────────────────────────
export type Logger = (...args: unknown[]) => void;

// ─── Peaks Options ─────────────────────────────────────────────────
export interface ViewOptions {
	// TODO: make most of these options optional with reasonable defaults
	readonly container?: HTMLDivElement;
	readonly playheadColor: string;
	readonly playheadTextColor: string;
	readonly playheadBackgroundColor: string;
	readonly playheadPadding: number;
	readonly playheadWidth: number;
	readonly playheadFontFamily: string;
	readonly playheadFontSize: number;
	readonly playheadFontStyle: string;
	readonly axisGridlineColor: string;
	readonly showAxisLabels: boolean;
	readonly axisTopMarkerHeight: number;
	readonly axisBottomMarkerHeight: number;
	readonly axisLabelColor: string;
	readonly fontFamily: string;
	readonly fontSize: number;
	readonly fontStyle: string;
	readonly formatAxisTime?: (time: number) => string;
	readonly formatPlayheadTime?: (time: number) => string;
	readonly timeLabelPrecision: number;
	readonly enablePoints: boolean;
	readonly enableSegments: boolean;
	readonly showPlayheadTime?: boolean;
}

export interface ZoomviewOptions extends ViewOptions {
	readonly playheadClickTolerance: number;
	readonly waveformColor: WaveformColor;
	readonly wheelMode: string;
	readonly autoScroll: boolean;
	readonly autoScrollOffset: number;
	readonly enableEditing: boolean;
	readonly playedWaveformColor?: WaveformColor;
	readonly segmentOptions: SegmentDisplayOptions;
}

export interface OverviewOptions extends ViewOptions {
	readonly waveformColor: WaveformColor;
	readonly highlightColor: string;
	readonly highlightStrokeColor: string;
	readonly highlightOpacity: number;
	readonly highlightOffset: number;
	readonly highlightCornerRadius: number;
	readonly enableEditing: boolean;
	readonly playedWaveformColor?: WaveformColor;
	readonly segmentOptions: SegmentDisplayOptions;
}

export interface SegmentDisplayOptions {
	readonly overlay: boolean;
	readonly markers: boolean;
	readonly startMarkerColor: string;
	readonly endMarkerColor: string;
	readonly markerLabelColor: string;
	readonly labelColor: string;
	readonly waveformColor: string;
	readonly overlayColor: string;
	readonly overlayOpacity: number;
	readonly overlayBorderColor: string;
	readonly overlayBorderWidth: number;
	readonly overlayCornerRadius: number;
	readonly overlayOffset: number;
	readonly overlayLabelAlign: string;
	readonly overlayLabelVerticalAlign: string;
	readonly overlayLabelPadding: number;
	readonly overlayLabelColor: string;
	readonly overlayFontFamily: string;
	readonly overlayFontSize: number;
	readonly overlayFontStyle: string;
}

export interface ScrollbarDisplayOptions {
	readonly container?: HTMLDivElement;
	readonly color: string;
	readonly minWidth: number;
}

export interface PeaksOptions {
	readonly zoomLevels: readonly number[];
	readonly waveformCache: boolean;
	readonly mediaElement?: HTMLMediaElement;
	readonly mediaUrl?: string;
	readonly dataUri?: Record<string, string>;
	readonly withCredentials: boolean;
	readonly waveformData?: Record<string, unknown>;
	readonly webAudio?: WebAudioOptions;
	readonly nudgeIncrement: number;
	readonly pointMarkerColor: string;
	readonly pointMarkerLabelColor: string;
	readonly createSegmentMarker: (
		options: CreateSegmentMarkerOptions,
	) => Marker | undefined;
	readonly createSegmentLabel: (
		options: CreateSegmentLabelOptions,
	) => PeaksNode | undefined;
	readonly createPointMarker: (
		options: CreatePointMarkerOptions,
	) => Marker | undefined;
	readonly driver: CanvasDriver;
	readonly logger: Logger;
	readonly overview: OverviewOptions;
	readonly zoomview: ZoomviewOptions;
	readonly scrollbar: ScrollbarDisplayOptions;
	readonly segmentOptions?: SegmentDisplayOptions;
	readonly audio?: AudioDriver;
	readonly tempoMap?: TempoMap;
	readonly grid?: GridDisplayOptions;
	readonly snap?: SnapOptions;
	readonly tempoMapContext?: TempoMapContext;
}

export interface GridDisplayOptions {
	readonly step?: GridStep;
	readonly color?: string;
	readonly opacity?: number;
	readonly showOnZoomview?: boolean;
	readonly showOnOverview?: boolean;
	readonly minPixelSpacing?: number;
	readonly showBarLines?: boolean;
}

export interface SnapOptions {
	readonly segments?: boolean;
	readonly segmentMarkers?: boolean;
	readonly points?: boolean;
	readonly insertSegment?: boolean;
	readonly step?: GridStep;
}

export interface WebAudioOptions {
	readonly context?: AudioContext;
	readonly buffer?: AudioBuffer;
	readonly multiChannel?: boolean;
	readonly scale?: number;
}

// ─── Init Options (user-provided) ──────────────────────────────────
// Remove unsupported stuff
// refactor so that its more specific, for exxample multiple of these properties cannot be used together
// some props rule out other props
export interface PeaksConfiguration {
	readonly mediaElement?: HTMLMediaElement;
	readonly audio?: AudioDriver;
	readonly zoomLevels?: readonly number[];
	readonly waveformCache?: boolean;
	readonly mediaUrl?: string;
	readonly dataUri?: Record<string, string>;
	readonly withCredentials?: boolean;
	readonly waveformData?: Record<string, unknown>;
	readonly webAudio?: WebAudioOptions;
	readonly audioContext?: AudioContext;
	readonly nudgeIncrement?: number;
	readonly pointMarkerColor?: string;
	readonly pointMarkerLabelColor?: string;
	readonly createSegmentMarker?: (
		options: CreateSegmentMarkerOptions,
	) => Marker | undefined;
	readonly createSegmentLabel?: (
		options: CreateSegmentLabelOptions,
	) => PeaksNode | undefined;
	readonly createPointMarker?: (options: CreatePointMarkerOptions) => Marker;
	readonly driver?: CanvasDriver;
	readonly logger?: Logger;
	readonly overview?: Partial<Omit<OverviewOptions, "segmentOptions">> & {
		segmentOptions?: Partial<SegmentDisplayOptions>;
	};
	readonly zoomview?: Partial<Omit<ZoomviewOptions, "segmentOptions">> & {
		segmentOptions?: Partial<SegmentDisplayOptions>;
	};
	readonly scrollbar?: Partial<ScrollbarDisplayOptions>;
	readonly segmentOptions?: Partial<SegmentDisplayOptions>;
	readonly keyboard?: boolean;
	readonly emitCueEvents?: boolean;
	readonly segments?: readonly SegmentOptions[];
	readonly points?: readonly PointOptions[];
	readonly showPlayheadTime?: boolean;
	readonly axisGridlineColor?: string;
	readonly axisLabelColor?: string;
	readonly axisTopMarkerHeight?: number;
	readonly axisBottomMarkerHeight?: number;
	readonly fontFamily?: string;
	readonly fontSize?: number;
	readonly fontStyle?: string;
	readonly formatAxisTime?: (time: number) => string;
	readonly formatPlayheadTime?: (time: number) => string;
	readonly playheadBackgroundColor?: string;
	readonly playheadColor?: string;
	readonly playheadTextColor?: string;
	readonly playheadPadding?: number;
	readonly playheadWidth?: number;
	readonly playedWaveformColor?: WaveformColor;
	readonly showAxisLabels?: boolean;
	readonly timeLabelPrecision?: number;
	readonly enablePoints?: boolean;
	readonly enableSegments?: boolean;
	readonly enableEditing?: boolean;
	readonly highlightColor?: string;
	readonly highlightStrokeColor?: string;
	readonly highlightOpacity?: number;
	readonly highlightOffset?: number;
	readonly highlightCornerRadius?: number;
	readonly waveformColor?: WaveformColor;
	readonly tempoMap?: TempoMap;
	readonly grid?: GridDisplayOptions;
	readonly snap?: SnapOptions;
}

// ─── Segment / Point Options ────────────────────────────────────────
export interface SegmentOptions {
	[key: string]: unknown;
	readonly id?: string;
	readonly startTime: number;
	readonly endTime: number;
	readonly labelText?: string;
	readonly color?: string;
	readonly borderColor?: string;
	readonly markers?: boolean;
	readonly overlay?: boolean;
	readonly editable?: boolean;
	readonly snap?: boolean;
}

export interface SegmentUpdateOptions {
	[key: string]: unknown;
	readonly id?: string;
	readonly startTime?: number;
	readonly endTime?: number;
	readonly labelText?: string;
	readonly color?: string;
	readonly borderColor?: string;
	readonly editable?: boolean;
}

export interface PointOptions {
	[key: string]: unknown;
	readonly id?: string;
	readonly time: number;
	readonly labelText?: string;
	readonly color?: string;
	readonly editable?: boolean;
	readonly snap?: boolean;
}

export interface PointUpdateOptions {
	[key: string]: unknown;
	readonly id?: string;
	readonly time?: number;
	readonly labelText?: string;
	readonly color?: string;
	readonly editable?: boolean;
}

// ─── Marker interfaces ─────────────────────────────────────────────
export interface Marker {
	/**
	 * Called exactly once by the owning {@link PointMarker} or
	 * {@link SegmentMarker} after its group has been created. Use this to
	 * attach shapes to the supplied group.
	 */ init(group: PeaksGroup): void;
	fitToView(): void;
	update(options: MarkerUpdateOptions): void;
	dispose(): void;
}

export interface MarkerUpdateOptions {
	readonly editable?: boolean;
	readonly time?: number;
}

export interface CreateSegmentMarkerOptions {
	readonly segment: Segment;
	readonly editable: boolean;
	readonly startMarker: boolean;
	readonly color: string;
	readonly labelColor?: string;
	readonly fontFamily: string;
	readonly fontSize: number;
	readonly fontStyle: string;
	readonly layer: SegmentsLayerAPI;
	readonly view: string;
	readonly segmentOptions: SegmentDisplayOptions;
}

export interface CreateSegmentLabelOptions {
	readonly segment: Segment;
	readonly view: string;
	readonly layer: SegmentsLayerAPI;
	readonly color?: string;
	readonly fontFamily: string;
	readonly fontSize: number;
	readonly fontStyle: string;
}

export interface CreatePointMarkerOptions {
	readonly point: Point;
	readonly draggable?: boolean;
	readonly editable?: boolean;
	readonly color?: string;
	readonly labelColor?: string;
	readonly fontFamily?: string;
	readonly fontSize?: number;
	readonly fontStyle?: string;
	readonly layer?: PointsLayerAPI;
	readonly view?: string;
}

// ─── Layer APIs (for marker factories) ──────────────────────────────
export interface SegmentsLayerAPI {
	isEditingEnabled(): boolean;
	formatTime(time: number): string;
	getHeight(): number;
	getDriver(): CanvasDriver;
	moveSegmentMarkersToTop(): void;
}

export interface PointsLayerAPI {
	formatTime(time: number): string;
	getHeight(): number;
	getDriver(): CanvasDriver;
}

// ─── View API ───────────────────────────────────────────────────────
export interface WaveformViewAPI {
	getName(): string;
	getWidth(): number;
	getHeight(): number;
	getStartTime(): number;
	getEndTime(): number;
	getFrameOffset(): number;
	getAmplitudeScale(): number;
	getViewOptions(): ZoomviewOptions | OverviewOptions;
	getDriver(): CanvasDriver;
	timeToPixels(time: number): number;
	timeToPixelOffset(time: number): number;
	pixelsToTime(pixels: number): number;
	pixelOffsetToTime(offset: number): number;
	formatTime(time: number): string;
	getWaveformData(): WaveformData | undefined;
	isSegmentDraggingEnabled(): boolean;
	isSeekEnabled(): boolean;
	getMinSegmentDragWidth(): number;
	getSegmentDragMode(): string;
	updatePlayheadTime(time: number): void;
	drawWaveformLayer(): void;
	playheadPosChanged?(time: number): void;
	height: number;
}

// ─── Peaks Instance ─────────────────────────────────────────────────
export interface PeaksInstance {
	readonly options: PeaksOptions;
	readonly events: PeaksEvents;
	readonly player: PlayerInstance;
	readonly segments: SegmentsInstance;
	readonly points: PointsInstance;
	readonly zoom: ZoomInstance;
	readonly views: ViewControllerInstance;
	readonly logger: Logger;
	getWaveformData(): WaveformData | undefined;
}

// Lightweight interface for Player (to avoid circular imports)
export interface PlayerInstance {
	init(): Promise<void>;
	dispose(): void;
	play(): Promise<void>;
	pause(): void;
	isPlaying(): boolean;
	isSeeking(): boolean;
	getCurrentTime(): number;
	getDuration(): number;
	seek(time: number): void;
	playSegment(segment: Segment, loop: boolean): Promise<void>;
	playLooped(): Promise<void>;
	setSource(options: SetSourceOptions): Promise<void>;
}

export interface SegmentsInstance {
	add(
		...args: (SegmentOptions | SegmentOptions[] | readonly SegmentOptions[])[]
	): Segment | Segment[];
	getSegments(): Segment[];
	getSegment(id: string): Segment | undefined;
	getSegmentsAtTime(time: number): Segment[];
	find(startTime: number, endTime: number): Segment[];
	findPreviousSegment(segment: Segment): Segment | undefined;
	findNextSegment(segment: Segment): Segment | undefined;
	remove(segment: Segment): Segment[];
	removeById(segmentId: string): Segment[];
	removeByTime(startTime: number, endTime?: number): Segment[];
	removeAll(): void;
	setInserting(value: boolean): void;
	isInserting(): boolean;
	updateSegmentId(segment: Segment, newId: string): void;
}

export interface PointsInstance {
	add(
		...args: readonly PointOptions[] | readonly [readonly PointOptions[]]
	): Point | Point[];
	getPoints(): Point[];
	getPoint(id: string): Point | undefined;
	find(startTime: number, endTime: number): Point[];
	remove(point: Point): Point[];
	removeById(pointId: string): Point[];
	removeByTime(time: number): Point[];
	removeAll(): void;
	updatePointId(point: Point, newId: string): void;
}

export interface ZoomInstance {
	setLevels(zoomLevels: readonly number[]): void;
	zoomIn(): void;
	zoomOut(): void;
	setIndex(zoomLevelIndex: number, forceUpdate: boolean): void;
	getIndex(): number;
	getLevel(): number;
}

export interface ViewControllerInstance {
	createOverview(container: HTMLDivElement): Promise<unknown>;
	createZoomview(container: HTMLDivElement): Promise<unknown>;
	createScrollbar(container: HTMLDivElement): Promise<unknown>;
	destroyOverview(): void;
	destroyZoomview(): void;
	dispose(): void;
	/** Lower-level accessor that returns either view as the union type. */
	getView(name?: string): WaveformViewLike | undefined;
	/** Typed accessor for the zoomable waveform view. */
	getZoomview(): WaveformZoomviewAPI | undefined;
	/** Typed accessor for the overview waveform view. */
	getOverview(): WaveformOverviewAPI | undefined;
	getScrollbar(): unknown;
}

// Common color/scale surface implemented by both views.
export interface WaveformViewColorAPI extends WaveformViewLike {
	setWaveformColor(color: WaveformColor): void;
	setPlayedWaveformColor(color: WaveformColor | undefined): void;
	setAxisLabelColor(color: string): void;
	setAxisGridlineColor(color: string): void;
	setPlayheadColor(color: string): void;
	setPlayheadTextColor(color: string): void;
	setSegmentStartMarkerColor(color: string): void;
	setSegmentEndMarkerColor(color: string): void;
	setAmplitudeScale(scale: number): undefined | never;
}

// Public surface of the zoomable waveform view that consumers wire to UI.
export interface WaveformZoomviewAPI extends WaveformViewColorAPI {
	enableAutoScroll(enable: boolean, options?: { offset?: number }): void;
	setWaveformDragMode(mode: string): void;
	setSegmentDragMode(mode: string): void;
	setTempoMap(map: TempoMap | undefined): void;
	getTempoMap(): TempoMap | undefined;
	setGridStep(step: GridStep): void;
	getGridStep(): GridStep;
	setGridVisible(visible: boolean): void;
	setSnapEnabled(kind: SnapKind, enabled: boolean): void;
	isSnapEnabled(kind: SnapKind): boolean;
	setSnapStep(step: GridStep | undefined): void;
}

// Public surface of the overview waveform view that consumers wire to UI.
export interface WaveformOverviewAPI extends WaveformViewColorAPI {
	setHighlightColor(color: string): void;
}

// Lighter view interface for cross-referencing
// `setZoom` is only implemented by the zoom view, so it is optional here
// since `getView()` may return either an overview or a zoom view.
export interface WaveformViewLike {
	getStartTime(): number;
	getEndTime(): number;
	setWaveformData(waveformData: WaveformData): void;
	setZoom?(options: SetZoomOptions): boolean;
}

export interface SetZoomOptions {
	readonly scale?: number;
}

// ─── Set Source Options ─────────────────────────────────────────────
//
// `Peaks.setSource(options)` accepts both the audio-source DTO consumed
// by every {@link AudioDriver} and a few peaks-level extras (zoom
// levels). Drivers ignore unknown fields.
export interface SetSourceOptions extends AudioSource {
	readonly zoomLevels?: readonly number[];
}

export type { AudioDriver, AudioSource } from "./driver/audio/types";

// ─── Mouse drag handler interfaces ─────────────────────────────────
export interface MouseDragHandlers {
	readonly onMouseDown: (mousePosX: number, segment?: PeaksGroup) => void;
	readonly onMouseMove: (mousePosX: number) => void;
	readonly onMouseUp: (mousePosX: number) => void;
}

// ─── Waveform builder callback ──────────────────────────────────────
export type WaveformBuilderCallback = ResultCallback<
	Error | TypeError | DOMException,
	WaveformData
>;

export type { XY } from "./driver/types";

// ─── Segment Shape interfaces ──────────────────────────────────────
export interface SegmentMarkerOptions {
	readonly segment: Segment;
	readonly segmentShape?: SegmentShapeAPI;
	readonly editable: boolean;
	readonly startMarker: boolean;
	readonly marker: Marker;
	onClick: (
		marker: SegmentMarkerAPI,
		event: PeaksPointerEvent<MouseEvent>,
	) => void;
	onDragStart: (
		marker: SegmentMarkerAPI,
		event: PeaksPointerEvent<MouseEvent>,
	) => void;
	onDragMove: (
		marker: SegmentMarkerAPI,
		event: PeaksPointerEvent<MouseEvent>,
	) => void;
	onDragEnd: (
		marker: SegmentMarkerAPI,
		event: PeaksPointerEvent<MouseEvent>,
	) => void;
	dragBoundFunc: (marker: SegmentMarkerAPI, pos: XY) => XY;
}

export interface SegmentMarkerAPI {
	getX(): number;
	setX(x: number): void;
	getWidth(): number;
	getAbsolutePosition(): XY;
	isStartMarker(): boolean;
	update(options: Record<string, unknown>): void;
	fitToView(): void;
	addToLayer(layer: DriverLayer): void;
	moveToTop(): void;
	dispose(): void;
	startDrag(): void;
	stopDrag(): void;
}

export interface SegmentShapeAPI {
	getSegment(): Segment;
	getStartMarker(): SegmentMarkerAPI | undefined;
	getEndMarker(): SegmentMarkerAPI | undefined;
	isDragging(): boolean;
	moveMarkersToTop(): void;
	startDrag(): void;
	stopDrag(): void;
	enableSegmentDragging(enable: boolean): void;
	update(options?: Record<string, unknown>): void;
	fitToView(): void;
	addToLayer(layer: DriverLayer): void;
	dispose(): void;
	segmentClicked(
		eventName: PointerInteractionName,
		event: SegmentClickEvent,
	): void;
}

export interface PointMarkerOptions {
	readonly point: Point;
	readonly marker: Marker;
	readonly draggable?: boolean;
	onDragStart: (event: PeaksPointerEvent<MouseEvent>, point: Point) => void;
	onDragMove: (event: PeaksPointerEvent<MouseEvent>, point: Point) => void;
	onDragEnd: (event: PeaksPointerEvent<MouseEvent>, point: Point) => void;
	dragBoundFunc: (pos: { x: number; y: number }) => { x: number; y: number };
	onMouseEnter: (event: PeaksPointerEvent<MouseEvent>, point: Point) => void;
	onMouseLeave: (event: PeaksPointerEvent<MouseEvent>, point: Point) => void;
}

export interface PointMarkerAPI {
	getPoint(): Point;
	getX(): number;
	setX(x: number): void;
	getWidth(): number;
	getAbsolutePosition(): { x: number; y: number };
	update(options: Record<string, unknown>): void;
	fitToView(): void;
	addToLayer(layer: DriverLayer): void;
	dispose(): void;
}
// ─── Waveform Shape options ─────────────────────────────────────────
export interface WaveformShapeOptions {
	readonly color: WaveformColor;
	readonly view: WaveformViewAPI;
	readonly segment?: SegmentOptions;
}

// ─── Event Payloads ─────────────────────────────────────────────────
export interface SegmentClickEvent {
	readonly segment: Segment;
	readonly evt: MouseEvent;
	preventViewEvent: () => void;
}

export interface SegmentDragEvent {
	readonly segment: Segment;
	readonly marker: boolean;
	readonly startMarker: boolean;
	readonly evt: MouseEvent;
}
