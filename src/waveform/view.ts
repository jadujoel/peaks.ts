import type WaveformData from "waveform-data";
import type {
	CanvasDriver,
	DriverLayer,
	DriverStage,
	PeaksPointerEvent,
} from "../driver/types";
import type {
	PointClickEvent,
	PointerInteractionName,
	ViewName,
} from "../events";
import { PlayheadLayer } from "../playhead-layer";
import { PointsLayer } from "../points-layer";
import { SegmentsLayer } from "../segments-layer";
import type {
	OverviewOptions,
	PeaksInstance,
	SegmentClickEvent,
	WaveformViewAPI,
	ZoomviewOptions,
} from "../types";
import type { WaveformColor } from "../utils";
import { formatTime, getMarkerObject, isNumber } from "../utils";

import { WaveformAxis } from "./axis";
import { WaveformShape } from "./shape";

export interface PlayedSegment {
	startTime: number;
	endTime: number;
}

/**
 * Hooks injected by a host view (e.g. `WaveformZoomView`,
 * `WaveformOverview`) to provide view-specific behaviour without
 * inheritance.
 */
export interface WaveformViewHooks {
	getName(): string;
	isSegmentDraggingEnabled(): boolean;
	getMinSegmentDragWidth(): number;
	getSegmentDragMode(): string;
	initWaveformData(): void;
	initHighlightLayer(): void;
	containerWidthChange(): boolean;
	containerHeightChange(): void;
	updateWaveform(frameOffset?: number, force?: boolean): void;
}

export interface WaveformViewFromOptions {
	readonly waveformData: WaveformData;
	readonly container: HTMLDivElement;
	readonly peaks: PeaksInstance;
	readonly viewOptions: ZoomviewOptions | OverviewOptions;
}

export class WaveformView {
	public hooks!: WaveformViewHooks;
	public host!: WaveformViewAPI;
	public stage!: DriverStage;
	public waveformLayer!: DriverLayer;
	public waveformShape!: WaveformShape;
	public playedWaveformShape: WaveformShape | undefined;
	public playedSegment: PlayedSegment | undefined;
	public unplayedSegment: PlayedSegment | undefined;
	public segmentsLayer: SegmentsLayer | undefined;
	public pointsLayer: PointsLayer | undefined;
	public axisLayer!: DriverLayer;
	public axis!: WaveformAxis;
	public playheadLayer!: PlayheadLayer;
	public formatPlayheadTimeFn: (time: number) => string;

	private constructor(
		public readonly peaks: PeaksInstance,
		public readonly container: HTMLDivElement,
		public readonly peaksOptions: PeaksInstance["options"],
		public readonly viewOptions: ZoomviewOptions | OverviewOptions,
		public originalWaveformData: WaveformData,
		public data: WaveformData,
		public frameOffset: number,
		public width: number,
		public height: number,
		public amplitudeScale: number,
		public waveformColor: WaveformColor,
		public playedWaveformColor: WaveformColor | undefined,
		public timeLabelPrecision: number,
		public seekEnabled: boolean,
		public readonly driver: CanvasDriver,
		formatPlayheadTimeFn: ((time: number) => string) | undefined,
	) {
		this.formatPlayheadTimeFn =
			formatPlayheadTimeFn ??
			((time: number) => formatTime(time, this.timeLabelPrecision));
	}

	static from(options: WaveformViewFromOptions): WaveformView {
		const peaks = options.peaks;
		const viewOptions = options.viewOptions;

		return new WaveformView(
			peaks,
			options.container,
			peaks.options,
			viewOptions,
			options.waveformData,
			options.waveformData,
			0,
			options.container.clientWidth,
			options.container.clientHeight,
			1.0,
			viewOptions.waveformColor,
			viewOptions.playedWaveformColor,
			viewOptions.timeLabelPrecision,
			true,
			peaks.options.driver,
			viewOptions.formatPlayheadTime,
		);
	}

	/**
	 * Wires up hooks and constructs all Konva layers. Must be called once
	 * by the composing view after its own state is fully initialised so
	 * that the hook callbacks can safely access composite state.
	 */
	async initialize(
		hooks: WaveformViewHooks,
		host: WaveformViewAPI,
	): Promise<void> {
		this.hooks = hooks;
		this.host = host;

		this.hooks.initWaveformData();

		this.stage = await this.driver.createStage({
			container: this.container,
			height: this.height,
			width: this.width,
		});

		this.createWaveform();

		if (this.viewOptions.enableSegments) {
			this.segmentsLayer = SegmentsLayer.from({
				enableEditing: this.viewOptions.enableEditing ?? false,
				peaks: this.peaks,
				view: this.host,
			});
			this.segmentsLayer.addToStage(this.stage);
		}

		if (this.viewOptions.enablePoints) {
			this.pointsLayer = PointsLayer.from({
				enableEditing: this.viewOptions.enableEditing ?? false,
				peaks: this.peaks,
				view: this.host,
			});
			this.pointsLayer.addToStage(this.stage);
		}

		this.hooks.initHighlightLayer();

		this.createAxisLabels();

		this.playheadLayer = PlayheadLayer.from({
			options: this.viewOptions,
			player: this.peaks.player,
			view: this.host,
		});

		this.playheadLayer.addToStage(this.stage);

		this.stage.on("click", this.onClick);
		this.stage.on("dblclick", this.onDblClick);
		this.stage.on("contextmenu", this.onContextMenu);
	}

