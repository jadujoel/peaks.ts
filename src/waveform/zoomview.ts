import type WaveformData from "waveform-data";
import type { CanvasDriver, DriverLayer, DriverStage } from "../driver/types";
import { InsertSegmentMouseDragHandler } from "../insert-segment-mouse-drag-handler";
import type { PlayheadLayer } from "../playhead-layer";
import type { PointsLayer } from "../points-layer";
import { ScrollMouseDragHandler } from "../scroll-mouse-drag-handler";
import type { SegmentsLayer } from "../segments-layer";
import type { GridStep, TempoMap } from "../tempo-map";
import type { SnapKind } from "../tempo-map-context";
import type {
	OverviewOptions,
	PeaksInstance,
	WaveformViewAPI,
	ZoomviewOptions,
} from "../types";
import type { WaveformColor } from "../utils";
import { clamp, isValidTime, objectHasProperty } from "../utils";
import type { WaveformAxis } from "./axis";
import type { WaveformShape } from "./shape";
import { WaveformView, type WaveformViewHooks } from "./view";

export interface ZoomOptions {
	readonly scale?: number | "auto";
	readonly seconds?: number | "auto";
}

export interface WaveformZoomViewFromOptions {
	readonly waveformData: WaveformData;
	readonly container: HTMLDivElement;
	readonly peaks: PeaksInstance;
}

export function isAutoScale(options: ZoomOptions): boolean {
	return (
		(objectHasProperty(options, "scale") && options.scale === "auto") ||
		(objectHasProperty(options, "seconds") && options.seconds === "auto")
	);
}

export class WaveformZoomView implements WaveformViewAPI, WaveformViewHooks {
	private autoScroll: boolean;
	private autoScrollOffset: number;
	private segmentDraggingEnabled = false;
	private segmentDragMode = "overlap";
	private minSegmentDragWidth = 0;
	private insertSegmentShape: unknown = undefined;
	private playheadClickTolerance: number;
	private zoomLevelAuto = false;
	private zoomLevelSeconds: number | undefined = undefined;
	private mouseDragHandler:
		| ScrollMouseDragHandler
		| InsertSegmentMouseDragHandler
		| undefined;
	private wheelMode: string;
	private captureVerticalScroll = false;
	private waveformCacheEnabled = false;
	private waveformDataCache: Map<number, WaveformData> = new Map<
		number,
		WaveformData
	>();
	private waveformScales: number[] = [];
	private scale: number;
	private pixelLength: number;

	private constructor(public readonly view: WaveformView) {
		const opts = view.viewOptions as ZoomviewOptions;
		this.autoScroll = opts.autoScroll;
		this.autoScrollOffset = opts.autoScrollOffset;
		this.playheadClickTolerance = opts.playheadClickTolerance;
		this.wheelMode = opts.wheelMode;
		this.scale = view.originalWaveformData.scale;
		this.pixelLength = view.originalWaveformData.length;
	}

	static async from(
		options: WaveformZoomViewFromOptions,
	): Promise<WaveformZoomView> {
		const view = WaveformView.from({
			container: options.container,
			peaks: options.peaks,
			viewOptions: options.peaks.options.zoomview,
			waveformData: options.waveformData,
		});

		const instance = new WaveformZoomView(view);
		await view.initialize(instance, instance);
		instance.initializeZoomView();
		return instance;
	}

	private initializeZoomView(): void {
		// Register event handlers
		this.peaks.events.addEventListener("player.timeupdate", this.onTimeUpdate);
		this.peaks.events.addEventListener("player.playing", this.onPlaying);
		this.peaks.events.addEventListener("player.pause", this.onPause);
		this.peaks.events.addEventListener("keyboard.left", this.onKeyboardLeft);
		this.peaks.events.addEventListener("keyboard.right", this.onKeyboardRight);
		this.peaks.events.addEventListener(
			"keyboard.shift_left",
			this.onKeyboardShiftLeft,
		);
		this.peaks.events.addEventListener(
			"keyboard.shift_right",
			this.onKeyboardShiftRight,
		);

		const zoomviewOptions = this.viewOptions as ZoomviewOptions;

		const time = this.peaks.player.getCurrentTime();

		this.syncPlayhead(time);

		this.mouseDragHandler = ScrollMouseDragHandler.from({
			peaks: this.peaks,
			view: this,
		});

		this.setWheelMode(zoomviewOptions.wheelMode);

		this.peaks.events.dispatch("zoomview.update", {
			endTime: this.getEndTime(),
			startTime: 0,
		});
	}

