import type WaveformData from "waveform-data";
import { HighlightLayer } from "./highlight-layer";
import { SeekMouseDragHandler } from "./seek-mouse-drag-handler";

type SeekMouseDragHandlerViewParam = Parameters<
	typeof SeekMouseDragHandler.from
>[0]["view"];

import type { OverviewOptions, PeaksInstance } from "./types";
import { WaveformView } from "./waveform-view";

export interface WaveformOverviewFromOptions {
	readonly waveformData: WaveformData;
	readonly container: HTMLDivElement;
	readonly peaks: PeaksInstance;
}

export class WaveformOverview extends WaveformView {
	declare mouseDragHandler: SeekMouseDragHandler;
	declare highlightLayer?: HighlightLayer;

	static from(options: WaveformOverviewFromOptions): WaveformOverview {
		return new WaveformOverview(
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
		super(waveformData, container, peaks, peaks.options.overview);

		// Register event handlers
		peaks.on("player.timeupdate", this.onTimeUpdate);
		peaks.on("player.playing", this.onPlaying);
		peaks.on("player.pause", this.onPause);
		peaks.on("zoomview.update", this.onZoomviewUpdate);

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
			view: this,
			options: this.viewOptions as OverviewOptions,
		});

		this.highlightLayer.addToStage(this.stage);
	}

	override isSegmentDraggingEnabled(): boolean {
		return false;
	}

	override getName(): string {
		return "overview";
	}

	private onTimeUpdate = (time: number): void => {
		this.playheadLayer.updatePlayheadTime(time);
	};

	private onPlaying = (time: number): void => {
		this.playheadLayer.updatePlayheadTime(time);
	};

	private onPause = (time: number): void => {
		this.playheadLayer.stop(time);
	};

	private onZoomviewUpdate = (event: { startTime: number; endTime: number }): void => {
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

	override destroy(): void {
		// Unregister event handlers
		this.peaks.off("player.playing", this.onPlaying);
		this.peaks.off("player.pause", this.onPause);
		this.peaks.off("player.timeupdate", this.onTimeUpdate);
		this.peaks.off("zoomview.update", this.onZoomviewUpdate);

		this.mouseDragHandler.destroy();

		super.destroy();
	}
}
