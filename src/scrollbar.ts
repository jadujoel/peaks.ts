import Konva from "konva/lib/Core";
import type { Group } from "konva/lib/Group";
import type { Layer } from "konva/lib/Layer";
import type { KonvaEventObject } from "konva/lib/Node";
import type { Stage } from "konva/lib/Stage";
import { Rect } from "konva/lib/shapes/Rect";
import type { PeaksInstance, ScrollbarDisplayOptions } from "./types";
import { clamp } from "./utils";
import type WaveformZoomView from "./waveform-zoomview";

/**
 * Creates a scrollbar.
 *
 * @throws {Error} If scrollbar display options are missing from the Peaks configuration.
 */

class Scrollbar {
	private _container: HTMLDivElement;
	private _peaks: PeaksInstance;
	private _options: ScrollbarDisplayOptions;
	private _zoomview: WaveformZoomView | null;
	private _width: number;
	private _height: number;
	private _stage: Stage;
	private _layer: Layer;
	private _color: string;
	private _scrollboxX: number;
	private _minScrollboxWidth: number;
	private _offsetY: number;
	private _scrollbox: Group;
	private _scrollboxRect: Rect;
	private _scrollboxWidth!: number;
	private _dragging!: boolean;

	constructor(container: HTMLDivElement, peaks: PeaksInstance) {
		this._container = container;
		this._peaks = peaks;

		const scrollbarOptions = peaks.options.scrollbar;

		if (!scrollbarOptions) {
			throw new Error("Scrollbar: missing scrollbar options");
		}

		this._options = scrollbarOptions;
		this._zoomview = peaks.views.getView("zoomview") as WaveformZoomView | null;

		this._peaks.on("zoomview.update", this._onZoomviewUpdate);

		this._width = container.clientWidth;
		this._height = container.clientHeight;

		this._stage = new Konva.Stage({
			container: container,
			width: this._width,
			height: this._height,
		});

		this._layer = new Konva.Layer();
		this._stage.on("click", this._onScrollbarClick);

		this._stage.add(this._layer);

		this._color = this._options.color;
		this._scrollboxX = 0;
		this._minScrollboxWidth = this._options.minWidth;

		this._offsetY = 0;

		this._scrollbox = new Konva.Group({
			draggable: true,
			dragBoundFunc: this._dragBoundFunc,
		});

		this._scrollboxRect = new Rect({
			x: this._scrollboxX,
			y: this._offsetY,
			width: 0,
			height: this._height,
			fill: this._color,
		});

		this._scrollbox.add(this._scrollboxRect);
		this._setScrollboxWidth();

		this._scrollbox.on("dragstart", this._onScrollboxDragStart);
		this._scrollbox.on("dragmove", this._onScrollboxDragMove);
		this._scrollbox.on("dragend", this._onScrollboxDragEnd);

		this._layer.add(this._scrollbox);

		this._updateScrollbarWidthAndPosition();
	}

	setZoomview(zoomview: WaveformZoomView | null): void {
		this._zoomview = zoomview;

		this._updateScrollbarWidthAndPosition();
	}

	/**
	 * Sets the width of the scrollbox, based on the visible waveform region
	 * in the zoomview and minimum scrollbox width option.
	 */

	_setScrollboxWidth(): void {
		if (this._zoomview) {
			this._scrollboxWidth = Math.floor(
				(this._width * this._zoomview.pixelsToTime(this._zoomview.getWidth())) /
					this._peaks.player.getDuration(),
			);

			if (this._scrollboxWidth < this._minScrollboxWidth) {
				this._scrollboxWidth = this._minScrollboxWidth;
			}
		} else {
			this._scrollboxWidth = this._width;
		}

		this._scrollboxRect.width(this._scrollboxWidth);
	}

	/**
	 * @returns {Number} The maximum scrollbox position, in pixels.
	 */

	_getScrollbarRange(): number {
		return this._width - this._scrollboxWidth;
	}

	_dragBoundFunc = (pos: {
		x: number;
		y: number;
	}): { x: number; y: number } => {
		// Allow the scrollbar to be moved horizontally but not vertically.
		return {
			x: pos.x,
			y: 0,
		};
	};

	_onScrollboxDragStart = (): void => {
		this._dragging = true;
	};

	_onScrollboxDragEnd = (): void => {
		this._dragging = false;
	};

	_onScrollboxDragMove = (): void => {
		const range = this._getScrollbarRange();
		const x = clamp(this._scrollbox.x(), 0, range);

		this._scrollbox.x(x);

		if (x !== this._scrollboxX) {
			this._scrollboxX = x;

			if (this._zoomview) {
				this._updateWaveform(x);
			}
		}
	};

	_onZoomviewUpdate = (): void => {
		if (!this._dragging) {
			this._updateScrollbarWidthAndPosition();
		}
	};

	_updateScrollbarWidthAndPosition(): void {
		this._setScrollboxWidth();

		if (this._zoomview) {
			const startTime = this._zoomview.getStartTime();

			const zoomviewRange =
				this._zoomview.getPixelLength() - this._zoomview.getWidth();

			const scrollBoxPos = Math.floor(
				(this._zoomview.timeToPixels(startTime) * this._getScrollbarRange()) /
					zoomviewRange,
			);

			this._scrollbox.x(scrollBoxPos);
			this._layer.draw();
		}
	}

	_onScrollbarClick = (event: KonvaEventObject<MouseEvent>): void => {
		// Handle clicks on the scrollbar outside the scrollbox.
		if (event.target === this._stage) {
			if (this._zoomview) {
				// Centre the scrollbox where the user clicked.
				let x = Math.floor(event.evt.offsetX - this._scrollboxWidth / 2);

				if (x < 0) {
					x = 0;
				}

				this._updateWaveform(x);
			}
		}
	};

	/**
	 * Sets the zoomview waveform position based on scrollbar position.
	 */

	_updateWaveform(x: number): void {
		if (!this._zoomview) {
			return;
		}

		const offset = Math.floor(
			((this._zoomview.getPixelLength() - this._zoomview.getWidth()) * x) /
				this._getScrollbarRange(),
		);

		this._zoomview.updateWaveform(offset);
	}

	fitToContainer(): void {
		if (
			this._container.clientWidth === 0 &&
			this._container.clientHeight === 0
		) {
			return;
		}

		if (this._container.clientWidth !== this._width) {
			this._width = this._container.clientWidth;
			this._stage.width(this._width);

			this._updateScrollbarWidthAndPosition();
		}

		this._height = this._container.clientHeight;
		this._stage.height(this._height);
	}

	destroy(): void {
		this._peaks.off("zoomview.update", this._onZoomviewUpdate);

		this._layer.destroy();

		this._stage.destroy();
	}
}

export default Scrollbar;