	// ─── WaveformViewHooks ────────────────────────────────────────────

	getName(): string {
		return "zoomview";
	}

	isSegmentDraggingEnabled(): boolean {
		return this.segmentDraggingEnabled;
	}

	getMinSegmentDragWidth(): number {
		return this.insertSegmentShape ? 0 : this.minSegmentDragWidth;
	}

	getSegmentDragMode(): string {
		return this.segmentDragMode;
	}

	initWaveformData(): void {
		this.waveformCacheEnabled = this.peaksOptions.waveformCache;

		this.initWaveformCache();

		const initialZoomLevel = this.peaks.zoom.getLevel();

		this.resampleData({ scale: initialZoomLevel });
	}

	initHighlightLayer(): void {}

	containerWidthChange(): boolean {
		let resample = false;
		let resampleOptions: { scale: number } | { width: number } | undefined;

		if (this.zoomLevelAuto) {
			resample = true;
			resampleOptions = { width: this.width };
		} else if (this.zoomLevelSeconds !== undefined) {
			resample = true;
			resampleOptions = {
				scale: this.getScaleForDuration(this.zoomLevelSeconds),
			};
		}

		if (resample && resampleOptions) {
			try {
				this.resampleData(resampleOptions);
			} catch {
				// Ignore, and leave this.data as it was
			}
		}

		return true;
	}

	containerHeightChange(): void {
		// Nothing
	}

	updateWaveform(frameOffset = 0, forceUpdate = false): void {
		let upperLimit: number;

		if (this.pixelLength < this.width) {
			// Total waveform is shorter than viewport, so reset the offset to 0.
			frameOffset = 0;
			upperLimit = this.width;
		} else {
			// Calculate the very last possible position.
			upperLimit = this.pixelLength - this.width;
		}

		frameOffset = clamp(frameOffset, 0, upperLimit);

		if (!forceUpdate && frameOffset === this.frameOffset) {
			return;
		}

		this.frameOffset = frameOffset;

		// Display playhead if it is within the zoom frame width.
		const playheadPixel = this.playheadLayer.getPlayheadPixel();

		this.playheadLayer.updatePlayheadTime(this.pixelsToTime(playheadPixel));

		this.drawWaveformLayer();
		this.axisLayer.draw();

		const frameStartTime = this.getStartTime();
		const frameEndTime = this.getEndTime();

		if (this.pointsLayer) {
			this.pointsLayer.updatePoints(frameStartTime, frameEndTime);
		}

		if (this.segmentsLayer) {
			this.segmentsLayer.updateSegments(frameStartTime, frameEndTime);
		}

		this.peaks.events.dispatch("zoomview.update", {
			endTime: frameEndTime,
			startTime: frameStartTime,
		});
	}

	private initWaveformCache(): void {
		if (this.waveformCacheEnabled) {
			this.waveformDataCache = new Map();
			this.waveformDataCache.set(
				this.originalWaveformData.scale,
				this.originalWaveformData,
			);
			this.waveformScales = [this.originalWaveformData.scale];
		}
	}

	setWheelMode(
		mode: string,
		options?: { captureVerticalScroll?: boolean },
	): void {
		if (!options) {
			options = {};
		}

		if (
			mode !== this.wheelMode ||
			options.captureVerticalScroll !== this.captureVerticalScroll
		) {
			this.stage.off("wheel");

			this.wheelMode = mode;
			this.captureVerticalScroll = options.captureVerticalScroll ?? false;

			switch (mode) {
				case "scroll":
					if (options.captureVerticalScroll) {
						this.stage.on("wheel", this.onWheelCaptureVerticalScroll);
					} else {
						this.stage.on("wheel", this.onWheel);
					}
					break;
			}
		}
	}

