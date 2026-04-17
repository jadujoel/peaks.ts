import type WaveformData from "waveform-data";
import HighlightLayer from "./highlight-layer";
import SeekMouseDragHandler from "./seek-mouse-drag-handler";
import type { OverviewOptions, PeaksInstance } from "./types";
import WaveformView from "./waveform-view";

class WaveformOverview extends WaveformView {
	declare _mouseDragHandler: SeekMouseDragHandler;

	constructor(
		waveformData: WaveformData,
		container: HTMLDivElement,
		peaks: PeaksInstance,
	) {
		super(waveformData, container, peaks, peaks.options.overview);

		// Bind event handlers
		this._onTimeUpdate = this._onTimeUpdate.bind(this);
		this._onPlaying = this._onPlaying.bind(this);
		this._onPause = this._onPause.bind(this);
		this._onZoomviewUpdate = this._onZoomviewUpdate.bind(this);

		// Register event handlers
		peaks.on("player.timeupdate", this._onTimeUpdate);
		peaks.on("player.playing", this._onPlaying);
		peaks.on("player.pause", this._onPause);
		peaks.on("zoomview.update", this._onZoomviewUpdate);

		const time = this._peaks.player.getCurrentTime();

		this._playheadLayer.updatePlayheadTime(time);

		this._mouseDragHandler = new SeekMouseDragHandler(peaks, this);

		const zoomview = peaks.views.getView("zoomview");

		if (zoomview) {
			this._highlightLayer?.showHighlight(
				zoomview.getStartTime(),
				zoomview.getEndTime(),
			);
		}
	}

	override initWaveformData(): void {
		if (this._width !== 0) {
			this._resampleAndSetWaveformData(this._originalWaveformData, this._width);
		}
	}

	override initHighlightLayer(): void {
		this._highlightLayer = new HighlightLayer(
			this,
			this._viewOptions as OverviewOptions,
		);

		this._highlightLayer.addToStage(this._stage);
	}

	override isSegmentDraggingEnabled(): boolean {
		return false;
	}

	override getName(): string {
		return "overview";
	}

	_onTimeUpdate(time: number): void {
		this._playheadLayer.updatePlayheadTime(time);
	}

	_onPlaying(time: number): void {
		this._playheadLayer.updatePlayheadTime(time);
	}

	_onPause(time: number): void {
		this._playheadLayer.stop(time);
	}

	_onZoomviewUpdate(event: { startTime: number; endTime: number }): void {
		this.showHighlight(event.startTime, event.endTime);
	}

	showHighlight(startTime: number, endTime: number): void {
		this._highlightLayer?.showHighlight(startTime, endTime);
	}

	override setWaveformData(waveformData: WaveformData): void {
		this._originalWaveformData = waveformData;

		if (this._width !== 0) {
			this._resampleAndSetWaveformData(waveformData, this._width);
		} else {
			this._data = waveformData;
		}

		this.updateWaveform();
	}

	_resampleAndSetWaveformData(
		waveformData: WaveformData,
		width: number,
	): boolean {
		try {
			this._data = waveformData.resample({ width: width });
			return true;
		} catch {
			// This error usually indicates that the waveform length
			// is less than the container width. Ignore, and use the
			// given waveform data
			this._data = waveformData;
			return false;
		}
	}

	removeHighlightRect(): void {
		this._highlightLayer?.removeHighlight();
	}

	override updateWaveform(): void {
		this._waveformLayer.draw();
		this._axisLayer.draw();

		const playheadTime = this._peaks.player.getCurrentTime();

		this._playheadLayer.updatePlayheadTime(playheadTime);

		this._highlightLayer?.updateHighlight();

		const frameStartTime = 0;
		const frameEndTime = this.pixelsToTime(this._width);

		if (this._pointsLayer) {
			this._pointsLayer.updatePoints(frameStartTime, frameEndTime);
		}

		if (this._segmentsLayer) {
			this._segmentsLayer.updateSegments(frameStartTime, frameEndTime);
		}
	}

	override containerWidthChange(): boolean {
		return this._resampleAndSetWaveformData(
			this._originalWaveformData,
			this._width,
		);
	}

	override containerHeightChange(): void {
		this._highlightLayer?.fitToView();
	}

	override destroy(): void {
		// Unregister event handlers
		this._peaks.off("player.playing", this._onPlaying);
		this._peaks.off("player.pause", this._onPause);
		this._peaks.off("player.timeupdate", this._onTimeUpdate);
		this._peaks.off("zoomview.update", this._onZoomviewUpdate);

		this._mouseDragHandler.destroy();

		super.destroy();
	}
}

export default WaveformOverview;
