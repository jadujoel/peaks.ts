import Konva from "konva/lib/Core";
import { Rect } from "konva/lib/shapes/Rect";

import { clamp } from "./utils";

class HighlightLayer {
	private _view: any;
	private _offset: number;
	private _color: string;
	private _layer: Konva.Layer;
	private _highlightRect: Rect | null;
	private _startTime: number | null;
	private _endTime: number | null;
	private _strokeColor: string;
	private _opacity: number;
	private _cornerRadius: number;

	constructor(view: any, options: any) {
		this._view = view;
		this._offset = options.highlightOffset;
		this._color = options.highlightColor;
		this._layer = new Konva.Layer({ listening: false });
		this._highlightRect = null;
		this._startTime = null;
		this._endTime = null;
		this._strokeColor = options.highlightStrokeColor;
		this._opacity = options.highlightOpacity;
		this._cornerRadius = options.highlightCornerRadius;
	}

	addToStage(stage: Konva.Stage): void {
		stage.add(this._layer);
	}

	showHighlight(startTime: number, endTime: number): void {
		if (!this._highlightRect) {
			this._createHighlightRect(startTime, endTime);
		}

		this._update(startTime, endTime);
	}

	/**
	 * Updates the position of the highlight region.
	 *
	 * @param {Number} startTime The start of the highlight region, in seconds.
	 * @param {Number} endTime The end of the highlight region, in seconds.
	 */

	private _update(startTime: number, endTime: number): void {
		this._startTime = startTime;
		this._endTime = endTime;

		const startOffset = this._view.timeToPixels(startTime);
		const endOffset = this._view.timeToPixels(endTime);

		if (this._highlightRect) {
			this._highlightRect.setAttrs({
				x: startOffset,
				width: endOffset - startOffset,
			});
		}
	}

	private _createHighlightRect(startTime: number, endTime: number): void {
		this._startTime = startTime;
		this._endTime = endTime;

		const startOffset = this._view.timeToPixels(startTime);
		const endOffset = this._view.timeToPixels(endTime);

		// Create with default y and height, the real values are set in fitToView().
		this._highlightRect = new Rect({
			x: startOffset,
			y: 0,
			width: endOffset - startOffset,
			height: 0,
			stroke: this._strokeColor,
			strokeWidth: 1,
			fill: this._color,
			opacity: this._opacity,
			cornerRadius: this._cornerRadius,
		});

		this.fitToView();

		this._layer.add(this._highlightRect);
	}

	removeHighlight(): void {
		if (this._highlightRect) {
			this._highlightRect.destroy();
			this._highlightRect = null;
		}
	}

	updateHighlight(): void {
		if (
			this._highlightRect &&
			this._startTime !== null &&
			this._endTime !== null
		) {
			this._update(this._startTime, this._endTime);
		}
	}

	fitToView(): void {
		if (this._highlightRect) {
			const height = this._view.getHeight();
			const offset = clamp(this._offset, 0, Math.floor(height / 2));

			this._highlightRect.setAttrs({
				y: offset,
				height: height - offset * 2,
			});
		}
	}
}

export default HighlightLayer;
