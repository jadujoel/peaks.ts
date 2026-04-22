import type WaveformData from "waveform-data";
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
import type { WaveformColor } from "./utils";

// ─── Logger ─────────────────────────────────────────────────────────
export type Logger = (...args: unknown[]) => void;

// ─── Player Adapter ─────────────────────────────────────────────────
export interface PlayerEventBus {
	readonly events: PeaksEvents;
}

export interface PlayerAdapter {
	init(peaks: PlayerEventBus): Promise<void> | void;
	dispose?(): void;
	play(): Promise<void> | void;
	pause(): void;
	isPlaying(): boolean;
	isSeeking(): boolean;
	getCurrentTime(): number;
	getDuration(): number;
	seek(time: number): void;
	/**
	 * Optional native segment playback. When implemented, the {@link PlayerInstance}
	 * delegates segment looping to the adapter (e.g. via sample-accurate
	 * AudioWorklet loop points) instead of polling boundaries on the main thread.
	 */
	playSegment?(segment: Segment, loop: boolean): Promise<void> | void;
	setSource?(options: SetSourceOptions): Promise<void>;
}

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
	readonly player?: PlayerAdapter;
}

export interface WebAudioOptions {
	readonly audioContext?: AudioContext;
	readonly audioBuffer?: AudioBuffer;
	readonly multiChannel?: boolean;
	readonly scale?: number;
}

// ─── Init Options (user-provided) ──────────────────────────────────
// TODO: use readonly wherever possible
// Remove unsupported stuff
// refactor so that its more specific, for exxample multiple of these properties cannot be used together
// some props rule out other props
export interface PeaksConfiguration {
	mediaElement?: HTMLMediaElement;
	player?: PlayerAdapter;
	zoomLevels?: readonly number[];
	waveformCache?: boolean;
	mediaUrl?: string;
	dataUri?: Record<string, string>;
	withCredentials?: boolean;
	waveformData?: Record<string, unknown>;
	webAudio?: WebAudioOptions;
	audioContext?: AudioContext;
	nudgeIncrement?: number;
	pointMarkerColor?: string;
	createSegmentMarker?: (
		options: CreateSegmentMarkerOptions,
	) => Marker | undefined;
	createSegmentLabel?: (
		options: CreateSegmentLabelOptions,
	) => PeaksNode | undefined;
	createPointMarker?: (options: CreatePointMarkerOptions) => Marker;
	driver?: CanvasDriver;
	logger?: Logger;
	overview?: Partial<Omit<OverviewOptions, "segmentOptions">> & {
		segmentOptions?: Partial<SegmentDisplayOptions>;
	};
	zoomview?: Partial<Omit<ZoomviewOptions, "segmentOptions">> & {
		segmentOptions?: Partial<SegmentDisplayOptions>;
	};
	scrollbar?: Partial<ScrollbarDisplayOptions>;
	segmentOptions?: Partial<SegmentDisplayOptions>;
	keyboard?: boolean;
	emitCueEvents?: boolean;
	segments?: readonly SegmentOptions[];
	points?: readonly PointOptions[];
	showPlayheadTime?: boolean;
	axisGridlineColor?: string;
	axisLabelColor?: string;
	axisTopMarkerHeight?: number;
	axisBottomMarkerHeight?: number;
	fontFamily?: string;
	fontSize?: number;
	fontStyle?: string;
	formatAxisTime?: (time: number) => string;
	formatPlayheadTime?: (time: number) => string;
	playheadBackgroundColor?: string;
	playheadColor?: string;
	playheadTextColor?: string;
	playheadPadding?: number;
	playheadWidth?: number;
	playedWaveformColor?: WaveformColor;
	showAxisLabels?: boolean;
	timeLabelPrecision?: number;
	enablePoints?: boolean;
	enableSegments?: boolean;
	enableEditing?: boolean;
	highlightColor?: string;
	highlightStrokeColor?: string;
	highlightOpacity?: number;
	highlightOffset?: number;
	highlightCornerRadius?: number;
	waveformColor?: WaveformColor;
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
	init(group: PeaksGroup): void;
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
	readonly fontFamily: string;
	readonly fontSize: number;
	readonly fontStyle: string;
}

export interface CreatePointMarkerOptions {
	readonly point: Point;
	readonly draggable?: boolean;
	readonly editable?: boolean;
	readonly color?: string;
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
	setZoomLevels(zoomLevels: readonly number[]): void;
	zoomIn(): void;
	zoomOut(): void;
	setZoom(zoomLevelIndex: number, forceUpdate: boolean): void;
	getZoom(): number;
	getZoomLevel(): number;
}

export interface ViewControllerInstance {
	createOverview(container: HTMLDivElement): unknown;
	createZoomview(container: HTMLDivElement): unknown;
	createScrollbar(container: HTMLDivElement): unknown;
	destroyOverview(): void;
	destroyZoomview(): void;
	dispose(): void;
	getView(name?: string): WaveformViewLike | undefined;
	getScrollbar(): unknown;
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
export interface SetSourceOptions {
	readonly mediaUrl?: string;
	readonly dataUri?: Record<string, string>;
	readonly waveformData?: Record<string, unknown>;
	readonly webAudio?: WebAudioOptions;
	readonly withCredentials?: boolean;
	readonly zoomLevels?: readonly number[];
}

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
