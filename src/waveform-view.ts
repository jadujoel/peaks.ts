import Konva from "konva/lib/Core";
import type { Layer } from "konva/lib/Layer";
import type { KonvaEventObject } from "konva/lib/Node";
import type { Stage } from "konva/lib/Stage";
import type { WaveformData } from "waveform-data";
import type { HighlightLayer } from "./highlight-layer";
import { PlayheadLayer } from "./playhead-layer";
import { PointsLayer } from "./points-layer";
import { SegmentsLayer } from "./segments-layer";
import type { OverviewOptions, PeaksInstance, ZoomviewOptions } from "./types";
import type { WaveformColor } from "./utils";
import { formatTime, getMarkerObject, isFinite, isNumber } from "./utils";
import { WaveformAxis } from "./waveform-axis";
import { WaveformShape } from "./waveform-shape";

export interface PlayedSegment {
	readonly startTime: number;
	readonly endTime: number;
}

export class WaveformView {
	public peaks: PeaksInstance;
	public _peaks: PeaksInstance;
	private _container: HTMLDivElement;
	private _options: PeaksInstance["options"];
	private _viewOptions: ZoomviewOptions | OverviewOptions;
	private _originalWaveformData: WaveformData;
	private _data: WaveformData;
	private _frameOffset: number;
	private _width: number;
	private _height: number;
	private _amplitudeScale: number;
	private _waveformColor: WaveformColor;
	private _playedWaveformColor: WaveformColor | undefined;
	private _timeLabelPrecision: number;
	private _formatPlayheadTime: (time: number) => string;
	private _enableSeek: boolean;
	private _stage!: Stage;
	private _waveformLayer!: Layer;
	private _waveformShape!: WaveformShape;
	private _playedWaveformShape!: WaveformShape | null;
	private _playedSegment!: PlayedSegment | null;
	private _unplayedSegment!: PlayedSegment | null;
	private _segmentsLayer!: SegmentsLayer | null;
	private _pointsLayer!: PointsLayer | null;
	private _highlightLayer!: HighlightLayer | null;
	private _axisLayer!: Layer;
	private _axis!: WaveformAxis;
	private _playheadLayer!: PlayheadLayer;

	constructor(
		waveformData: WaveformData,
		container: HTMLDivElement,
		peaks: PeaksInstance,
		viewOptions: ZoomviewOptions | OverviewOptions,
	) {
		this._container = container;
		this.peaks = peaks;
		this._peaks = peaks;
		this._options = peaks.options;
		this._viewOptions = viewOptions;

		this._originalWaveformData = waveformData;
		this._data = waveformData;

		// The pixel offset of the current frame being displayed
		this._frameOffset = 0;
		this._width = container.clientWidth;
		this._height = container.clientHeight;

		this._amplitudeScale = 1.0;

		this._waveformColor = this._viewOptions.waveformColor;
		this._playedWaveformColor = this._viewOptions.playedWaveformColor;

		this._timeLabelPrecision = this._viewOptions.timeLabelPrecision;

		if (this._viewOptions.formatPlayheadTime) {
			this._formatPlayheadTime = this._viewOptions.formatPlayheadTime;
		} else {
			this._formatPlayheadTime = (time) =>
				formatTime(time, this._timeLabelPrecision);
		}

		this._enableSeek = true;

		this.initWaveformData();

		// Disable warning: The stage has 6 layers.
		// Recommended maximum number of layers is 3-5.
		Konva.showWarnings = false;

		this._stage = new Konva.Stage({
			container: container,
			width: this._width,
			height: this._height,
		});

		this._createWaveform();

		if (this._viewOptions.enableSegments) {
			this._segmentsLayer = new SegmentsLayer(
				peaks,
				this,
				this._viewOptions.enableEditing,
			);
			this._segmentsLayer.addToStage(this._stage);
		}

		if (this._viewOptions.enablePoints) {
			this._pointsLayer = new PointsLayer(
				peaks,
				this,
				this._viewOptions.enableEditing,
			);
			this._pointsLayer.addToStage(this._stage);
		}

		this.initHighlightLayer();

		this._createAxisLabels();

		this._playheadLayer = new PlayheadLayer(
			this.peaks.player,
			this,
			this._viewOptions,
		);

		this._playheadLayer.addToStage(this._stage);

		this._onClick = this._onClick.bind(this);
		this._onDblClick = this._onDblClick.bind(this);
		this._onContextMenu = this._onContextMenu.bind(this);

		this._stage.on("click", this._onClick);
		this._stage.on("dblclick", this._onDblClick);
		this._stage.on("contextmenu", this._onContextMenu);
	}

	// Methods to be overridden by subclasses

	initWaveformData(): void {}

	initHighlightLayer(): void {}

	containerWidthChange(): boolean {
		return false;
	}

	containerHeightChange(): void {}