	private onWheel = (event: { evt: WheelEvent }): void => {
		const wheelEvent = event.evt;
		let delta: number;

		if (wheelEvent.shiftKey) {
			if (wheelEvent.deltaY !== 0) {
				delta = wheelEvent.deltaY;
			} else if (wheelEvent.deltaX !== 0) {
				delta = wheelEvent.deltaX;
			} else {
				return;
			}
		} else {
			// Ignore the event if it looks like the user is scrolling vertically
			// down the page
			if (Math.abs(wheelEvent.deltaX) < Math.abs(wheelEvent.deltaY)) {
				return;
			}

			delta = wheelEvent.deltaX;
		}

		if (wheelEvent.deltaMode === WheelEvent.DOM_DELTA_PAGE) {
			delta *= this.width;
		}

		wheelEvent.preventDefault();

		const frameOffset = clamp(
			this.frameOffset + Math.floor(delta),
			0,
			this.pixelLength - this.width,
		);

		this.updateWaveform(frameOffset, false);
	};

	private onWheelCaptureVerticalScroll = (event: { evt: WheelEvent }): void => {
		const wheelEvent = event.evt;

		const delta =
			Math.abs(wheelEvent.deltaX) < Math.abs(wheelEvent.deltaY)
				? wheelEvent.deltaY
				: wheelEvent.deltaX;

		wheelEvent.preventDefault();

		const frameOffset = clamp(
			this.frameOffset + Math.floor(delta),
			0,
			this.pixelLength - this.width,
		);

		this.updateWaveform(frameOffset, false);
	};

	setWaveformDragMode(mode: string): void {
		if (this.segmentsLayer) {
			this.mouseDragHandler?.dispose();
			this.dragSeek(false);

			if (mode === "insert-segment") {
				this.mouseDragHandler = InsertSegmentMouseDragHandler.from({
					peaks: this.peaks,
					view: this,
				});
			} else {
				this.mouseDragHandler = ScrollMouseDragHandler.from({
					peaks: this.peaks,
					view: this,
				});
			}
		}
	}

	enableSegmentDragging(enable: boolean): void {
		this.segmentDraggingEnabled = enable;

		// Update all existing segments
		if (this.segmentsLayer) {
			this.segmentsLayer.enableSegmentDragging(enable);
		}
	}

	setSegmentDragMode(mode: string): void {
		this.segmentDragMode = mode;
	}

	private onTimeUpdate = (event: { time: number }): void => {
		if (this.mouseDragHandler?.isDragging()) {
			return;
		}

		this.syncPlayhead(event.time);
	};

	private onPlaying = (event: { time: number }): void => {
		this.playheadLayer.updatePlayheadTime(event.time);
	};

	private onPause = (event: { time: number }): void => {
		this.playheadLayer.stop(event.time);
	};

	private onKeyboardLeft = (): void => {
		this.keyboardScroll(-1, false);
	};

	private onKeyboardRight = (): void => {
		this.keyboardScroll(1, false);
	};

	private onKeyboardShiftLeft = (): void => {
		this.keyboardScroll(-1, true);
	};

	private onKeyboardShiftRight = (): void => {
		this.keyboardScroll(1, true);
	};

	private keyboardScroll(direction: number, large: boolean): void {
		let increment: number;

		if (large) {
			increment = direction * this.width;
		} else {
			increment =
				direction * this.timeToPixels(this.peaksOptions.nudgeIncrement);
		}

		this.scrollWaveform({ pixels: increment });
	}

	setWaveformData(waveformData: WaveformData): void {
		this.view.originalWaveformData = waveformData;
		// Clear cached waveforms
		this.initWaveformCache();

		// Don't update the UI here, call setZoom().
	}

	/**
	 * Returns the position of the playhead marker, in pixels relative to the
	 * left hand side of the waveform view.
	 */

	getPlayheadOffset(): number {
		return this.playheadLayer.getPlayheadPixel() - this.frameOffset;
	}

	getPlayheadClickTolerance(): number {
		return this.playheadClickTolerance;
	}

