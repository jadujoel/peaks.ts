import type { Context } from "konva/lib/Context";
import Konva from "konva/lib/Core";
import type { Layer } from "konva/lib/Layer";
import type { Shape } from "konva/lib/Shape";
import type { ViewOptions, WaveformViewAPI } from "../types";
import { formatTime, roundUpToNearest } from "../utils";

/**
 * Creates the waveform axis shapes and adds them to the given view layer.
 */

export interface WaveformAxisFromOptions {
	readonly view: WaveformViewAPI;
	readonly options: ViewOptions;
}

export class WaveformAxis {
	private constructor(
		private readonly formatAxisTimeFn: (time: number) => string,
		private readonly axisLabelFont: string,
		private readonly axisShape: Shape,
		private axisGridlineColor: string,
		private axisLabelColor: string,
		private showAxisLabelsFlag: boolean,
		private axisTopMarkerHeight: number,
		private axisBottomMarkerHeight: number,
	) {}

	static from(options: WaveformAxisFromOptions): WaveformAxis {
		const view = options.view;
		const opts = options.options;

		const formatAxisTimeFn =
			opts.formatAxisTime ?? ((time: number) => formatTime(time, 0));

		const axisLabelFont = WaveformAxis.buildFontString(
			opts.fontFamily,
			opts.fontSize,
			opts.fontStyle,
		);

		let instance: WaveformAxis;
		const axisShape = new Konva.Shape({
			sceneFunc: (context: Context) => {
				instance.drawAxis(context, view);
			},
		});

		instance = new WaveformAxis(
			formatAxisTimeFn,
			axisLabelFont,
			axisShape,
			opts.axisGridlineColor,
			opts.axisLabelColor,
			opts.showAxisLabels,
			opts.axisTopMarkerHeight,
			opts.axisBottomMarkerHeight,
		);
		return instance;
	}

	addToLayer(layer: Layer): void {
		layer.add(this.axisShape);
	}

	showAxisLabels(
		show: boolean,
		options?: { topMarkerHeight?: number; bottomMarkerHeight?: number },
	): void {
		this.showAxisLabelsFlag = show;

		if (options) {
			if (options.topMarkerHeight !== undefined) {
				this.axisTopMarkerHeight = options.topMarkerHeight;
			}

			if (options.bottomMarkerHeight !== undefined) {
				this.axisBottomMarkerHeight = options.bottomMarkerHeight;
			}
		}
	}

	setAxisLabelColor(color: string): void {
		this.axisLabelColor = color;
	}

	setAxisGridlineColor(color: string): void {
		this.axisGridlineColor = color;
	}

	private static buildFontString(
		fontFamily: string,
		fontSize: number,
		fontStyle: string,
	): string {
		if (!fontSize) {
			fontSize = 11;
		}

		if (!fontFamily) {
			fontFamily = "sans-serif";
		}

		if (!fontStyle) {
			fontStyle = "normal";
		}

		return `${fontStyle} ${fontSize}px ${fontFamily}`;
	}

	private getAxisLabelScale(view: WaveformViewAPI): number {
		let baseSecs = 1;
		const steps = [1, 2, 5, 10, 20, 30];
		const minSpacing = 60;
		let index = 0;

		let secs = 0;

		for (;;) {
			secs = baseSecs * (steps[index] as number);
			const pixels = view.timeToPixels(secs);

			if (pixels < minSpacing) {
				if (++index === steps.length) {
					baseSecs *= 60;
					index = 0;
				}
			} else {
				break;
			}
		}

		return secs;
	}

	private drawAxis(context: Context, view: WaveformViewAPI): void {
		const currentFrameStartTime = view.getStartTime();

		const axisLabelIntervalSecs = this.getAxisLabelScale(view);

		const firstAxisLabelSecs = roundUpToNearest(
			currentFrameStartTime,
			axisLabelIntervalSecs,
		);

		const axisLabelOffsetSecs = firstAxisLabelSecs - currentFrameStartTime;

		const axisLabelOffsetPixels = view.timeToPixels(axisLabelOffsetSecs);

		context.setAttr("strokeStyle", this.axisGridlineColor);
		context.setAttr("lineWidth", 1);

		context.setAttr("font", this.axisLabelFont);
		context.setAttr("fillStyle", this.axisLabelColor);
		context.setAttr("textAlign", "left");
		context.setAttr("textBaseline", "bottom");

		const width = view.getWidth();
		const height = view.getHeight();

		let secs = firstAxisLabelSecs;

		for (;;) {
			const x =
				axisLabelOffsetPixels + view.timeToPixels(secs - firstAxisLabelSecs);

			if (x >= width) {
				break;
			}

			if (this.axisTopMarkerHeight > 0) {
				context.beginPath();
				context.moveTo(x + 0.5, 0);
				context.lineTo(x + 0.5, 0 + this.axisTopMarkerHeight);
				context.stroke();
			}

			if (this.axisBottomMarkerHeight > 0) {
				context.beginPath();
				context.moveTo(x + 0.5, height);
				context.lineTo(x + 0.5, height - this.axisBottomMarkerHeight);
				context.stroke();
			}

			if (this.showAxisLabelsFlag) {
				const label = this.formatAxisTimeFn(secs);
				const labelWidth = context.measureText(label).width;
				const labelX = x - labelWidth / 2;
				const labelY = height - 1 - this.axisBottomMarkerHeight;

				if (labelX >= 0) {
					context.fillText(label, labelX, labelY);
				}
			}

			secs += axisLabelIntervalSecs;
		}
	}
}
