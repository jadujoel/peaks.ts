import type WaveformData from "waveform-data";
import { InsertSegmentMouseDragHandler } from "./insert-segment-mouse-drag-handler";
import { ScrollMouseDragHandler } from "./scroll-mouse-drag-handler";
import type { PeaksInstance, ZoomviewOptions } from "./types";
import { clamp, isValidTime, objectHasProperty } from "./utils";
import { WaveformView } from "./waveform-view";

export interface ZoomOptions {
	readonly scale?: number | "auto";
	readonly seconds?: number | "auto";
}

export function isAutoScale(options: ZoomOptions): boolean {
	return (
		(objectHasProperty(options, "scale") && options.scale === "auto") ||
		(objectHasProperty(options, "seconds") && options.seconds === "auto")
	);
}

export interface WaveformZoomViewFromOptions {
	readonly waveformData: WaveformData;
	readonly container: HTMLDivElement;
	readonly peaks: PeaksInstance;
}

export class WaveformZoomView extends WaveformView {
	declare _autoScroll: boolean;
	declare _autoScrollOffset: number;
	declare _enableSegmentDragging: boolean;
	declare _segmentDragMode: string;
	declare _minSegmentDragWidth: number;
	declare _insertSegmentShape: unknown;
	declare _playheadClickTolerance: number;
	declare _zoomLevelAuto: boolean;
	declare _zoomLevelSeconds: number | undefined;
	declare _mouseDragHandler:
		| ScrollMouseDragHandler
		| InsertSegmentMouseDragHandler;
	declare _wheelMode: string;
	declare _captureVerticalScroll: boolean;
	declare _enableWaveformCache: boolean;
	declare _waveformData: Map<number, WaveformData>;
	declare _waveformScales: number[];
	declare _scale: number;
	declare _pixelLength: number;

	static from(options: WaveformZoomViewFromOptions): WaveformZoomView {
		return new WaveformZoomView(
			options.waveformData,
			options.container,
			options.peaks,
		);
	}

	private constructor(
		waveformData: WaveformData,
		container: HTMLDivElement,
		peaks: PeaksInstance,
	) {
		super(waveformData, container, peaks, peaks.options.zoomview);

		// Bind event handlers
		this._onTimeUpdate = this._onTimeUpdate.bind(this);
		this._onPlaying = this._onPlaying.bind(this);
		this._onPause = this._onPause.bind(this);
		this._onKeyboardLeft = this._onKeyboardLeft.bind(this);
		this._onKeyboardRight = this._onKeyboardRight.bind(this);
		this._onKeyboardShiftLeft = this._onKeyboardShiftLeft.bind(this);
		this._onKeyboardShiftRight = this._onKeyboardShiftRight.bind(this);

		// Register event handlers
		this._peaks.on("player.timeupdate", this._onTimeUpdate);
		this._peaks.on("player.playing", this._onPlaying);
		this._peaks.on("player.pause", this._onPause);
		this._peaks.on("keyboard.left", this._onKeyboardLeft);
		this._peaks.on("keyboard.right", this._onKeyboardRight);
		this._peaks.on("keyboard.shift_left", this._onKeyboardShiftLeft);
		this._peaks.on("keyboard.shift_right", this._onKeyboardShiftRight);

		const zoomviewOptions = this._viewOptions as ZoomviewOptions;

		this._autoScroll = zoomviewOptions.autoScroll;
		this._autoScrollOffset = zoomviewOptions.autoScrollOffset;

		this._enableSegmentDragging = false;
		this._segmentDragMode = "overlap";
		this._minSegmentDragWidth = 0;
		this._insertSegmentShape = undefined;

		this._playheadClickTolerance = zoomviewOptions.playheadClickTolerance;

		this._zoomLevelAuto = false;
		this._zoomLevelSeconds = undefined;

		const time = this._peaks.player.getCurrentTime();

		this._syncPlayhead(time);

		this._mouseDragHandler = ScrollMouseDragHandler.from({
			peaks,
			view: this,
		});

		this._onWheel = this._onWheel.bind(this);
		this._onWheelCaptureVerticalScroll =
			this._onWheelCaptureVerticalScroll.bind(this);
		this.setWheelMode(zoomviewOptions.wheelMode);

		this._peaks.emit("zoomview.update", {
			startTime: 0,
			endTime: this.getEndTime(),
		});
	}

