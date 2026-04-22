import type { DriverContext, DriverLayer, DriverShape } from "../driver/types";
import type { ViewOptions, WaveformViewAPI } from "../types";
import { formatTime, roundUpToNearest } from "../utils";

/**
 * Creates the waveform axis shapes and adds them to the given view layer.
 */
export interface WaveformAxisFromOptions {
	readonly view: WaveformViewAPI;
	readonly options: ViewOptions;
}

export interface ShowAxisLabelsOptions {
	readonly topMarkerHeight?: number;
	readonly bottomMarkerHeight?: number;
}

export class WaveformAxis {
	private constructor(
		private readonly formatTimeFn: (time: number) => string,
		private readonly labelFont: string,
		private readonly shape: DriverShape,
		private gridlineColor: string,
		private labelColor: string,
		private showLabels: boolean,
		private topMarkerHeight: number,
		private bottomMarkerHeight: number,
	) {}

	static from(options: WaveformAxisFromOptions): WaveformAxis {
		const view = options.view;
		const opts = options.options;

		const formatTimeFn =
			opts.formatAxisTime ?? ((time: number) => formatTime(time, 0));

		const labelFont = WaveformAxis.buildFontString(
			opts.fontFamily,
			opts.fontSize,
			opts.fontStyle,
		);

		let instance: WaveformAxis;
		const shape = view.getDriver().createShape({
			sceneFunc: (context: DriverContext) => {
				instance.drawAxis(context, view);
			},
		});

		instance = new WaveformAxis(
			formatTimeFn,
			labelFont,
			shape,
			opts.axisGridlineColor,
			opts.axisLabelColor,
			opts.showAxisLabels,
			opts.axisTopMarkerHeight,
			opts.axisBottomMarkerHeight,
		);
		return instance;
	}

	addToLayer(layer: DriverLayer): void {
		layer.add(this.shape);
	}

	showAxisLabels(show: boolean, options?: ShowAxisLabelsOptions): void {
		this.showLabels = show;

		if (options === undefined) {
			return;
		}

		if (options.topMarkerHeight !== undefined) {
			this.topMarkerHeight = options.topMarkerHeight;
		}

		if (options.bottomMarkerHeight !== undefined) {
			this.bottomMarkerHeight = options.bottomMarkerHeight;
		}
	}

	setAxisLabelColor(color: string): void {
		this.labelColor = color;
	}

	setAxisGridlineColor(color: string): void {
		this.gridlineColor = color;
	}

	private static buildFontString(
		fontFamily: string = "sans-serif",
		fontSize: number = 11,
		fontStyle: string = "normal",
	): string {
		return `${fontStyle} ${fontSize}px ${fontFamily}`;
	}

	private getLabelScale(view: WaveformViewAPI): number {
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

	private drawAxis(context: DriverContext, view: WaveformViewAPI): void {
		const currentFrameStartTime = view.getStartTime();

		const labelIntervalSecs = this.getLabelScale(view);

		const firstLabelSecs = roundUpToNearest(
			currentFrameStartTime,
			labelIntervalSecs,
		);

		const labelOffsetSecs = firstLabelSecs - currentFrameStartTime;

		const labelOffsetPixels = view.timeToPixels(labelOffsetSecs);

		context.setAttr("strokeStyle", this.gridlineColor);
		context.setAttr("lineWidth", 1);

		context.setAttr("font", this.labelFont);
		context.setAttr("fillStyle", this.labelColor);
		context.setAttr("textAlign", "left");
		context.setAttr("textBaseline", "bottom");

		const width = view.getWidth();
		const height = view.getHeight();

		let secs = firstLabelSecs;

		for (;;) {
			const x = labelOffsetPixels + view.timeToPixels(secs - firstLabelSecs);

			if (x >= width) {
				break;
			}

			if (this.topMarkerHeight > 0) {
				context.beginPath();
				context.moveTo(x + 0.5, 0);
				context.lineTo(x + 0.5, 0 + this.topMarkerHeight);
				context.stroke();
			}

			if (this.bottomMarkerHeight > 0) {
				context.beginPath();
				context.moveTo(x + 0.5, height);
				context.lineTo(x + 0.5, height - this.bottomMarkerHeight);
				context.stroke();
			}

			if (this.showLabels) {
				const label = this.formatTimeFn(secs);
				const labelWidth = context.measureText(label).width;
				const labelX = x - labelWidth / 2;
				const labelY = height - 1 - this.bottomMarkerHeight;

				if (labelX >= 0) {
					context.fillText(label, labelX, labelY);
				}
			}

			secs += labelIntervalSecs;
		}
	}
}
