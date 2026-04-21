import Konva from "konva/lib/Core";
import type { Layer } from "konva/lib/Layer";
import type { KonvaEventObject } from "konva/lib/Node";
import type { Stage } from "konva/lib/Stage";
import type WaveformData from "waveform-data";
import { PlayheadLayer } from "../playhead-layer";
import { PointsLayer } from "../points-layer";
import { SegmentsLayer } from "../segments-layer";
import type {
	OverviewOptions,
	PeaksInstance,
	WaveformViewAPI,
	ZoomviewOptions,
} from "../types";
import type { WaveformColor } from "../utils";
import { formatTime, getMarkerObject, isFinite, isNumber } from "../utils";

import { WaveformAxis } from "./axis";
import { WaveformShape } from "./shape";

export interface PlayedSegment {
	startTime: number;
	endTime: number;
}

export interface WaveformViewStateFromOptions {
	readonly waveformData: WaveformData;
	readonly container: HTMLDivElement;
	readonly peaks: PeaksInstance;
	readonly viewOptions: ZoomviewOptions | OverviewOptions;
}

export interface WaveformViewState {
	readonly peaks: PeaksInstance;
	readonly container: HTMLDivElement;
	readonly peaksOptions: PeaksInstance["options"];
	readonly viewOptions: ZoomviewOptions | OverviewOptions;
	readonly originalWaveformData: WaveformData;
	readonly data: WaveformData;
	readonly frameOffset: number;
	readonly width: number;
	readonly height: number;
	readonly amplitudeScale: number;
	readonly waveformColor: WaveformColor;
	readonly playedWaveformColor: WaveformColor | undefined;
	readonly timeLabelPrecision: number;
	readonly formatPlayheadTimeFn?: (time: number) => string;
	readonly seekEnabled: boolean;
}

export class WaveformView {
	public peaks: PeaksInstance;
	protected container: HTMLDivElement;
	protected peaksOptions: PeaksInstance["options"];
	protected viewOptions: ZoomviewOptions | OverviewOptions;
	protected originalWaveformData: WaveformData;
	public data: WaveformData;
	protected frameOffset: number;
	protected width: number;
	public height: number;
	protected amplitudeScale: number;
	protected waveformColor: WaveformColor;
	protected playedWaveformColor: WaveformColor | undefined;
	protected timeLabelPrecision: number;
	protected formatPlayheadTimeFn: (time: number) => string;
	protected seekEnabled: boolean;
	public declare stage: Stage;
	protected declare waveformLayer: Layer;
	protected declare waveformShape: WaveformShape;
	protected declare playedWaveformShape: WaveformShape | undefined;
	protected declare playedSegment: PlayedSegment | undefined;
	protected declare unplayedSegment: PlayedSegment | undefined;
	public declare segmentsLayer: SegmentsLayer | undefined;
	public declare pointsLayer: PointsLayer | undefined;
	protected declare axisLayer: Layer;
	protected declare axis: WaveformAxis;
	protected declare playheadLayer: PlayheadLayer;

	protected constructor(state: WaveformViewState) {
		this.container = state.container;
		this.peaks = state.peaks;
		this.peaksOptions = state.peaksOptions;
		this.viewOptions = state.viewOptions;
		this.originalWaveformData = state.originalWaveformData;
		this.data = state.data;
		this.frameOffset = state.frameOffset;
		this.width = state.width;
		this.height = state.height;
		this.amplitudeScale = state.amplitudeScale;
		this.waveformColor = state.waveformColor;
		this.playedWaveformColor = state.playedWaveformColor;
		this.timeLabelPrecision = state.timeLabelPrecision;
		this.formatPlayheadTimeFn =
			state.formatPlayheadTimeFn ??
			((time: number) => formatTime(time, this.timeLabelPrecision));
		this.seekEnabled = state.seekEnabled;
	}

	protected static createState(
		options: WaveformViewStateFromOptions,
	): WaveformViewState {
		const timeLabelPrecision = options.viewOptions.timeLabelPrecision;

		return {
			amplitudeScale: 1.0,
			container: options.container,
			data: options.waveformData,
			frameOffset: 0,
			height: options.container.clientHeight,
			originalWaveformData: options.waveformData,
			peaks: options.peaks,
			peaksOptions: options.peaks.options,
			playedWaveformColor: options.viewOptions.playedWaveformColor,
			seekEnabled: true,
			timeLabelPrecision,
			viewOptions: options.viewOptions,
			waveformColor: options.viewOptions.waveformColor,
			width: options.container.clientWidth,
			...(options.viewOptions.formatPlayheadTime
				? { formatPlayheadTimeFn: options.viewOptions.formatPlayheadTime }
				: {}),
		};
	}

