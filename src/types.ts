import type EventEmitter from "eventemitter3";
import type { Group } from "konva/lib/Group";
import type { Layer } from "konva/lib/Layer";
import type { KonvaEventObject } from "konva/lib/Node";
import type { Shape } from "konva/lib/Shape";
import type WaveformData from "waveform-data";

import type { Point } from "./point";
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
	init(eventEmitter: PeaksInstance): Promise<void>;
	destroy(): void;
	play(): Promise<void>;
	pause(): void;
	isPlaying(): boolean;
	isSeeking(): boolean;
	getCurrentTime(): number;
	getDuration(): number;
	seek(time: number): void;
	setSource?(options: SetSourceOptions): Promise<void>;
}

// ─── Peaks Options ─────────────────────────────────────────────────
export interface ViewOptions {
	container?: HTMLDivElement;
	playheadColor: string;
	playheadTextColor: string;
	playheadBackgroundColor: string;
	playheadPadding: number;
	playheadWidth: number;
	playheadFontFamily: string;
	playheadFontSize: number;
	playheadFontStyle: string;
	axisGridlineColor: string;
	showAxisLabels: boolean;
	axisTopMarkerHeight: number;
	axisBottomMarkerHeight: number;
	axisLabelColor: string;
	fontFamily: string;
	fontSize: number;
	fontStyle: string;
	formatAxisTime?: (time: number) => string;
	formatPlayheadTime?: (time: number) => string;
	timeLabelPrecision: number;
	enablePoints: boolean;
	enableSegments: boolean;
	[key: string]: unknown;
}

export interface ZoomviewOptions extends ViewOptions {
	playheadClickTolerance: number;
	waveformColor: WaveformColor;
	wheelMode: string;
	autoScroll: boolean;
	autoScrollOffset: number;
	enableEditing: boolean;
	playedWaveformColor?: WaveformColor;
	formatPlayheadTime?: (time: number) => string;
	formatAxisTime?: (time: number) => string;
	showPlayheadTime?: boolean;
	segmentOptions: SegmentDisplayOptions;
	[key: string]: unknown;
}

export interface OverviewOptions extends ViewOptions {
	waveformColor: WaveformColor;
	highlightColor: string;
	highlightStrokeColor: string;
	highlightOpacity: number;
	highlightOffset: number;
	highlightCornerRadius: number;
	enableEditing: boolean;
	playedWaveformColor?: WaveformColor;
	formatPlayheadTime?: (time: number) => string;
	formatAxisTime?: (time: number) => string;
	showPlayheadTime?: boolean;
	segmentOptions: SegmentDisplayOptions;
	[key: string]: unknown;
}

export interface SegmentDisplayOptions {
	overlay: boolean;
	markers: boolean;
	startMarkerColor: string;
	endMarkerColor: string;
	waveformColor: string;
	overlayColor: string;
	overlayOpacity: number;
	overlayBorderColor: string;
	overlayBorderWidth: number;
	overlayCornerRadius: number;
	overlayOffset: number;
	overlayLabelAlign: string;
	overlayLabelVerticalAlign: string;
	overlayLabelPadding: number;
	overlayLabelColor: string;
	overlayFontFamily: string;
	overlayFontSize: number;
	overlayFontStyle: string;
	[key: string]: unknown;
}

export interface ScrollbarDisplayOptions {
	container: HTMLDivElement;
	color: string;
	minWidth: number;
	[key: string]: unknown;
}

export interface PeaksOptions {
	zoomLevels: number[];
	waveformCache: boolean;
	mediaElement: HTMLMediaElement | null;
	mediaUrl: string | null;
	dataUri: Record<string, string> | null;
	withCredentials: boolean;
	waveformData: Record<string, unknown> | null;
	webAudio: WebAudioOptions | null;
	nudgeIncrement: number;
	pointMarkerColor: string;
	createSegmentMarker: (options: CreateSegmentMarkerOptions) => Marker | null;
	createSegmentLabel: (options: CreateSegmentLabelOptions) => Shape | null;
	createPointMarker: (options: CreatePointMarkerOptions) => Marker;
	logger: Logger;
	overview: OverviewOptions;
	zoomview: ZoomviewOptions;
	scrollbar: ScrollbarDisplayOptions | null;
	segmentOptions: SegmentDisplayOptions;
	player?: PlayerAdapter;
	[key: string]: unknown;
}

export interface WebAudioOptions {
	audioContext?: AudioContext;
	audioBuffer?: AudioBuffer;
	multiChannel?: boolean;
	scale?: number;
	[key: string]: unknown;
}

// ─── Init Options (user-provided) ──────────────────────────────────
export interface PeaksInitOptions {
	mediaElement?: HTMLMediaElement;
	player?: PlayerAdapter;
	zoomLevels?: number[];
	waveformCache?: boolean;
	mediaUrl?: string;
	dataUri?: Record<string, string>;
	withCredentials?: boolean;
	waveformData?: Record<string, unknown>;
	webAudio?: WebAudioOptions;
	audioContext?: AudioContext;
	nudgeIncrement?: number;
	pointMarkerColor?: string;
	createSegmentMarker?: (options: CreateSegmentMarkerOptions) => Marker | null;
	createSegmentLabel?: (options: CreateSegmentLabelOptions) => Shape | null;
	createPointMarker?: (options: CreatePointMarkerOptions) => Marker;
	logger?: Logger;
	overview?: Partial<OverviewOptions> & { container?: HTMLDivElement };
	zoomview?: Partial<ZoomviewOptions> & { container?: HTMLDivElement };
	scrollbar?: Partial<ScrollbarDisplayOptions>;
	segmentOptions?: Partial<SegmentDisplayOptions>;
	keyboard?: boolean;
	emitCueEvents?: boolean;
	segments?: SegmentOptions[];
	points?: PointOptions[];
	showPlayheadTime?: boolean;
	[key: string]: unknown;
}