	private syncPlayhead(time: number): void {
		this.playheadLayer.updatePlayheadTime(time);

		if (this.autoScroll && !this.zoomLevelAuto) {
			// Check for the playhead reaching the right-hand side of the window.

			const pixelIndex = this.timeToPixels(time);

			// NOTE: long-term, this scroll logic should live in an animation
			// function and respect manual user positioning (e.g. via keyboard).
			const endThreshold =
				this.frameOffset + this.width - this.autoScrollOffset;

			let frameOffset = this.frameOffset;

			if (pixelIndex >= endThreshold || pixelIndex < frameOffset) {
				// Put the playhead at 100 pixels from the left edge
				frameOffset = pixelIndex - this.autoScrollOffset;

				if (frameOffset < 0) {
					frameOffset = 0;
				}

				this.updateWaveform(frameOffset, false);
			}
		}
	}

	private getScaleForDuration(duration: number): number {
		return Math.floor((duration * this.data.sample_rate) / this.width);
	}

	/**
	 * Changes the zoom level.
	 */

	setZoom(options: ZoomOptions): boolean {
		let scale: number;

		if (isAutoScale(options)) {
			// Use waveform duration, to match WaveformOverview
			const seconds = this.originalWaveformData.duration;

			this.zoomLevelAuto = true;
			this.zoomLevelSeconds = undefined;
			scale = this.getScaleForDuration(seconds);
		} else {
			if (objectHasProperty(options, "scale")) {
				this.zoomLevelSeconds = undefined;
				scale = Math.floor(options.scale as number);
			} else if (objectHasProperty(options, "seconds")) {
				if (!isValidTime(options.seconds as number)) {
					return false;
				}

				this.zoomLevelSeconds = options.seconds as number;
				scale = this.getScaleForDuration(options.seconds as number);
			} else {
				return false;
			}

			this.zoomLevelAuto = false;
		}

		if (scale < this.originalWaveformData.scale) {
			this.peaks.logger(
				`peaks.zoomview.setZoom(): zoom level must be at least ${this.originalWaveformData.scale}`,
			);
			scale = this.originalWaveformData.scale;
		}

		const currentTime = this.peaks.player.getCurrentTime();
		let apexTime: number;
		let playheadOffsetPixels = this.getPlayheadOffset();

		if (playheadOffsetPixels >= 0 && playheadOffsetPixels < this.width) {
			// Playhead is visible. Change the zoom level while keeping the
			// playhead at the same position in the window.
			apexTime = currentTime;
		} else {
			// Playhead is not visible. Change the zoom level while keeping the
			// centre of the window at the same position in the waveform.
			playheadOffsetPixels = Math.floor(this.width / 2);
			apexTime = this.pixelOffsetToTime(playheadOffsetPixels);
		}

		const prevScale = this.scale;

		this.resampleData({ scale: scale });

		const apexPixel = this.timeToPixels(apexTime);

		const frameOffset = apexPixel - playheadOffsetPixels;

		this.updateWaveform(frameOffset, true);

		this.playheadLayer.zoomLevelChanged();

		// Update the playhead position after zooming.
		this.playheadLayer.updatePlayheadTime(currentTime);

		this.peaks.events.dispatch("zoom.update", {
			currentZoom: scale,
			previousZoom: prevScale,
		});

		return true;
	}

	private resampleData(options: { scale: number } | { width: number }): void {
		const scale = "scale" in options ? options.scale : undefined;

		if (this.waveformCacheEnabled) {
			if (scale !== undefined && !this.waveformDataCache.has(scale)) {
				let sourceWaveform = this.originalWaveformData;

				// Resample from the next lowest available zoom level

				for (const waveformScale of this.waveformScales) {
					if (waveformScale < scale) {
						const cached = this.waveformDataCache.get(waveformScale);

						if (cached) {
							sourceWaveform = cached;
						}
					} else {
						break;
					}
				}

				this.waveformDataCache.set(scale, sourceWaveform.resample(options));

				this.waveformScales.push(scale);
				this.waveformScales.sort((a: number, b: number) => {
					return a - b; // Ascending order
				});
			}

			if (scale !== undefined) {
				const cached = this.waveformDataCache.get(scale);

				this.data = cached ?? this.originalWaveformData.resample(options);
			} else {
				this.data = this.originalWaveformData.resample(options);
			}
		} else {
			this.data = this.originalWaveformData.resample(options);
		}

		this.scale = this.data.scale;
		this.pixelLength = this.data.length;
	}