	protected initializeView(): void {
		this.initWaveformData();

		// Disable warning: The stage has 6 layers.
		// Recommended maximum number of layers is 3-5.
		Konva.showWarnings = false;

		this.stage = new Konva.Stage({
			container: this.container,
			height: this.height,
			width: this.width,
		});

		this.createWaveform();

		if (this.viewOptions.enableSegments) {
			this.segmentsLayer = SegmentsLayer.from({
				enableEditing: this.viewOptions.enableEditing ?? false,
				peaks: this.peaks,
				view: this as unknown as WaveformViewAPI,
			});
			this.segmentsLayer.addToStage(this.stage);
		}

		if (this.viewOptions.enablePoints) {
			this.pointsLayer = PointsLayer.from({
				enableEditing: this.viewOptions.enableEditing ?? false,
				peaks: this.peaks,
				view: this as unknown as WaveformViewAPI,
			});
			this.pointsLayer.addToStage(this.stage);
		}

		this.initHighlightLayer();

		this.createAxisLabels();

		this.playheadLayer = PlayheadLayer.from({
			options: this.viewOptions,
			player: this.peaks.player,
			view: this as unknown as WaveformViewAPI,
		});

		this.playheadLayer.addToStage(this.stage);

		this.stage.on("click", this.onClick);
		this.stage.on("dblclick", this.onDblClick);
		this.stage.on("contextmenu", this.onContextMenu);
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
		return this.viewOptions;
	}

	/**
	 * Returns the view's waveform data.
	 */

	getWaveformData(): WaveformData {
		return this.data;
	}

	setWaveformData(waveformData: WaveformData): void {
		this.data = waveformData;
	}

	/**
	 * Returns the pixel index for a given time, for the current zoom level.
	 */

	timeToPixels(time: number): number {
		return Math.floor((time * this.data.sample_rate) / this.data.scale);
	}

	/**
	 * Returns the time for a given pixel index, for the current zoom level.
	 */

	pixelsToTime(pixels: number): number {
		return (pixels * this.data.scale) / this.data.sample_rate;
	}

	/**
	 * Returns the time for a given pixel offset (relative to the
	 * current scroll position), for the current zoom level.
	 */

	pixelOffsetToTime(offset: number): number {
		const pixels = this.frameOffset + offset;

		return (pixels * this.data.scale) / this.data.sample_rate;
	}

	timeToPixelOffset(time: number): number {
		return (
			Math.floor((time * this.data.sample_rate) / this.data.scale) -
			this.frameOffset
		);
	}

	/**
	 * Returns the start position of the waveform shown in the view, in pixels.
	 */

	getFrameOffset(): number {
		return this.frameOffset;
	}

	/**
	 * Returns the width of the view, in pixels.
	 */

	getWidth(): number {
		return this.width;
	}

	/**
	 * Returns the height of the view, in pixels.
	 */

	getHeight(): number {
		return this.height;
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
		return this.pixelOffsetToTime(this.width);
	}

	/**
	 * Returns the media duration, in seconds.
	 */

	getDuration(): number {
		return this.peaks.player.getDuration();
	}

	private createWaveform(): void {
		this.waveformLayer = new Konva.Layer({ listening: false });

		this.createWaveformShapes();

		this.stage.add(this.waveformLayer);
	}

	private createWaveformShapes(): void {
		if (!this.waveformShape) {
			this.waveformShape = WaveformShape.from({
				color: this.waveformColor,
				view: this as unknown as WaveformViewAPI,
			});

			this.waveformShape.addToLayer(this.waveformLayer);
		}

		if (this.playedWaveformColor && !this.playedWaveformShape) {
			const time = this.peaks.player.getCurrentTime();

			this.playedSegment = {
				endTime: time,
				startTime: 0,
			};

			this.unplayedSegment = {
				endTime: this.getDuration(),
				startTime: time,
			};

			this.waveformShape.setSegment(this.unplayedSegment);

			this.playedWaveformShape = WaveformShape.from({
				color: this.playedWaveformColor,
				segment: this.playedSegment,
				view: this as unknown as WaveformViewAPI,
			});

			this.playedWaveformShape.addToLayer(this.waveformLayer);
		}
	}

	setWaveformColor(color: WaveformColor): void {
		this.waveformColor = color;
		this.waveformShape.setWaveformColor(color);
	}

	setPlayedWaveformColor(color: WaveformColor | undefined): void {
		this.playedWaveformColor = color;

		if (color) {
			if (!this.playedWaveformShape) {
				this.createWaveformShapes();
			}

			this.playedWaveformShape?.setWaveformColor(color);
		} else {
			if (this.playedWaveformShape) {
				this.destroyPlayedWaveformShape();
			}
		}
	}

	private destroyPlayedWaveformShape(): void {
		this.waveformShape.setSegment(undefined);

		this.playedWaveformShape?.destroy();
		this.playedWaveformShape = undefined;

		this.playedSegment = undefined;
		this.unplayedSegment = undefined;
	}

	private createAxisLabels(): void {
		this.axisLayer = new Konva.Layer({ listening: false });
		this.axis = WaveformAxis.from({
			options: this.viewOptions,
			view: this as unknown as WaveformViewAPI,
		});

		this.axis.addToLayer(this.axisLayer);
		this.stage.add(this.axisLayer);
	}

	showAxisLabels(
		show: boolean,
		options?: { topMarkerHeight?: number; bottomMarkerHeight?: number },
	): void {
		this.axis.showAxisLabels(show, options);
		this.axisLayer.draw();
	}

