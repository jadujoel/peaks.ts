import type WaveformData from "waveform-data";
import type { CanvasDriver, DriverLayer } from "../driver/types";
import { HighlightLayer } from "../highlight-layer";
import type { PlayheadLayer } from "../playhead-layer";
import type { PointsLayer } from "../points-layer";
import { SeekMouseDragHandler } from "../seek-mouse-drag-handler";
import type { SegmentsLayer } from "../segments-layer";
import type {
	OverviewOptions,
	PeaksInstance,
	WaveformViewAPI,
	ZoomviewOptions,
} from "../types";
import type { WaveformColor } from "../utils";
import type { WaveformAxis } from "./axis";
import type { WaveformShape } from "./shape";
import { WaveformView, type WaveformViewHooks } from "./view";

export type SeekMouseDragHandlerViewParam = Parameters<
	typeof SeekMouseDragHandler.from
>[0]["view"];

export interface WaveformOverviewFromOptions {
	readonly waveformData: WaveformData;
	readonly container: HTMLDivElement;
	readonly peaks: PeaksInstance;
}

export class WaveformOverview implements WaveformViewAPI, WaveformViewHooks {
	public mouseDragHandler: SeekMouseDragHandler | undefined;
	public highlightLayer: HighlightLayer | undefined;

	private constructor(public readonly view: WaveformView) {}

	static from(options: WaveformOverviewFromOptions): WaveformOverview {
		const view = WaveformView.from({
			container: options.container,
			peaks: options.peaks,
			viewOptions: options.peaks.options.overview,
			waveformData: options.waveformData,
		});

		const instance = new WaveformOverview(view);
		view.initialize(instance, instance);
		instance.initializeOverview();
		return instance;
	}

	private initializeOverview(): void {
		const peaks = this.peaks;

		// Register event handlers
		peaks.events.addEventListener("player.timeupdate", this.onTimeUpdate);
		peaks.events.addEventListener("player.playing", this.onPlaying);
		peaks.events.addEventListener("player.pause", this.onPause);
		peaks.events.addEventListener("zoomview.update", this.onZoomviewUpdate);

		const time = this.peaks.player.getCurrentTime();

		this.playheadLayer.updatePlayheadTime(time);

		this.mouseDragHandler = SeekMouseDragHandler.from({
			peaks,
			view: this as unknown as SeekMouseDragHandlerViewParam,
		});

		const zoomview = peaks.views.getView("zoomview");

		if (zoomview) {
			this.highlightLayer?.showHighlight(
				zoomview.getStartTime(),
				zoomview.getEndTime(),
			);
		}
	}

	// ─── WaveformViewHooks ────────────────────────────────────────────

	getName(): string {
		return "overview";
	}

	isSegmentDraggingEnabled(): boolean {
		return false;
	}

	getMinSegmentDragWidth(): number {
		return 0;
	}

	getSegmentDragMode(): string {
		return "overlap";
	}

	initWaveformData(): void {
		if (this.view.width !== 0) {
			this.resampleAndSetWaveformData(
				this.view.originalWaveformData,
				this.view.width,
			);
		}
	}

	initHighlightLayer(): void {
		this.highlightLayer = HighlightLayer.from({
			options: this.view.viewOptions as OverviewOptions,
			view: this,
		});

		this.highlightLayer.addToStage(this.view.stage);
	}

	containerWidthChange(): boolean {
		return this.resampleAndSetWaveformData(
			this.view.originalWaveformData,
			this.view.width,
		);
	}

	containerHeightChange(): void {
		this.highlightLayer?.fitToView();
	}

	updateWaveform(): void {
		this.waveformLayer.draw();
		this.axisLayer.draw();

		const playheadTime = this.peaks.player.getCurrentTime();

		this.playheadLayer.updatePlayheadTime(playheadTime);

		this.highlightLayer?.updateHighlight();

		const frameStartTime = 0;
		const frameEndTime = this.pixelsToTime(this.width);

		if (this.pointsLayer) {
			this.pointsLayer.updatePoints(frameStartTime, frameEndTime);
		}

		if (this.segmentsLayer) {
			this.segmentsLayer.updateSegments(frameStartTime, frameEndTime);
		}
	}

	// ─── Event handlers ───────────────────────────────────────────────

	private onTimeUpdate = (event: { time: number }): void => {
		this.playheadLayer.updatePlayheadTime(event.time);
	};

	private onPlaying = (event: { time: number }): void => {
		this.playheadLayer.updatePlayheadTime(event.time);
	};

	private onPause = (event: { time: number }): void => {
		this.playheadLayer.stop(event.time);
	};

	private onZoomviewUpdate = (event: {
		readonly startTime: number;
		readonly endTime: number;
	}): void => {
		this.showHighlight(event.startTime, event.endTime);
	};

	// ─── Public API ───────────────────────────────────────────────────

	showHighlight(startTime: number, endTime: number): void {
		this.highlightLayer?.showHighlight(startTime, endTime);
	}

	setWaveformData(waveformData: WaveformData): void {
		this.view.originalWaveformData = waveformData;

		if (this.view.width !== 0) {
			this.resampleAndSetWaveformData(waveformData, this.view.width);
		} else {
			this.view.data = waveformData;
		}

		this.view.updateWaveform();
	}

	private resampleAndSetWaveformData(
		waveformData: WaveformData,
		width: number,
	): boolean {
		try {
			this.view.data = waveformData.resample({ width: width });
			return true;
		} catch {
			// This error usually indicates that the waveform length
			// is less than the container width. Ignore, and use the
			// given waveform data
			this.view.data = waveformData;
			return false;
		}
	}