	getName(): string {
		return "";
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

	updateWaveform(_frameOffset?: number, _forceUpdate?: boolean): void {}

	getViewOptions(): ZoomviewOptions | OverviewOptions {
		return this._viewOptions;
	}

	/**
	 * Returns the view's waveform data.
	 */

	getWaveformData(): WaveformData {
		return this._data;
	}

	setWaveformData(waveformData: WaveformData): void {
		this._data = waveformData;
	}

	/**
	 * Returns the pixel index for a given time, for the current zoom level.
	 */

	timeToPixels(time: number): number {
		return Math.floor((time * this._data.sample_rate) / this._data.scale);
	}

	/**
	 * Returns the time for a given pixel index, for the current zoom level.
	 */

	pixelsToTime(pixels: number): number {
		return (pixels * this._data.scale) / this._data.sample_rate;
	}

	/**
	 * Returns the time for a given pixel offset (relative to the
	 * current scroll position), for the current zoom level.
	 */

	pixelOffsetToTime(offset: number): number {
		const pixels = this._frameOffset + offset;

		return (pixels * this._data.scale) / this._data.sample_rate;
	}

	timeToPixelOffset(time: number): number {
		return (
			Math.floor((time * this._data.sample_rate) / this._data.scale) -
			this._frameOffset
		);
	}

	/**
	 * Returns the start position of the waveform shown in the view, in pixels.
	 */

	getFrameOffset(): number {
		return this._frameOffset;
	}

	/**
	 * Returns the width of the view, in pixels.
	 */

	getWidth(): number {
		return this._width;
	}

	/**
	 * Returns the height of the view, in pixels.
	 */

	getHeight(): number {
		return this._height;
	}

	/**
	 * Returns the time at the left edge of the waveform view.
	 */

	getStartTime(): number {
		return this.pixelOffsetToTime(0);
	}

	/**
	 * Returns the time at the right edge of the waveform view.
	 */

	getEndTime(): number {
		return this.pixelOffsetToTime(this._width);
	}

	/**
	 * Returns the media duration, in seconds.
	 */

	_getDuration(): number {
		return this.peaks.player.getDuration();
	}

	_createWaveform(): void {
		this._waveformLayer = new Konva.Layer({ listening: false });

		this._createWaveformShapes();

		this._stage.add(this._waveformLayer);
	}

	_createWaveformShapes(): void {
		if (!this._waveformShape) {
			this._waveformShape = new WaveformShape({
				color: this._waveformColor,
				view: this,
			});

			this._waveformShape.addToLayer(this._waveformLayer);
		}

		if (this._playedWaveformColor && !this._playedWaveformShape) {
			const time = this.peaks.player.getCurrentTime();

			this._playedSegment = {
				startTime: 0,
				endTime: time,
			};

			this._unplayedSegment = {
				startTime: time,
				endTime: this._getDuration(),
			};

			this._waveformShape.setSegment(this._unplayedSegment);

			this._playedWaveformShape = new WaveformShape({
				color: this._playedWaveformColor,
				view: this,
				segment: this._playedSegment,
			});

			this._playedWaveformShape.addToLayer(this._waveformLayer);
		}
	}

	setWaveformColor(color: WaveformColor): void {
		this._waveformColor = color;
		this._waveformShape.setWaveformColor(color);
	}

	setPlayedWaveformColor(color: WaveformColor | undefined): void {
		this._playedWaveformColor = color;

		if (color) {
			if (!this._playedWaveformShape) {
				this._createWaveformShapes();
			}

			this._playedWaveformShape?.setWaveformColor(color);
		} else {
			if (this._playedWaveformShape) {
				this._destroyPlayedWaveformShape();
			}
		}
	}

	_destroyPlayedWaveformShape(): void {
		this._waveformShape.setSegment(undefined);

		this._playedWaveformShape?.destroy();
		this._playedWaveformShape = null;

		this._playedSegment = null;
		this._unplayedSegment = null;
	}

	_createAxisLabels(): void {
		this._axisLayer = new Konva.Layer({ listening: false });
		this._axis = new WaveformAxis(this, this._viewOptions);

		this._axis.addToLayer(this._axisLayer);
		this._stage.add(this._axisLayer);
	}

	showAxisLabels(
		show: boolean,
		options?: { topMarkerHeight?: number; bottomMarkerHeight?: number },
	): void {
		this._axis.showAxisLabels(show, options);
		this._axisLayer.draw();
	}

	setAxisLabelColor(color: string): void {
		this._axis.setAxisLabelColor(color);
		this._axisLayer.draw();
	}

	setAxisGridlineColor(color: string): void {
		this._axis.setAxisGridlineColor(color);
		this._axisLayer.draw();
	}

	showPlayheadTime(show: boolean): void {
		this._playheadLayer.showPlayheadTime(show);
	}

	setTimeLabelPrecision(precision: number): void {
		this._timeLabelPrecision = precision;
		this._playheadLayer.updatePlayheadText();
	}

	formatTime(time: number): string {
		return this._formatPlayheadTime(time);
	}

	/**
	 * Adjusts the amplitude scale of waveform shown in the view, which allows
	 * users to zoom the waveform vertically.
	 *
	 * @throws {Error} If scale is not a finite numeric value.
	 */

	setAmplitudeScale(scale: number): undefined | never {
		if (!isNumber(scale) || !isFinite(scale)) {
			throw new Error("view.setAmplitudeScale(): Scale must be a valid number");
		}

		this._amplitudeScale = scale;

		this.drawWaveformLayer();

		if (this._segmentsLayer) {
			this._segmentsLayer.draw();
		}
	}

	getAmplitudeScale(): number {
		return this._amplitudeScale;
	}

	enableSeek(enable: boolean): void {
		this._enableSeek = enable;
	}

	isSeekEnabled(): boolean {
		return this._enableSeek;
	}

	_onClick(event: KonvaEventObject<MouseEvent>): void {
		this._clickHandler(event, "click");
	}

	_onDblClick(event: KonvaEventObject<MouseEvent>): void {
		this._clickHandler(event, "dblclick");
	}

	_onContextMenu(event: KonvaEventObject<MouseEvent>): void {
		this._clickHandler(event, "contextmenu");
	}

	_clickHandler(event: KonvaEventObject<MouseEvent>, eventName: string): void {
		let offsetX = event.evt.offsetX;

		if (offsetX < 0) {
			offsetX = 0;
		}

		let emitViewEvent = true;

		if (event.target !== this._stage) {
			const marker = getMarkerObject(event.target);

			if (marker) {
				if (marker.attrs.name === "point-marker") {
					const point = marker.getAttr("point");

					if (point) {
						this.peaks.emit(`points.${eventName}`, {
							point: point,
							evt: event.evt,
							preventViewEvent: () => {
								emitViewEvent = false;
							},
						});
					}
				} else if (marker.attrs.name === "segment-overlay") {
					const segment = marker.getAttr("segment");

					if (segment) {
						const clickEvent = {
							segment: segment,
							evt: event.evt,
							preventViewEvent: () => {
								emitViewEvent = false;
							},
						};

						if (this._segmentsLayer) {
							this._segmentsLayer.segmentClicked(eventName, clickEvent);
						}
					}
				}
			}
		}

		if (emitViewEvent) {
			const time = this.pixelOffsetToTime(offsetX);
			const viewName = this.getName();

			this.peaks.emit(`${viewName}.${eventName}`, {
				time: time,
				evt: event.evt,
			});
		}
	}

	updatePlayheadTime(time: number): void {
		this._playheadLayer.updatePlayheadTime(time);
	}

	playheadPosChanged(time: number): void {
		if (
			this._playedWaveformShape &&
			this._playedSegment &&
			this._unplayedSegment
		) {
			this._playedSegment.endTime = time;
			this._unplayedSegment.startTime = time;

			this.drawWaveformLayer();
		}
	}

	drawWaveformLayer(): void {
		this._waveformLayer.draw();
	}

	enableMarkerEditing(enable: boolean): void {
		if (this._segmentsLayer) {
			this._segmentsLayer.enableEditing(enable);
		}

		if (this._pointsLayer) {
			this._pointsLayer.enableEditing(enable);
		}
	}

	/**
	 * Called when the user starts or stops dragging the playhead.
	 * We use this to disable interaction with the points and segments layers,
	 * e.g., so that when the user drags the playhead over a marker, the timestamp
	 * labels don't appear.
	 */

	dragSeek(dragging: boolean): void {
		if (this._segmentsLayer) {
			this._segmentsLayer.setListening(!dragging);
		}

		if (this._pointsLayer) {
			this._pointsLayer.setListening(!dragging);
		}
	}

	fitToContainer(): void {
		if (
			this._container.clientWidth === 0 &&
			this._container.clientHeight === 0
		) {
			return;
		}

		let updateWaveform = false;

		if (this._container.clientWidth !== this._width) {
			this._width = this._container.clientWidth;
			this._stage.width(this._width);

			updateWaveform = this.containerWidthChange();
		}

		let heightChanged = false;

		if (this._container.clientHeight !== this._height) {
			this._height = this._container.clientHeight;
			this._stage.height(this._height);

			this._waveformShape.fitToView();
			this._playheadLayer.fitToView();

			this.containerHeightChange();

			heightChanged = true;
		}

		if (updateWaveform) {
			this.updateWaveform(this._frameOffset, true);
		} else if (heightChanged) {
			if (this._segmentsLayer) {
				this._segmentsLayer.fitToView();
			}

			if (this._pointsLayer) {
				this._pointsLayer.fitToView();
			}
		}
	}

	destroy(): void {
		this._playheadLayer.destroy();

		if (this._segmentsLayer) {
			this._segmentsLayer.destroy();
		}

		if (this._pointsLayer) {
			this._pointsLayer.destroy();
		}

		if (this._stage) {
			this._stage.destroy();
		}
	}
}
