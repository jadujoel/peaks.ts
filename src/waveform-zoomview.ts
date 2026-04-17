// @ts-nocheck
/**
 * @file
 *
 * Defines the {@link WaveformZoomView} class.
 *
 * @module waveform-zoomview
 */

import InsertSegmentMouseDragHandler from "./insert-segment-mouse-drag-handler";
import ScrollMouseDragHandler from "./scroll-mouse-drag-handler";
import { clamp, isValidTime, objectHasProperty } from "./utils";
import WaveformView from "./waveform-view";

/**
 * Creates a zoomable waveform view.
 *
 * @class
 * @alias WaveformZoomView
 *
 * @param {WaveformData} waveformData
 * @param {HTMLElement} container
 * @param {Peaks} peaks
 */

function WaveformZoomView(waveformData, container, peaks) {
	WaveformView.call(
		this,
		waveformData,
		container,
		peaks,
		peaks.options.zoomview,
	);

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

	this._autoScroll = this._viewOptions.autoScroll;
	this._autoScrollOffset = this._viewOptions.autoScrollOffset;

	this._enableSegmentDragging = false;
	this._segmentDragMode = "overlap";
	this._minSegmentDragWidth = 0;
	this._insertSegmentShape = null;

	this._playheadClickTolerance = this._viewOptions.playheadClickTolerance;

	this._zoomLevelAuto = false;
	this._zoomLevelSeconds = null;

	const time = this._peaks.player.getCurrentTime();

	this._syncPlayhead(time);

	this._mouseDragHandler = new ScrollMouseDragHandler(peaks, this);

	this._onWheel = this._onWheel.bind(this);
	this._onWheelCaptureVerticalScroll =
		this._onWheelCaptureVerticalScroll.bind(this);
	this.setWheelMode(this._viewOptions.wheelMode);

	this._peaks.emit("zoomview.update", {
		startTime: 0,
		endTime: this.getEndTime(),
	});
}

WaveformZoomView.prototype = Object.create(WaveformView.prototype);

WaveformZoomView.prototype.initWaveformData = function () {
	this._enableWaveformCache = this._options.waveformCache;

	this._initWaveformCache();

	const initialZoomLevel = this._peaks.zoom.getZoomLevel();

	this._resampleData({ scale: initialZoomLevel });
};

WaveformZoomView.prototype._initWaveformCache = function () {
	if (this._enableWaveformCache) {
		this._waveformData = new Map();
		this._waveformData.set(
			this._originalWaveformData.scale,
			this._originalWaveformData,
		);
		this._waveformScales = [this._originalWaveformData.scale];
	}
};

WaveformZoomView.prototype.initHighlightLayer = () => {};