// ─── Segment / Point Options ────────────────────────────────────────
export interface SegmentOptions {
	id?: string;
	startTime: number;
	endTime: number;
	labelText?: string;
	color?: string;
	borderColor?: string;
	markers?: boolean;
	overlay?: boolean;
	editable?: boolean;
	[key: string]: unknown;
}

export interface SegmentUpdateOptions {
	id?: string;
	startTime?: number;
	endTime?: number;
	labelText?: string;
	color?: string;
	borderColor?: string;
	editable?: boolean;
	[key: string]: unknown;
}

export interface PointOptions {
	id?: string;
	time: number;
	labelText?: string;
	color?: string;
	editable?: boolean;
	[key: string]: unknown;
}

export interface PointUpdateOptions {
	id?: string;
	time?: number;
	labelText?: string;
	color?: string;
	editable?: boolean;
	[key: string]: unknown;
}

// ─── Marker interfaces ─────────────────────────────────────────────
export interface Marker {
	init(group: Group): void;
	fitToView(): void;
	update?(options: Record<string, unknown>): void;
	destroy?(): void;
}

export interface CreateSegmentMarkerOptions {
	segment: Segment;
	editable: boolean;
	startMarker: boolean;
	color: string;
	fontFamily: string;
	fontSize: number;
	fontStyle: string;
	layer: SegmentsLayerAPI;
	view: string;
	segmentOptions: SegmentDisplayOptions;
}

export interface CreateSegmentLabelOptions {
	segment: Segment;
	view: string;
	layer: SegmentsLayerAPI;
	fontFamily: string;
	fontSize: number;
	fontStyle: string;
}

export interface CreatePointMarkerOptions {
	point: Point;
	editable: boolean;
	color: string;
	fontFamily: string;
	fontSize: number;
	fontStyle: string;
	layer: PointsLayerAPI;
	view: string;
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
	getWaveformData(): WaveformData | null;
	isSegmentDraggingEnabled(): boolean;
	isSeekEnabled(): boolean;
	getMinSegmentDragWidth(): number;
	getSegmentDragMode(): string;
	updatePlayheadTime(time: number): void;
	drawWaveformLayer(): void;
	playheadPosChanged?(time: number): void;
	_height: number;
}

// ─── Peaks Instance ─────────────────────────────────────────────────
export interface PeaksInstance extends EventEmitter {
	options: PeaksOptions;
	player: PlayerInstance;
	segments: SegmentsInstance;
	points: PointsInstance;
	zoom: ZoomInstance;
	views: ViewControllerInstance;
	_logger: Logger;
	getWaveformData(): WaveformData | null;
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
	_setSource(options: SetSourceOptions): Promise<void>;
}

export interface SegmentsInstance {
	add(...args: (SegmentOptions | SegmentOptions[])[]): Segment | Segment[];
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
	setZoomLevels(zoomLevels: number[]): void;
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
	getView(name?: string): WaveformViewLike | null;
	getScrollbar(): unknown;
}

// Lighter view interface for cross-referencing
export interface WaveformViewLike {
	getStartTime(): number;
	getEndTime(): number;
	setWaveformData(waveformData: WaveformData): void;
	setZoom?(options: Record<string, unknown>): boolean;
}

// ─── Set Source Options ─────────────────────────────────────────────
export interface SetSourceOptions {
	mediaUrl?: string;
	dataUri?: Record<string, string>;
	waveformData?: Record<string, unknown>;
	webAudio?: WebAudioOptions;
	withCredentials?: boolean;
	zoomLevels?: number[];
	[key: string]: unknown;
}

// ─── Mouse drag handler interfaces ─────────────────────────────────
export interface MouseDragHandlers {
	onMouseDown?: (mousePosX: number, segment: Group | null) => void;
	onMouseMove?: (mousePosX: number) => void;
	onMouseUp?: (mousePosX: number) => void;
}

// ─── Waveform builder callback ──────────────────────────────────────
export type WaveformBuilderCallback = (
	error: Error | null,
	waveformData?: WaveformData,
) => void;

// ─── Segment Shape interfaces ──────────────────────────────────────
export interface SegmentMarkerOptions {
	segment: Segment;
	segmentShape: SegmentShapeAPI;
	editable: boolean;
	startMarker: boolean;
	marker: Marker;
	onClick: (marker: SegmentMarkerAPI, event: KonvaMouseEvent) => void;
	onDragStart: (marker: SegmentMarkerAPI, event: KonvaMouseEvent) => void;
	onDragMove: (marker: SegmentMarkerAPI, event: KonvaMouseEvent) => void;
	onDragEnd: (marker: SegmentMarkerAPI, event: KonvaMouseEvent) => void;
	dragBoundFunc: (
		marker: SegmentMarkerAPI,
		pos: { x: number; y: number },
	) => { x: number; y: number };
}

export interface SegmentMarkerAPI {
	getX(): number;
	setX(x: number): void;
	getWidth(): number;
	getAbsolutePosition(): { x: number; y: number };
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
	getStartMarker(): SegmentMarkerAPI | null;
	getEndMarker(): SegmentMarkerAPI | null;
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
	point: Point;
	draggable: boolean;
	marker: Marker;
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
	color: WaveformColor;
	view: WaveformViewAPI;
	segment?: { startTime: number; endTime: number };
}

// ─── Event Payloads ─────────────────────────────────────────────────
export interface SegmentClickEvent {
	segment: Segment;
	evt: MouseEvent;
	preventViewEvent: () => void;
}

export interface SegmentDragEvent {
	segment: Segment;
	marker: boolean;
	startMarker: boolean;
	evt: MouseEvent;
}