	isAutoZoom(): boolean {
		return this.zoomLevelAuto;
	}

	setStartTime(time: number): void {
		if (time < 0) {
			time = 0;
		}

		if (this.zoomLevelAuto) {
			time = 0;
		}

		this.updateWaveform(this.timeToPixels(time), false);
	}

	/**
	 * Returns the length of the waveform, in pixels.
	 */

	getPixelLength(): number {
		return this.pixelLength;
	}

	/**
	 * Scrolls the region of waveform shown in the view.
	 *
	 * @throws {TypeError} If neither a pixel offset nor a time offset is provided.
	 */

	scrollWaveform(options: {
		pixels?: number;
		seconds?: number;
	}): undefined | never {
		let scrollAmount: number;

		if (options.pixels !== undefined) {
			scrollAmount = Math.floor(options.pixels);
		} else if (options.seconds !== undefined) {
			scrollAmount = this.timeToPixels(options.seconds);
		} else {
			throw new TypeError(
				"view.scrollWaveform(): Missing number of pixels or seconds",
			);
		}

		this.updateWaveform(this.frameOffset + scrollAmount, false);
	}

	enableAutoScroll(enable: boolean, options?: { offset?: number }): void {
		this.autoScroll = enable;

		if (options?.offset !== undefined) {
			this.autoScrollOffset = options.offset;
		}
	}

	setMinSegmentDragWidth(width: number): void {
		this.minSegmentDragWidth = width;
	}

	getStage(): DriverStage {
		return this.stage;
	}

	getSegmentsLayer(): SegmentsLayer | undefined {
		return this.segmentsLayer;
	}

	dispose(): void {
		// Unregister event handlers
		this.peaks.events.removeEventListener("player.playing", this.onPlaying);
		this.peaks.events.removeEventListener("player.pause", this.onPause);
		this.peaks.events.removeEventListener(
			"player.timeupdate",
			this.onTimeUpdate,
		);
		this.peaks.events.removeEventListener("keyboard.left", this.onKeyboardLeft);
		this.peaks.events.removeEventListener(
			"keyboard.right",
			this.onKeyboardRight,
		);
		this.peaks.events.removeEventListener(
			"keyboard.shift_left",
			this.onKeyboardShiftLeft,
		);
		this.peaks.events.removeEventListener(
			"keyboard.shift_right",
			this.onKeyboardShiftRight,
		);

		if (this.waveformCacheEnabled) {
			this.waveformDataCache.clear();
		} else {
			this.view.data = undefined as unknown as WaveformData;
		}

		this.mouseDragHandler?.dispose();

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
	setPlayheadColor(color: string): void {
		this.view.setPlayheadColor(color);
	}
	setPlayheadTextColor(color: string): void {
		this.view.setPlayheadTextColor(color);
	}
	setSegmentStartMarkerColor(color: string): void {
		this.view.setSegmentStartMarkerColor(color);
	}
	setSegmentEndMarkerColor(color: string): void {
		this.view.setSegmentEndMarkerColor(color);
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

	// ─── Tempo map / grid / snap ────────────────────────────────────

	setTempoMap(map: TempoMap | undefined): void {
		this.peaksOptions.tempoMapContext?.setTempoMap(map);
	}

	getTempoMap(): TempoMap | undefined {
		return this.peaksOptions.tempoMapContext?.getTempoMap();
	}

	setGridStep(step: GridStep): void {
		this.peaksOptions.tempoMapContext?.setGridStep(step);
	}

	getGridStep(): GridStep {
		return this.peaksOptions.tempoMapContext?.getGridStep() ?? "1/4";
	}

	setGridVisible(visible: boolean): void {
		this.view.gridLayer?.setVisible(visible);
		this.axisLayer.draw();
	}

	setSnapEnabled(kind: SnapKind, enabled: boolean): void {
		this.peaksOptions.tempoMapContext?.setSnapEnabled(kind, enabled);
	}

	isSnapEnabled(kind: SnapKind): boolean {
		return this.peaksOptions.tempoMapContext?.isSnapEnabled(kind) ?? false;
	}

	setSnapStep(step: GridStep | undefined): void {
		this.peaksOptions.tempoMapContext?.setSnapStep(step);
	}
}
