// @ts-nocheck
/**
 * @file
 *
 * Defines the {@link WaveformOverview} class.
 *
 * @module waveform-overview
 */

import HighlightLayer from "./highlight-layer";
import SeekMouseDragHandler from "./seek-mouse-drag-handler";
import WaveformView from "./waveform-view";

/**
 * Creates the overview waveform view.
 *
 * @class
 * @alias WaveformOverview
 *
 * @param {WaveformData} waveformData
 * @param {HTMLElement} container
 * @param {Peaks} peaks
 */

function WaveformOverview(waveformData, container, peaks) {
	WaveformView.call(
		this,
		waveformData,
		container,
		peaks,
		peaks.options.overview,
	);

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
		this._highlightLayer.showHighlight(
			zoomview.getStartTime(),
			zoomview.getEndTime(),
		);
	}
}

WaveformOverview.prototype = Object.create(WaveformView.prototype);

WaveformOverview.prototype.initWaveformData = function () {
	if (this._width !== 0) {
		this._resampleAndSetWaveformData(this._originalWaveformData, this._width);
	}
};

WaveformOverview.prototype.initHighlightLayer = function () {
	this._highlightLayer = new HighlightLayer(this, this._viewOptions);

	this._highlightLayer.addToStage(this._stage);
};

WaveformOverview.prototype.isSegmentDraggingEnabled = () => false;

WaveformOverview.prototype.getName = () => "overview";

WaveformOverview.prototype._onTimeUpdate = function (time) {
	this._playheadLayer.updatePlayheadTime(time);
};

WaveformOverview.prototype._onPlaying = function (time) {
	this._playheadLayer.updatePlayheadTime(time);
};

WaveformOverview.prototype._onPause = function (time) {
	this._playheadLayer.stop(time);
};

WaveformOverview.prototype._onZoomviewUpdate = function (event) {
	this.showHighlight(event.startTime, event.endTime);
};

WaveformOverview.prototype.showHighlight = function (startTime, endTime) {
	this._highlightLayer.showHighlight(startTime, endTime);
};

WaveformOverview.prototype.setWaveformData = function (waveformData) {
	this._originalWaveformData = waveformData;

	if (this._width !== 0) {
		this._resampleAndSetWaveformData(waveformData, this._width);
	} else {
		this._data = waveformData;
	}

	this.updateWaveform();
};

WaveformOverview.prototype._resampleAndSetWaveformData = function (
	waveformData,
	width,
) {
	try {
		this._data = waveformData.resample({ width: width });
		return true;
	} catch (error) {
		// eslint-disable-line no-unused-vars
		// This error usually indicates that the waveform length
		// is less than the container width. Ignore, and use the
		// given waveform data
		this._data = waveformData;
		return false;
	}
};

WaveformOverview.prototype.removeHighlightRect = function () {
	this._highlightLayer.removeHighlight();
};

WaveformOverview.prototype.updateWaveform = function (
	/* frameOffset, forceUpdate */
) {
	this._waveformLayer.draw();
	this._axisLayer.draw();

	const playheadTime = this._peaks.player.getCurrentTime();

	this._playheadLayer.updatePlayheadTime(playheadTime);

	this._highlightLayer.updateHighlight();

	const frameStartTime = 0;
	const frameEndTime = this.pixelsToTime(this._width);

	if (this._pointsLayer) {
		this._pointsLayer.updatePoints(frameStartTime, frameEndTime);
	}

	if (this._segmentsLayer) {
		this._segmentsLayer.updateSegments(frameStartTime, frameEndTime);
	}
};

WaveformOverview.prototype.containerWidthChange = function () {
	return this._resampleAndSetWaveformData(
		this._originalWaveformData,
		this._width,
	);
};

WaveformOverview.prototype.containerHeightChange = function () {
	this._highlightLayer.fitToView();
};

WaveformOverview.prototype.destroy = function () {
	// Unregister event handlers
	this._peaks.off("player.playing", this._onPlaying);
	this._peaks.off("player.pause", this._onPause);
	this._peaks.off("player.timeupdate", this._onTimeUpdate);
	this._peaks.off("zoomview.update", this._onZoomviewUpdate);

	this._mouseDragHandler.destroy();

	WaveformView.prototype.destroy.call(this);
};

export default WaveformOverview;
