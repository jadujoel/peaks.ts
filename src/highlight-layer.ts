import type { DriverLayer, DriverRect, DriverStage } from "./driver/types";

import type { OverviewOptions, WaveformViewAPI } from "./types";
import { clamp } from "./utils";

export interface HighlightLayerFromOptions {
	readonly view: WaveformViewAPI;
	readonly options: OverviewOptions;
}

export class HighlightLayer {
	private constructor(
		private readonly view: WaveformViewAPI,
		private readonly offset: number,
		private color: string,
		private strokeColor: string,
		private readonly opacity: number,
		private readonly cornerRadius: number,
		private readonly layer: DriverLayer,
		private highlightRect: DriverRect | undefined,
		private startTime: number | undefined,
		private endTime: number | undefined,
	) {}

	static from(options: HighlightLayerFromOptions): HighlightLayer {
		const opts = options.options;
		return new HighlightLayer(
			options.view,
			opts.highlightOffset ?? 0,
			opts.highlightColor ?? "#000",
			opts.highlightStrokeColor ?? "#000",
			opts.highlightOpacity ?? 0.5,
			opts.highlightCornerRadius ?? 0,
			options.view.getDriver().createLayer({ listening: false }),
			undefined,
			undefined,
			undefined,
		);
	}

	addToStage(stage: DriverStage): void {
		stage.add(this.layer);
	}

	dispose(): void {
		this.removeHighlight();
		this.layer.destroy();
	}

	showHighlight(startTime: number, endTime: number): void {
		if (!this.highlightRect) {
			this.createHighlightRect(startTime, endTime);
		}

		this.update(startTime, endTime);
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
		if (!this.highlightRect) {
			return;
		}
		const height = this.view.getHeight();
		const offset = clamp(this.offset, 0, Math.floor(height / 2));

		this.highlightRect.setAttrs({
			height: height - offset * 2,
			y: offset,
		});
	}

	setHighlightColor(color: string): void {
		this.color = color;
		this.highlightRect?.fill(color);
		this.layer.draw();
	}

	setHighlightStrokeColor(color: string): void {
		this.strokeColor = color;
		this.highlightRect?.stroke(color);
		this.layer.draw();
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

		this.highlightRect = this.view.getDriver().createRect({
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
}