	setAxisLabelColor(color: string): void {
		this.axis.setAxisLabelColor(color);
		this.axisLayer.draw();
	}

	setAxisGridlineColor(color: string): void {
		this.axis.setAxisGridlineColor(color);
		this.axisLayer.draw();
	}

	showPlayheadTime(show: boolean): void {
		this.playheadLayer.showPlayheadTime(show);
	}

	setTimeLabelPrecision(precision: number): void {
		this.timeLabelPrecision = precision;
		this.playheadLayer.updatePlayheadText();
	}

	formatTime(time: number): string {
		return this.formatPlayheadTimeFn(time);
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

		this.amplitudeScale = scale;

		this.drawWaveformLayer();

		if (this.segmentsLayer) {
			this.segmentsLayer.draw();
		}
	}

	getAmplitudeScale(): number {
		return this.amplitudeScale;
	}

	enableSeek(enable: boolean): void {
		this.seekEnabled = enable;
	}

	isSeekEnabled(): boolean {
		return this.seekEnabled;
	}

	private onClick = (event: KonvaEventObject<MouseEvent>): void => {
		this.clickHandler(event, "click");
	};

	private onDblClick = (event: KonvaEventObject<MouseEvent>): void => {
		this.clickHandler(event, "dblclick");
	};

	private onContextMenu = (event: KonvaEventObject<MouseEvent>): void => {
		this.clickHandler(event, "contextmenu");
	};

	private clickHandler(
		event: KonvaEventObject<MouseEvent>,
		eventName: string,
	): void {
		let offsetX = event.evt.offsetX;

		if (offsetX < 0) {
			offsetX = 0;
		}

		let emitViewEvent = true;

		if (event.target !== this.stage) {
			const marker = getMarkerObject(event.target);

			if (marker) {
				if (marker.attrs.name === "point-marker") {
					const point = marker.getAttr("point");

					if (point) {
						this.peaks.emit(`points.${eventName}`, {
							evt: event.evt,
							point: point,
							preventViewEvent: () => {
								emitViewEvent = false;
							},
						});
					}
				} else if (marker.attrs.name === "segment-overlay") {
					const segment = marker.getAttr("segment");

					if (segment) {
						const clickEvent = {
							evt: event.evt,
							preventViewEvent: () => {
								emitViewEvent = false;
							},
							segment: segment,
						};

						if (this.segmentsLayer) {
							this.segmentsLayer.segmentClicked(eventName, clickEvent);
						}
					}
				}
			}
		}

		if (emitViewEvent) {
			const time = this.pixelOffsetToTime(offsetX);
			const viewName = this.getName();

			this.peaks.emit(`${viewName}.${eventName}`, {
				evt: event.evt,
				time: time,
			});
		}
	}

	updatePlayheadTime(time: number): void {
		this.playheadLayer.updatePlayheadTime(time);
	}

	playheadPosChanged(time: number): void {
		if (
			this.playedWaveformShape &&
			this.playedSegment &&
			this.unplayedSegment
		) {
			this.playedSegment.endTime = time;
			this.unplayedSegment.startTime = time;

			this.drawWaveformLayer();
		}
	}

	drawWaveformLayer(): void {
		this.waveformLayer.draw();
	}

	enableMarkerEditing(enable: boolean): void {
		if (this.segmentsLayer) {
			this.segmentsLayer.enableEditing(enable);
		}

		if (this.pointsLayer) {
			this.pointsLayer.enableEditing(enable);
		}
	}

	/**
	 * Called when the user starts or stops dragging the playhead.
	 * We use this to disable interaction with the points and segments layers,
	 * e.g., so that when the user drags the playhead over a marker, the timestamp
	 * labels don't appear.
	 */

	dragSeek(dragging: boolean): void {
		if (this.segmentsLayer) {
			this.segmentsLayer.setListening(!dragging);
		}

		if (this.pointsLayer) {
			this.pointsLayer.setListening(!dragging);
		}
	}

	fitToContainer(): void {
		if (this.container.clientWidth === 0 && this.container.clientHeight === 0) {
			return;
		}

		let updateWaveform = false;

		if (this.container.clientWidth !== this.width) {
			this.width = this.container.clientWidth;
			this.stage.width(this.width);

			updateWaveform = this.containerWidthChange();
		}

		let heightChanged = false;

		if (this.container.clientHeight !== this.height) {
			this.height = this.container.clientHeight;
			this.stage.height(this.height);

			this.waveformShape.fitToView();
			this.playheadLayer.fitToView();

			this.containerHeightChange();

			heightChanged = true;
		}

		if (updateWaveform) {
			this.updateWaveform(this.frameOffset, true);
		} else if (heightChanged) {
			if (this.segmentsLayer) {
				this.segmentsLayer.fitToView();
			}

			if (this.pointsLayer) {
				this.pointsLayer.fitToView();
			}
		}
	}

	destroy(): void {
		this.playheadLayer.dispose();

		if (this.segmentsLayer) {
			this.segmentsLayer.dispose();
		}

		if (this.pointsLayer) {
			this.pointsLayer.dispose();
		}

		if (this.stage) {
			this.stage.destroy();
		}
	}
}