	getName(): string {
		return this.hooks.getName();
	}

	isSegmentDraggingEnabled(): boolean {
		return this.hooks.isSegmentDraggingEnabled();
	}

	getMinSegmentDragWidth(): number {
		return this.hooks.getMinSegmentDragWidth();
	}

	getSegmentDragMode(): string {
		return this.hooks.getSegmentDragMode();
	}

	updateWaveform(frameOffset?: number, forceUpdate?: boolean): void {
		this.hooks.updateWaveform(frameOffset, forceUpdate);
	}

	getViewOptions(): ZoomviewOptions | OverviewOptions {
		return this.viewOptions;
	}

	getDriver(): CanvasDriver {
		return this.driver;
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
		this.waveformLayer = this.driver.createLayer({ listening: false });

		this.createWaveformShapes();

		this.stage.add(this.waveformLayer);
	}

	createWaveformShapes(): void {
		if (!this.waveformShape) {
			this.waveformShape = WaveformShape.from({
				color: this.waveformColor,
				view: this.host,
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
				view: this.host,
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

		this.playedWaveformShape?.dispose();
		this.playedWaveformShape = undefined;

		this.playedSegment = undefined;
		this.unplayedSegment = undefined;
	}

	private createAxisLabels(): void {
		this.axisLayer = this.driver.createLayer({ listening: false });
		this.axis = WaveformAxis.from({
			options: this.viewOptions,
			view: this.host,
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

	setPlayheadColor(color: string): void {
		this.playheadLayer.setPlayheadColor(color);
	}

	setPlayheadTextColor(color: string): void {
		this.playheadLayer.setPlayheadTextColor(color);
	}

	setSegmentStartMarkerColor(color: string): void {
		const segmentOptions = this.viewOptions.segmentOptions as unknown as {
			startMarkerColor: string;
		};
		segmentOptions.startMarkerColor = color;
		this.segmentsLayer?.rebuild();
	}

	setSegmentEndMarkerColor(color: string): void {
		const segmentOptions = this.viewOptions.segmentOptions as unknown as {
			endMarkerColor: string;
		};
		segmentOptions.endMarkerColor = color;
		this.segmentsLayer?.rebuild();
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
		if (!isNumber(scale) || !Number.isFinite(scale)) {
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

	private onClick = (event: PeaksPointerEvent<MouseEvent>): void => {
		this.clickHandler(event, "click");
	};

	private onDblClick = (event: PeaksPointerEvent<MouseEvent>): void => {
		this.clickHandler(event, "dblclick");
	};

	private onContextMenu = (event: PeaksPointerEvent<MouseEvent>): void => {
		this.clickHandler(event, "contextmenu");
	};

	private clickHandler(
		event: PeaksPointerEvent<MouseEvent>,
		eventName: PointerInteractionName,
	): void {
		let offsetX = event.evt.offsetX;

		if (offsetX < 0) {
			offsetX = 0;
		}

		let emitViewEvent = true;

		if (event.target !== (this.stage as unknown as typeof event.target)) {
			const marker = getMarkerObject(event.target);

			if (marker) {
				if (marker.attrs?.name === "point-marker") {
					const point = marker.getAttr?.("point");

					if (point) {
						this.peaks.events.dispatch(`points.${eventName}`, {
							evt: event.evt,
							point: point as PointClickEvent["point"],
							preventViewEvent: () => {
								emitViewEvent = false;
							},
						});
					}
				} else if (marker.attrs?.name === "segment-overlay") {
					const segment = marker.getAttr?.("segment");

					if (segment) {
						const clickEvent: SegmentClickEvent = {
							evt: event.evt,
							preventViewEvent: () => {
								emitViewEvent = false;
							},
							segment: segment as SegmentClickEvent["segment"],
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
			const viewName = this.getName() as ViewName;

			this.peaks.events.dispatch(`${viewName}.${eventName}`, {
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
		this.segmentsLayer?.setListening(!dragging);
		this.pointsLayer?.setListening(!dragging);
	}

	fitToContainer(): void {
		if (this.container.clientWidth === 0 && this.container.clientHeight === 0) {
			return;
		}

		let updateWaveform = false;

		if (this.container.clientWidth !== this.width) {
			this.width = this.container.clientWidth;
			this.stage.width(this.width);

			updateWaveform = this.hooks.containerWidthChange();
		}

		let heightChanged = false;

		if (this.container.clientHeight !== this.height) {
			this.height = this.container.clientHeight;
			this.stage.height(this.height);

			this.waveformShape.fitToView();
			this.playheadLayer.fitToView();

			this.hooks.containerHeightChange();

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

	dispose(): void {
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