	override initWaveformData(): void {
		this._enableWaveformCache = this._options.waveformCache;

		this._initWaveformCache();

		const initialZoomLevel = this._peaks.zoom.getZoomLevel();

		this._resampleData({ scale: initialZoomLevel });
	}

	_initWaveformCache(): void {
		if (this._enableWaveformCache) {
			this._waveformData = new Map();
			this._waveformData.set(
				this._originalWaveformData.scale,
				this._originalWaveformData,
			);
			this._waveformScales = [this._originalWaveformData.scale];
		}
	}

	override initHighlightLayer(): void {}

	setWheelMode(
		mode: string,
		options?: { captureVerticalScroll?: boolean },
	): void {
		if (!options) {
			options = {};
		}

		if (
			mode !== this._wheelMode ||
			options.captureVerticalScroll !== this._captureVerticalScroll
		) {
			this._stage.off("wheel");

			this._wheelMode = mode;
			this._captureVerticalScroll = options.captureVerticalScroll ?? false;

			switch (mode) {
				case "scroll":
					if (options.captureVerticalScroll) {
						this._stage.on("wheel", this._onWheelCaptureVerticalScroll);
					} else {
						this._stage.on("wheel", this._onWheel);
					}
					break;
			}
		}
	}

	_onWheel(event: { evt: WheelEvent }): void {
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
			delta *= this._width;
		}

		wheelEvent.preventDefault();

		const frameOffset = clamp(
			this._frameOffset + Math.floor(delta),
			0,
			this._pixelLength - this._width,
		);

