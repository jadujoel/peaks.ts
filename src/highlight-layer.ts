import { Layer } from "konva/lib/Layer";
import type { Stage } from "konva/lib/Stage";
import { Rect } from "konva/lib/shapes/Rect";

import type { OverviewOptions, WaveformViewAPI } from "./types";
import { clamp } from "./utils";

export class HighlightLayer {
	private _view: WaveformViewAPI;
	private _offset: number;
	private _color: string;
	private _layer: Layer;
	private _highlightRect?: Rect | undefined;
	private _startTime?: number;
	private _endTime?: number;
	private _strokeColor: string;
	private _opacity: number;
	private _cornerRadius: number;

	constructor(view: WaveformViewAPI, options: OverviewOptions) {
		this._view = view;
		this._offset = options.highlightOffset ?? 0;
		this._color = options.highlightColor ?? "#000";
		this._layer = new Layer({ listening: false });
		this._strokeColor = options.highlightStrokeColor ?? "#000";
		this._opacity = options.highlightOpacity ?? 0.5;
		this._cornerRadius = options.highlightCornerRadius ?? 0;
	}

	addToStage(stage: Stage): void {
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
			this._highlightRect = undefined;
		}
	}

	updateHighlight(): void {
		if (
			this._highlightRect &&
			this._startTime !== undefined &&
			this._endTime !== undefined
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