	removeHighlightRect(): void {
		this.highlightLayer?.removeHighlight();
	}

	dispose(): void {
		// Unregister event handlers
		this.peaks.events.removeEventListener("player.playing", this.onPlaying);
		this.peaks.events.removeEventListener("player.pause", this.onPause);
		this.peaks.events.removeEventListener(
			"player.timeupdate",
			this.onTimeUpdate,
		);
		this.peaks.events.removeEventListener(
			"zoomview.update",
			this.onZoomviewUpdate,
		);

		this.mouseDragHandler?.dispose();
		this.highlightLayer?.dispose();

		this.view.dispose();
	}

	// ─── Field delegation getters/setters ─────────────────────────────

	get peaks(): PeaksInstance {
		return this.view.peaks;
	}
	get peaksOptions(): PeaksInstance["options"] {
		return this.view.peaksOptions;
	}
	get viewOptions(): ZoomviewOptions | OverviewOptions {
		return this.view.viewOptions;
	}
	get container(): HTMLDivElement {
		return this.view.container;
	}
	get originalWaveformData(): WaveformData {
		return this.view.originalWaveformData;
	}
	set originalWaveformData(v: WaveformData) {
		this.view.originalWaveformData = v;
	}
	get data(): WaveformData {
		return this.view.data;
	}
	set data(v: WaveformData) {
		this.view.data = v;
	}
	get frameOffset(): number {
		return this.view.frameOffset;
	}
	set frameOffset(v: number) {
		this.view.frameOffset = v;
	}
	get width(): number {
		return this.view.width;
	}
	get height(): number {
		return this.view.height;
	}
	get stage() {
		return this.view.stage;
	}
	get waveformLayer(): DriverLayer {
		return this.view.waveformLayer;
	}
	get axisLayer(): DriverLayer {
		return this.view.axisLayer;
	}
	get playheadLayer(): PlayheadLayer {
		return this.view.playheadLayer;
	}
	get segmentsLayer(): SegmentsLayer | undefined {
		return this.view.segmentsLayer;
	}
	get pointsLayer(): PointsLayer | undefined {
		return this.view.pointsLayer;
	}
	get waveformShape(): WaveformShape {
		return this.view.waveformShape;
	}
	get playedWaveformShape(): WaveformShape | undefined {
		return this.view.playedWaveformShape;
	}
	get axis(): WaveformAxis {
		return this.view.axis;
	}
	get amplitudeScale(): number {
		return this.view.amplitudeScale;
	}
	get formatPlayheadTimeFn(): (time: number) => string {
		return this.view.formatPlayheadTimeFn;
	}

	// ─── Method delegation ────────────────────────────────────────────

	getWidth(): number {
		return this.view.getWidth();
	}
	getHeight(): number {
		return this.view.getHeight();
	}
	getStartTime(): number {
		return this.view.getStartTime();
	}
	getEndTime(): number {
		return this.view.getEndTime();
	}
	getFrameOffset(): number {
		return this.view.getFrameOffset();
	}
	getDuration(): number {
		return this.view.getDuration();
	}
	getAmplitudeScale(): number {
		return this.view.getAmplitudeScale();
	}
	getViewOptions(): ZoomviewOptions | OverviewOptions {
		return this.view.getViewOptions();
	}
	getDriver(): CanvasDriver {
		return this.view.getDriver();
	}
	getWaveformData(): WaveformData {
		return this.view.getWaveformData();
	}
	timeToPixels(time: number): number {
		return this.view.timeToPixels(time);
	}
	timeToPixelOffset(time: number): number {
		return this.view.timeToPixelOffset(time);
	}
	pixelsToTime(pixels: number): number {
		return this.view.pixelsToTime(pixels);
	}
	pixelOffsetToTime(offset: number): number {
		return this.view.pixelOffsetToTime(offset);
	}
	formatTime(time: number): string {
		return this.view.formatTime(time);
	}
	setWaveformColor(color: WaveformColor): void {
		this.view.setWaveformColor(color);
	}
	setPlayedWaveformColor(color: WaveformColor | undefined): void {
		this.view.setPlayedWaveformColor(color);
	}
	showAxisLabels(
		show: boolean,
		options?: { topMarkerHeight?: number; bottomMarkerHeight?: number },
	): void {
		this.view.showAxisLabels(show, options);
	}
	setAxisLabelColor(color: string): void {
		this.view.setAxisLabelColor(color);
	}
	setAxisGridlineColor(color: string): void {
		this.view.setAxisGridlineColor(color);
	}
	showPlayheadTime(show: boolean): void {
		this.view.showPlayheadTime(show);
	}
	setTimeLabelPrecision(precision: number): void {
		this.view.setTimeLabelPrecision(precision);
	}
	setAmplitudeScale(scale: number): undefined | never {
		return this.view.setAmplitudeScale(scale);
	}
	enableSeek(enable: boolean): void {
		this.view.enableSeek(enable);
	}
	isSeekEnabled(): boolean {
		return this.view.isSeekEnabled();
	}
	dragSeek(dragging: boolean): void {
		this.view.dragSeek(dragging);
	}
	drawWaveformLayer(): void {
		this.view.drawWaveformLayer();
	}
	updatePlayheadTime(time: number): void {
		this.view.updatePlayheadTime(time);
	}
	playheadPosChanged(time: number): void {
		this.view.playheadPosChanged(time);
	}
	enableMarkerEditing(enable: boolean): void {
		this.view.enableMarkerEditing(enable);
	}
	fitToContainer(): void {
		this.view.fitToContainer();
	}
}