		this.updateWaveform(frameOffset, false);
	}

	_onWheelCaptureVerticalScroll(event: { evt: WheelEvent }): void {
		const wheelEvent = event.evt;

		const delta =
			Math.abs(wheelEvent.deltaX) < Math.abs(wheelEvent.deltaY)
				? wheelEvent.deltaY
				: wheelEvent.deltaX;

		wheelEvent.preventDefault();

		const frameOffset = clamp(
			this._frameOffset + Math.floor(delta),
			0,
			this._pixelLength - this._width,
		);

		this.updateWaveform(frameOffset, false);
	}

	setWaveformDragMode(mode: string): void {
		if (this._segmentsLayer) {
			this._mouseDragHandler.destroy();
			this.dragSeek(false);

			if (mode === "insert-segment") {
				this._mouseDragHandler = InsertSegmentMouseDragHandler.from({
					peaks: this._peaks,
					view: this,
				});
			} else {
				this._mouseDragHandler = ScrollMouseDragHandler.from({
					peaks: this._peaks,
					view: this,
				});
			}
		}
	}

	enableSegmentDragging(enable: boolean): void {
		this._enableSegmentDragging = enable;

		// Update all existing segments
		if (this._segmentsLayer) {
			this._segmentsLayer.enableSegmentDragging(enable);
		}
	}

	override isSegmentDraggingEnabled(): boolean {
		return this._enableSegmentDragging;
	}

	setSegmentDragMode(mode: string): void {
		this._segmentDragMode = mode;
	}

	getSegmentDragMode(): string {
		return this._segmentDragMode;
	}

	override getName(): string {
		return "zoomview";
	}

	_onTimeUpdate(time: number): void {
		if (this._mouseDragHandler.isDragging()) {
			return;
		}

		this._syncPlayhead(time);
	}

	_onPlaying(time: number): void {
		this._playheadLayer.updatePlayheadTime(time);
	}

	_onPause(time: number): void {
		this._playheadLayer.stop(time);
	}

	_onKeyboardLeft(): void {
		this._keyboardScroll(-1, false);
	}

	_onKeyboardRight(): void {
		this._keyboardScroll(1, false);
	}

	_onKeyboardShiftLeft(): void {
		this._keyboardScroll(-1, true);
	}

	_onKeyboardShiftRight(): void {
		this._keyboardScroll(1, true);
	}

	_keyboardScroll(direction: number, large: boolean): void {
		let increment: number;

		if (large) {
			increment = direction * this._width;
		} else {
			increment = direction * this.timeToPixels(this._options.nudgeIncrement);
		}

		this.scrollWaveform({ pixels: increment });
	}

	override setWaveformData(waveformData: WaveformData): void {
		this._originalWaveformData = waveformData;
		// Clear cached waveforms
		this._initWaveformCache();

		// Don't update the UI here, call setZoom().
	}

	/**
	 * Returns the position of the playhead marker, in pixels relative to the
	 * left hand side of the waveform view.
	 */

	getPlayheadOffset(): number {
		return this._playheadLayer.getPlayheadPixel() - this._frameOffset;
	}

	getPlayheadClickTolerance(): number {
		return this._playheadClickTolerance;
	}

	_syncPlayhead(time: number): void {
		this._playheadLayer.updatePlayheadTime(time);

		if (this._autoScroll && !this._zoomLevelAuto) {
			// Check for the playhead reaching the right-hand side of the window.

			const pixelIndex = this.timeToPixels(time);

			// TODO: move this code to animation function?
			// TODO: don't scroll if user has positioned view manually (e.g., using
			// the keyboard)
			const endThreshold =
				this._frameOffset + this._width - this._autoScrollOffset;

			let frameOffset = this._frameOffset;

			if (pixelIndex >= endThreshold || pixelIndex < frameOffset) {
				// Put the playhead at 100 pixels from the left edge
				frameOffset = pixelIndex - this._autoScrollOffset;

				if (frameOffset < 0) {
					frameOffset = 0;
				}

				this.updateWaveform(frameOffset, false);
			}
		}
	}

	_getScale(duration: number): number {
		return Math.floor((duration * this._data.sample_rate) / this._width);
	}

	/**
	 * Changes the zoom level.
	 */

	setZoom(options: ZoomOptions): boolean {
		let scale: number;

		if (isAutoScale(options)) {
			// Use waveform duration, to match WaveformOverview
			const seconds = this._originalWaveformData.duration;

			this._zoomLevelAuto = true;
			this._zoomLevelSeconds = undefined;
			scale = this._getScale(seconds);
		} else {
			if (objectHasProperty(options, "scale")) {
				this._zoomLevelSeconds = undefined;
				scale = Math.floor(options.scale as number);
			} else if (objectHasProperty(options, "seconds")) {
				if (!isValidTime(options.seconds as number)) {
					return false;
				}

				this._zoomLevelSeconds = options.seconds as number;
				scale = this._getScale(options.seconds as number);
			} else {
				return false;
			}

			this._zoomLevelAuto = false;
		}

		if (scale < this._originalWaveformData.scale) {
			this._peaks._logger(
				`peaks.zoomview.setZoom(): zoom level must be at least ${this._originalWaveformData.scale}`,
			);
			scale = this._originalWaveformData.scale;
		}

		const currentTime = this._peaks.player.getCurrentTime();
		let apexTime: number;
		let playheadOffsetPixels = this.getPlayheadOffset();

		if (playheadOffsetPixels >= 0 && playheadOffsetPixels < this._width) {
			// Playhead is visible. Change the zoom level while keeping the
			// playhead at the same position in the window.
			apexTime = currentTime;
		} else {
			// Playhead is not visible. Change the zoom level while keeping the
			// centre of the window at the same position in the waveform.
			playheadOffsetPixels = Math.floor(this._width / 2);
			apexTime = this.pixelOffsetToTime(playheadOffsetPixels);
		}

		const prevScale = this._scale;

		this._resampleData({ scale: scale });

		const apexPixel = this.timeToPixels(apexTime);

		const frameOffset = apexPixel - playheadOffsetPixels;

		this.updateWaveform(frameOffset, true);

		this._playheadLayer.zoomLevelChanged();

		// Update the playhead position after zooming.
		this._playheadLayer.updatePlayheadTime(currentTime);

		this._peaks.emit("zoom.update", {
			currentZoom: scale,
			previousZoom: prevScale,
		});

		return true;
	}

	_resampleData(options: { scale: number } | { width: number }): void {
		const scale = "scale" in options ? options.scale : undefined;

		if (this._enableWaveformCache) {
			if (scale !== undefined && !this._waveformData.has(scale)) {
				let sourceWaveform = this._originalWaveformData;

				// Resample from the next lowest available zoom level

				for (const waveformScale of this._waveformScales) {
					if (waveformScale < scale) {
						const cached = this._waveformData.get(waveformScale);

						if (cached) {
							sourceWaveform = cached;
						}
					} else {
						break;
					}
				}

				this._waveformData.set(scale, sourceWaveform.resample(options));

				this._waveformScales.push(scale);
				this._waveformScales.sort((a: number, b: number) => {
					return a - b; // Ascending order
				});
			}

			if (scale !== undefined) {
				const cached = this._waveformData.get(scale);

				this._data = cached ?? this._originalWaveformData.resample(options);
			} else {
				this._data = this._originalWaveformData.resample(options);
			}
		} else {
			this._data = this._originalWaveformData.resample(options);
		}

		this._scale = this._data.scale;
		this._pixelLength = this._data.length;
	}

	isAutoZoom(): boolean {
		return this._zoomLevelAuto;
	}

	setStartTime(time: number): void {
		if (time < 0) {
			time = 0;
		}

		if (this._zoomLevelAuto) {
			time = 0;
		}

		this.updateWaveform(this.timeToPixels(time), false);
	}

	/**
	 * Returns the length of the waveform, in pixels.
	 */

	getPixelLength(): number {
		return this._pixelLength;
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

		this.updateWaveform(this._frameOffset + scrollAmount, false);
	}

	/**
	 * Updates the region of waveform shown in the view.
	 */

	override updateWaveform(frameOffset: number, forceUpdate = false): void {
		let upperLimit: number;

		if (this._pixelLength < this._width) {
			// Total waveform is shorter than viewport, so reset the offset to 0.
			frameOffset = 0;
			upperLimit = this._width;
		} else {
			// Calculate the very last possible position.
			upperLimit = this._pixelLength - this._width;
		}

		frameOffset = clamp(frameOffset, 0, upperLimit);

		if (!forceUpdate && frameOffset === this._frameOffset) {
			return;
		}

		this._frameOffset = frameOffset;

		// Display playhead if it is within the zoom frame width.
		const playheadPixel = this._playheadLayer.getPlayheadPixel();

		this._playheadLayer.updatePlayheadTime(this.pixelsToTime(playheadPixel));

		this.drawWaveformLayer();
		this._axisLayer.draw();

		const frameStartTime = this.getStartTime();
		const frameEndTime = this.getEndTime();

		if (this._pointsLayer) {
			this._pointsLayer.updatePoints(frameStartTime, frameEndTime);
		}

		if (this._segmentsLayer) {
			this._segmentsLayer.updateSegments(frameStartTime, frameEndTime);
		}

		this._peaks.emit("zoomview.update", {
			startTime: frameStartTime,
			endTime: frameEndTime,
		});
	}

	enableAutoScroll(enable: boolean, options?: { offset?: number }): void {
		this._autoScroll = enable;

		if (options?.offset !== undefined) {
			this._autoScrollOffset = options.offset;
		}
	}

	getMinSegmentDragWidth(): number {
		return this._insertSegmentShape ? 0 : this._minSegmentDragWidth;
	}

	setMinSegmentDragWidth(width: number): void {
		this._minSegmentDragWidth = width;
	}

	override containerWidthChange(): boolean {
		let resample = false;
		let resampleOptions: { scale: number } | { width: number } | undefined;

		if (this._zoomLevelAuto) {
			resample = true;
			resampleOptions = { width: this._width };
		} else if (this._zoomLevelSeconds !== undefined) {
			resample = true;
			resampleOptions = { scale: this._getScale(this._zoomLevelSeconds) };
		}

		if (resample && resampleOptions) {
			try {
				this._resampleData(resampleOptions);
			} catch {
				// Ignore, and leave this._data as it was
			}
		}

		return true;
	}

	override containerHeightChange(): void {
		// Nothing
	}

	getStage(): import("konva/lib/Stage").Stage {
		return this._stage;
	}

	getSegmentsLayer(): import("./segments-layer").SegmentsLayer | undefined {
		return this._segmentsLayer;
	}

	override destroy(): void {
		// Unregister event handlers
		this._peaks.off("player.playing", this._onPlaying);
		this._peaks.off("player.pause", this._onPause);
		this._peaks.off("player.timeupdate", this._onTimeUpdate);
		this._peaks.off("keyboard.left", this._onKeyboardLeft);
		this._peaks.off("keyboard.right", this._onKeyboardRight);
		this._peaks.off("keyboard.shift_left", this._onKeyboardShiftLeft);
		this._peaks.off("keyboard.shift_right", this._onKeyboardShiftRight);

		if (this._enableWaveformCache) {
			this._waveformData.clear();
		} else {
			this._data = undefined as unknown as WaveformData;
		}

		this._mouseDragHandler.destroy();

		super.destroy();
	}
}
