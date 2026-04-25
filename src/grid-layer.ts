import type { DriverContext, DriverLayer, DriverShape } from "./driver/types";
import {
	DEFAULT_TIME_SIGNATURE,
	gridTimes,
	stepDurationSeconds,
	type TempoSection,
} from "./tempo-map";
import type { TempoMapContext } from "./tempo-map-context";
import type { WaveformViewAPI } from "./types";

export interface GridLayerOptions {
	readonly color: string;
	readonly opacity: number;
	readonly minPixelSpacing: number;
	readonly showBarLines: boolean;
	readonly barLineWidth: number;
	readonly visible: boolean;
}

const DEFAULT_OPTIONS: GridLayerOptions = {
	barLineWidth: 2,
	color: "#cccccc",
	minPixelSpacing: 6,
	opacity: 0.4,
	showBarLines: true,
	visible: true,
};

export interface GridLayerFromOptions {
	readonly view: WaveformViewAPI;
	readonly context: TempoMapContext;
	readonly options?: Partial<GridLayerOptions>;
}

/**
 * Driver-agnostic layer that renders tempo-map gridlines on top of the
 * waveform axis. Lives in the view's `axisLayer` (below segments and
 * markers).
 */
export class GridLayer {
	private constructor(
		private readonly view: WaveformViewAPI,
		private readonly context: TempoMapContext,
		private readonly shape: DriverShape,
		private readonly opts: {
			-readonly [K in keyof GridLayerOptions]: GridLayerOptions[K];
		},
	) {}

	static from(options: GridLayerFromOptions): GridLayer {
		const opts: GridLayerOptions = {
			...DEFAULT_OPTIONS,
			...(options.options ?? {}),
		};
		let instance: GridLayer;
		const shape = options.view.getDriver().createShape({
			sceneFunc: (context: DriverContext) => instance.draw(context),
		});
		instance = new GridLayer(options.view, options.context, shape, opts);
		return instance;
	}

	addToLayer(layer: DriverLayer): void {
		layer.add(this.shape);
	}

	setVisible(visible: boolean): void {
		this.opts.visible = visible;
	}

	isVisible(): boolean {
		return this.opts.visible;
	}

	setColor(color: string): void {
		this.opts.color = color;
	}

	setOpacity(opacity: number): void {
		this.opts.opacity = opacity;
	}

	setMinPixelSpacing(min: number): void {
		this.opts.minPixelSpacing = Math.max(1, min);
	}

	private draw(context: DriverContext): void {
		if (!this.opts.visible) return;
		const map = this.context.getTempoMap();
		if (!map) return;
		const startTime = this.view.getStartTime();
		const endTime = this.view.getEndTime();
		const step = this.context.getGridStep();
		const height = this.view.getHeight();
		const width = this.view.getWidth();

		// Adaptive density: skip grid lines if pixel spacing too tight.
		const firstSection = map.sections[0] ?? {
			bpm: 120,
			time: 0,
		};
		const stepSeconds = stepDurationSeconds(firstSection, step);
		let stride = 1;
		if (stepSeconds > 0) {
			const stepPixels = this.view.timeToPixels(stepSeconds);
			while (
				stepPixels > 0 &&
				stepPixels * stride < this.opts.minPixelSpacing
			) {
				stride *= 2;
				if (stride > 1024) break;
			}
		}

		context.setAttr("strokeStyle", this.opts.color);
		context.setAttr("globalAlpha", this.opts.opacity);
		context.setAttr("lineWidth", 1);

		let index = 0;
		let lastBarSection: TempoSection | undefined;
		let beatsPerBar = (firstSection.signature ?? DEFAULT_TIME_SIGNATURE)
			.numerator;
		let beatSeconds = 60 / firstSection.bpm;

		for (const { time, section } of gridTimes(map, step, startTime, endTime)) {
			if (section !== lastBarSection) {
				lastBarSection = section;
				const sig = section.signature ?? DEFAULT_TIME_SIGNATURE;
				beatsPerBar = sig.numerator;
				beatSeconds = 60 / section.bpm;
			}

			if (index % stride !== 0) {
				index++;
				continue;
			}
			index++;

			const pixelOffset =
				this.view.timeToPixels(time) - this.view.getFrameOffset();
			if (pixelOffset < -1 || pixelOffset > width + 1) {
				continue;
			}
			const x = Math.floor(pixelOffset) + 0.5;

			const isBar =
				this.opts.showBarLines &&
				isBarLine(section, time, beatSeconds, beatsPerBar);

			if (isBar) {
				context.setAttr("globalAlpha", 1);
				context.setAttr("lineWidth", this.opts.barLineWidth);
			} else {
				context.setAttr("globalAlpha", this.opts.opacity);
				context.setAttr("lineWidth", 1);
			}

			context.beginPath();
			context.moveTo(x, 0);
			context.lineTo(x, height);
			context.stroke();
		}

		context.setAttr("globalAlpha", 1);
	}
}

function isBarLine(
	section: TempoSection,
	time: number,
	beatSeconds: number,
	beatsPerBar: number,
): boolean {
	const barSeconds = beatSeconds * beatsPerBar;
	if (barSeconds <= 0) return false;
	const offset = time - section.time;
	const remainder = offset % barSeconds;
	const tolerance = beatSeconds * 1e-4;
	return remainder < tolerance || barSeconds - remainder < tolerance;
}
