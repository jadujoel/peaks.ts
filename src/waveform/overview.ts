import type WaveformData from "waveform-data";
import { HighlightLayer } from "../highlight-layer";
import { SeekMouseDragHandler } from "../seek-mouse-drag-handler";
import type { OverviewOptions, PeaksInstance } from "../types";
import { WaveformView, type WaveformViewState } from "./view";

export type SeekMouseDragHandlerViewParam = Parameters<
	typeof SeekMouseDragHandler.from
>[0]["view"];

export interface WaveformOverviewFromOptions {
	readonly waveformData: WaveformData;
	readonly container: HTMLDivElement;
	readonly peaks: PeaksInstance;
}

export class WaveformOverview extends WaveformView {
	public mouseDragHandler: SeekMouseDragHandler | undefined;
	public highlightLayer: HighlightLayer | undefined;

	static from(options: WaveformOverviewFromOptions): WaveformOverview {
		const instance = new WaveformOverview(
			WaveformOverview.createState({
				container: options.container,
				peaks: options.peaks,
				viewOptions: options.peaks.options.overview,
				waveformData: options.waveformData,
			}),
		);
		instance.initializeView();
		instance.initializeOverview();
		return instance;
	}

	private constructor(state: WaveformViewState) {
		super(state);
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

	override initWaveformData(): void {
		if (this.width !== 0) {
			this.resampleAndSetWaveformData(this.originalWaveformData, this.width);
		}
	}

	override initHighlightLayer(): void {
		this.highlightLayer = HighlightLayer.from({
			options: this.viewOptions as OverviewOptions,
			view: this,
		});

		this.highlightLayer.addToStage(this.stage);
	}

	override isSegmentDraggingEnabled(): boolean {
		return false;
	}

	override getName(): string {
		return "overview";
	}

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

	showHighlight(startTime: number, endTime: number): void {
		this.highlightLayer?.showHighlight(startTime, endTime);
	}

	override setWaveformData(waveformData: WaveformData): void {
		this.originalWaveformData = waveformData;

		if (this.width !== 0) {
			this.resampleAndSetWaveformData(waveformData, this.width);
		} else {
			this.data = waveformData;
		}

		this.updateWaveform();
	}

	private resampleAndSetWaveformData(
		waveformData: WaveformData,
		width: number,
	): boolean {
		try {
			this.data = waveformData.resample({ width: width });
			return true;
		} catch {
			// This error usually indicates that the waveform length
			// is less than the container width. Ignore, and use the
			// given waveform data
			this.data = waveformData;
			return false;
		}
	}

	removeHighlightRect(): void {
		this.highlightLayer?.removeHighlight();
	}

	override updateWaveform(): void {
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

	override containerWidthChange(): boolean {
		return this.resampleAndSetWaveformData(
			this.originalWaveformData,
			this.width,
		);
	}

	override containerHeightChange(): void {
		this.highlightLayer?.fitToView();
	}

	override dispose(): void {
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

		super.dispose();
	}
}