WaveformZoomView.prototype.setWheelMode = function (mode, options) {
	if (!options) {
		options = {};
	}

	if (
		mode !== this._wheelMode ||
		options.captureVerticalScroll !== this._captureVerticalScroll
	) {
		this._stage.off("wheel");

		this._wheelMode = mode;
		this._captureVerticalScroll = options.captureVerticalScroll;

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
};

WaveformZoomView.prototype._onWheel = function (event) {
	const wheelEvent = event.evt;
	let delta;

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
};

WaveformZoomView.prototype._onWheelCaptureVerticalScroll = function (event) {
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
};

WaveformZoomView.prototype.setWaveformDragMode = function (mode) {
	if (this._segmentsLayer) {
		this._mouseDragHandler.destroy();
		this.dragSeek(false);

		if (mode === "insert-segment") {
			this._mouseDragHandler = new InsertSegmentMouseDragHandler(
				this._peaks,
				this,
			);
		} else {
			this._mouseDragHandler = new ScrollMouseDragHandler(this._peaks, this);
		}
	}
};

WaveformZoomView.prototype.enableSegmentDragging = function (enable) {
	this._enableSegmentDragging = enable;

	// Update all existing segments
	if (this._segmentsLayer) {
		this._segmentsLayer.enableSegmentDragging(enable);
	}
};

WaveformZoomView.prototype.isSegmentDraggingEnabled = function () {
	return this._enableSegmentDragging;
};

WaveformZoomView.prototype.setSegmentDragMode = function (mode) {
	this._segmentDragMode = mode;
};

WaveformZoomView.prototype.getSegmentDragMode = function () {
	return this._segmentDragMode;
};

WaveformZoomView.prototype.getName = () => "zoomview";

WaveformZoomView.prototype._onTimeUpdate = function (time) {
	if (this._mouseDragHandler.isDragging()) {
		return;
	}

	this._syncPlayhead(time);
};

WaveformZoomView.prototype._onPlaying = function (time) {
	this._playheadLayer.updatePlayheadTime(time);
};

WaveformZoomView.prototype._onPause = function (time) {
	this._playheadLayer.stop(time);
};

WaveformZoomView.prototype._onKeyboardLeft = function () {
	this._keyboardScroll(-1, false);
};

WaveformZoomView.prototype._onKeyboardRight = function () {
	this._keyboardScroll(1, false);
};

WaveformZoomView.prototype._onKeyboardShiftLeft = function () {
	this._keyboardScroll(-1, true);
};

WaveformZoomView.prototype._onKeyboardShiftRight = function () {
	this._keyboardScroll(1, true);
};

WaveformZoomView.prototype._keyboardScroll = function (direction, large) {
	let increment;

	if (large) {
		increment = direction * this._width;
	} else {
		increment = direction * this.timeToPixels(this._options.nudgeIncrement);
	}

	this.scrollWaveform({ pixels: increment });
};

WaveformZoomView.prototype.setWaveformData = function (waveformData) {
	this._originalWaveformData = waveformData;
	// Clear cached waveforms
	this._initWaveformCache();

	// Don't update the UI here, call setZoom().
};

/**
 * Returns the position of the playhead marker, in pixels relative to the
 * left hand side of the waveform view.
 *
 * @return {Number}
 */

WaveformZoomView.prototype.getPlayheadOffset = function () {
	return this._playheadLayer.getPlayheadPixel() - this._frameOffset;
};

WaveformZoomView.prototype.getPlayheadClickTolerance = function () {
	return this._playheadClickTolerance;
};

WaveformZoomView.prototype._syncPlayhead = function (time) {
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
};

WaveformZoomView.prototype._getScale = function (duration) {
	return Math.floor((duration * this._data.sample_rate) / this._width);
};

function isAutoScale(options) {
	return (
		(objectHasProperty(options, "scale") && options.scale === "auto") ||
		(objectHasProperty(options, "seconds") && options.seconds === "auto")
	);
}

/**
 * Options for [WaveformZoomView.setZoom]{@link WaveformZoomView#setZoom}.
 *
 * @typedef {Object} SetZoomOptions
 * @global
 * @property {Number|String} scale Zoom level, in samples per pixel, or 'auto'
 *   to fit the entire waveform to the view width
 * @property {Number|String} seconds Number of seconds to fit to the view width,
 *   or 'auto' to fit the entire waveform to the view width
 */

/**
 * Changes the zoom level.
 *
 * @param {SetZoomOptions} options
 * @returns {Boolean}
 */

WaveformZoomView.prototype.setZoom = function (options) {
	let scale;

	if (isAutoScale(options)) {
		// Use waveform duration, to match WaveformOverview
		const seconds = this._originalWaveformData.duration;

		this._zoomLevelAuto = true;
		this._zoomLevelSeconds = null;
		scale = this._getScale(seconds);
	} else {
		if (objectHasProperty(options, "scale")) {
			this._zoomLevelSeconds = null;
			scale = Math.floor(options.scale);
		} else if (objectHasProperty(options, "seconds")) {
			if (!isValidTime(options.seconds)) {
				return false;
			}

			this._zoomLevelSeconds = options.seconds;
			scale = this._getScale(options.seconds);
		}

		this._zoomLevelAuto = false;
	}

	if (scale < this._originalWaveformData.scale) {
		// eslint-disable-next-line @stylistic/js/max-len
		this._peaks._logger(
			"peaks.zoomview.setZoom(): zoom level must be at least " +
				this._originalWaveformData.scale,
		);
		scale = this._originalWaveformData.scale;
	}

	const currentTime = this._peaks.player.getCurrentTime();
	let apexTime;
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
};

WaveformZoomView.prototype._resampleData = function (options) {
	const scale = options.scale;

	if (this._enableWaveformCache) {
		if (!this._waveformData.has(scale)) {
			let sourceWaveform = this._originalWaveformData;

			// Resample from the next lowest available zoom level

			for (let i = 0; i < this._waveformScales.length; i++) {
				if (this._waveformScales[i] < scale) {
					sourceWaveform = this._waveformData.get(this._waveformScales[i]);
				} else {
					break;
				}
			}

			this._waveformData.set(scale, sourceWaveform.resample(options));

			this._waveformScales.push(scale);
			this._waveformScales.sort((a, b) => {
				return a - b; // Ascending order
			});
		}

		this._data = this._waveformData.get(scale);
	} else {
		this._data = this._originalWaveformData.resample(options);
	}

	this._scale = this._data.scale;
	this._pixelLength = this._data.length;
};

WaveformZoomView.prototype.isAutoZoom = function () {
	return this._zoomLevelAuto;
};

WaveformZoomView.prototype.setStartTime = function (time) {
	if (time < 0) {
		time = 0;
	}

	if (this._zoomLevelAuto) {
		time = 0;
	}

	this.updateWaveform(this.timeToPixels(time), false);
};

/**
 * @returns {Number} The length of the waveform, in pixels.
 */

WaveformZoomView.prototype.getPixelLength = function () {
	return this._pixelLength;
};

/**
 * Scrolls the region of waveform shown in the view.
 *
 * @param {Number} scrollAmount How far to scroll, in pixels
 */

WaveformZoomView.prototype.scrollWaveform = function (options) {
	let scrollAmount;

	if (objectHasProperty(options, "pixels")) {
		scrollAmount = Math.floor(options.pixels);
	} else if (objectHasProperty(options, "seconds")) {
		scrollAmount = this.timeToPixels(options.seconds);
	} else {
		throw new TypeError(
			"view.scrollWaveform(): Missing umber of pixels or seconds",
		);
	}

	this.updateWaveform(this._frameOffset + scrollAmount, false);
};

/**
 * Updates the region of waveform shown in the view.
 *
 * @param {Number} frameOffset The new frame offset, in pixels.
 * @param {Boolean} forceUpdate Forces the waveform view to be redrawn, if the
 *   frameOffset is unchanged.
 */

WaveformZoomView.prototype.updateWaveform = function (
	frameOffset,
	forceUpdate,
) {
	let upperLimit;

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
};

WaveformZoomView.prototype.enableAutoScroll = function (enable, options) {
	if (!options) {
		options = {};
	}

	this._autoScroll = enable;

	if (objectHasProperty(options, "offset")) {
		this._autoScrollOffset = options.offset;
	}
};

WaveformZoomView.prototype.getMinSegmentDragWidth = function () {
	return this._insertSegmentShape ? 0 : this._minSegmentDragWidth;
};

WaveformZoomView.prototype.setMinSegmentDragWidth = function (width) {
	this._minSegmentDragWidth = width;
};

WaveformZoomView.prototype.containerWidthChange = function () {
	let resample = false;
	let resampleOptions;

	if (this._zoomLevelAuto) {
		resample = true;
		resampleOptions = { width: this._width };
	} else if (this._zoomLevelSeconds !== null) {
		resample = true;
		resampleOptions = { scale: this._getScale(this._zoomLevelSeconds) };
	}

	if (resample) {
		try {
			this._resampleData(resampleOptions);
		} catch (error) {
			// eslint-disable-line no-unused-vars
			// Ignore, and leave this._data as it was
		}
	}

	return true;
};

WaveformZoomView.prototype.containerHeightChange = () => {
	// Nothing
};

WaveformZoomView.prototype.getStage = function () {
	return this._stage;
};

WaveformZoomView.prototype.getSegmentsLayer = function () {
	return this._segmentsLayer;
};

WaveformZoomView.prototype.destroy = function () {
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
		delete this._waveformData;
		delete this._waveformScales;
	} else {
		delete this._data;
	}

	this._mouseDragHandler.destroy();

	WaveformView.prototype.destroy.call(this);
};

export default WaveformZoomView;
