import { Layer } from "konva/lib/Layer";
import type { Stage } from "konva/lib/Stage";
import { Rect } from "konva/lib/shapes/Rect";

import type { OverviewOptions, WaveformViewAPI } from "./types";
import { clamp } from "./utils";

export interface HighlightLayerFromOptions {
	readonly view: WaveformViewAPI;
	readonly options: OverviewOptions;
}

export class HighlightLayer {
	private readonly view: WaveformViewAPI;
	private readonly offset: number;
	private readonly color: string;
	private readonly layer: Layer;
	private highlightRect?: Rect | undefined;
	private startTime?: number;
	private endTime?: number;
	private readonly strokeColor: string;
	private readonly opacity: number;
	private readonly cornerRadius: number;

	static from(options: HighlightLayerFromOptions): HighlightLayer {
		return new HighlightLayer(options.view, options.options);
	}

	private constructor(view: WaveformViewAPI, options: OverviewOptions) {
		this.view = view;
		this.offset = options.highlightOffset ?? 0;
		this.color = options.highlightColor ?? "#000";
		this.layer = new Layer({ listening: false });
		this.strokeColor = options.highlightStrokeColor ?? "#000";
		this.opacity = options.highlightOpacity ?? 0.5;
		this.cornerRadius = options.highlightCornerRadius ?? 0;
	}

	addToStage(stage: Stage): void {
		stage.add(this.layer);
	}

	showHighlight(startTime: number, endTime: number): void {
		if (!this.highlightRect) {
			this.createHighlightRect(startTime, endTime);
		}

		this.update(startTime, endTime);
	}

	private update(startTime: number, endTime: number): void {
		this.startTime = startTime;
		this.endTime = endTime;

		const startOffset = this.view.timeToPixels(startTime);
		const endOffset = this.view.timeToPixels(endTime);

		if (this.highlightRect) {
			this.highlightRect.setAttrs({
				width: endOffset - startOffset,
				x: startOffset,
			});
		}
	}

	private createHighlightRect(startTime: number, endTime: number): void {
		this.startTime = startTime;
		this.endTime = endTime;

		const startOffset = this.view.timeToPixels(startTime);
		const endOffset = this.view.timeToPixels(endTime);

		this.highlightRect = new Rect({
			cornerRadius: this.cornerRadius,
			fill: this.color,
			height: 0,
			opacity: this.opacity,
			stroke: this.strokeColor,
			strokeWidth: 1,
			width: endOffset - startOffset,
			x: startOffset,
			y: 0,
		});

		this.fitToView();

		this.layer.add(this.highlightRect);
	}

	removeHighlight(): void {
		if (this.highlightRect) {
			this.highlightRect.destroy();
			this.highlightRect = undefined;
		}
	}

	updateHighlight(): void {
		if (
			this.highlightRect &&
			this.startTime !== undefined &&
			this.endTime !== undefined
		) {
			this.update(this.startTime, this.endTime);
		}
	}

	fitToView(): void {
		if (this.highlightRect) {
			const height = this.view.getHeight();
			const offset = clamp(this.offset, 0, Math.floor(height / 2));

			this.highlightRect.setAttrs({
				height: height - offset * 2,
				y: offset,
			});
		}
	}
}
