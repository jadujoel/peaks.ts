import type EventEmitter from "eventemitter3";
import type { Group } from "konva/lib/Group";
import type { Layer } from "konva/lib/Layer";
import type { KonvaEventObject } from "konva/lib/Node";
import type { Shape } from "konva/lib/Shape";
import type WaveformData from "waveform-data";

import type { Point } from "./point";
import type { ResultCallback } from "./result-callback";
import type { Segment } from "./segment";
import type { WaveformColor } from "./utils";

// Re-export Konva types for convenience
export type { KonvaEventObject };
export type KonvaMouseEvent = KonvaEventObject<MouseEvent>;
export type KonvaWheelEvent = KonvaEventObject<WheelEvent>;
export type KonvaTouchEvent = KonvaEventObject<TouchEvent>;

// ─── Logger ─────────────────────────────────────────────────────────
export type Logger = (...args: unknown[]) => void;

// ─── Player Adapter ─────────────────────────────────────────────────
export interface PlayerAdapter {
	init(eventEmitter: PeaksInstance): Promise<void> | void;
	dispose(): void;
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
	) => Shape | undefined;
	readonly createPointMarker: (
		options: CreatePointMarkerOptions,
	) => Marker | undefined;
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
export interface PeaksInitOptions {
	readonly mediaElement?: HTMLMediaElement;
	readonly player?: PlayerAdapter;
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
	readonly createSegmentMarker?: (
		options: CreateSegmentMarkerOptions,
	) => Marker | undefined;
	readonly createSegmentLabel?: (
		options: CreateSegmentLabelOptions,
	) => Shape | undefined;
	readonly createPointMarker?: (options: CreatePointMarkerOptions) => Marker;
	readonly logger?: Logger;
	readonly overview?: Partial<OverviewOptions>;
	readonly zoomview?: Partial<ZoomviewOptions>;
	readonly scrollbar?: Partial<ScrollbarDisplayOptions>;
	readonly segmentOptions?: Partial<SegmentDisplayOptions>;
	readonly keyboard?: boolean;
	readonly emitCueEvents?: boolean;
	readonly segments?: readonly SegmentOptions[];
	readonly points?: readonly PointOptions[];
	readonly showPlayheadTime?: boolean;
}

// ─── Segment / Point Options ────────────────────────────────────────
export interface SegmentOptions {
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
	readonly id?: string;
	readonly startTime?: number;
	readonly endTime?: number;
	readonly labelText?: string;
	readonly color?: string;
	readonly borderColor?: string;
	readonly editable?: boolean;
}

export interface PointOptions {
	readonly id?: string;
	readonly time: number;
	readonly labelText?: string;
	readonly color?: string;
	readonly editable?: boolean;
}

export interface PointUpdateOptions {
	readonly id?: string;
	readonly time?: number;
	readonly labelText?: string;
	readonly color?: string;
	readonly editable?: boolean;
}

// ─── Marker interfaces ─────────────────────────────────────────────
export interface Marker {
	init(group: Group): void;
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
	moveSegmentMarkersToTop(): void;
}

export interface PointsLayerAPI {
	formatTime(time: number): string;
	getHeight(): number;
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
export interface PeaksInstance extends EventEmitter {
	readonly options: PeaksOptions;
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
	init(peaks: PeaksInstance): Promise<void>;
	destroy(): void;
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
	add(...args: (PointOptions | PointOptions[])[]): Point | Point[];
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
	destroy(): void;
	getView(name?: string): WaveformViewLike | undefined;
	getScrollbar(): unknown;
}

// Lighter view interface for cross-referencing
export interface WaveformViewLike {
	getStartTime(): number;
	getEndTime(): number;
	setWaveformData(waveformData: WaveformData): void;
	setZoom(options: SetZoomOptions): boolean;
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
	readonly onMouseDown: (mousePosX: number, segment?: Group) => void;
	readonly onMouseMove: (mousePosX: number) => void;
	readonly onMouseUp: (mousePosX: number) => void;
}

// ─── Waveform builder callback ──────────────────────────────────────
export type WaveformBuilderCallback = ResultCallback<
	Error | TypeError | DOMException,
	WaveformData
>;

export interface XY {
	readonly x: number;
	readonly y: number;
}

// ─── Segment Shape interfaces ──────────────────────────────────────
export interface SegmentMarkerOptions {
	readonly segment: Segment;
	readonly segmentShape?: SegmentShapeAPI;
	readonly editable: boolean;
	readonly startMarker: boolean;
	readonly marker: Marker;
	onClick: (marker: SegmentMarkerAPI, event: KonvaMouseEvent) => void;
	onDragStart: (marker: SegmentMarkerAPI, event: KonvaMouseEvent) => void;
	onDragMove: (marker: SegmentMarkerAPI, event: KonvaMouseEvent) => void;
	onDragEnd: (marker: SegmentMarkerAPI, event: KonvaMouseEvent) => void;
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
	addToLayer(layer: Layer): void;
	moveToTop(): void;
	destroy(): void;
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
	addToLayer(layer: Layer): void;
	destroy(): void;
	segmentClicked(eventName: string, event: SegmentClickEvent): void;
}

export interface PointMarkerOptions {
	readonly point: Point;
	readonly draggable: boolean;
	readonly marker: Marker;
	onDragStart: (event: KonvaMouseEvent, point: Point) => void;
	onDragMove: (event: KonvaMouseEvent, point: Point) => void;
	onDragEnd: (event: KonvaMouseEvent, point: Point) => void;
	dragBoundFunc: (pos: { x: number; y: number }) => { x: number; y: number };
	onMouseEnter: (event: KonvaMouseEvent, point: Point) => void;
	onMouseLeave: (event: KonvaMouseEvent, point: Point) => void;
}

export interface PointMarkerAPI {
	getPoint(): Point;
	getX(): number;
	setX(x: number): void;
	getWidth(): number;
	getAbsolutePosition(): { x: number; y: number };
	update(options: Record<string, unknown>): void;
	fitToView(): void;
	addToLayer(layer: Layer): void;
	destroy(): void;
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
