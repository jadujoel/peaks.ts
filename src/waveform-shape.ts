import type { Context } from "konva/lib/Context";
import Konva from "konva/lib/Core";
import type { Layer } from "konva/lib/Layer";
import type { KonvaEventObject } from "konva/lib/Node";
import type { Shape, ShapeConfig } from "konva/lib/Shape";
import type WaveformData from "waveform-data";
import type { WaveformDataChannel } from "waveform-data";
import type { WaveformViewAPI } from "./types";
import type { WaveformColor } from "./utils";
import { clamp, isLinearGradientColor, isString } from "./utils";

interface TimeRange {
	startTime: number;
	endTime: number;
}

export interface WaveformShapeFromOptions {
	readonly color: WaveformColor;
	readonly view: WaveformViewAPI;
	readonly segment?: TimeRange;
}

/**
 * Creates a Konva.Shape object that renders a waveform image.
 */

export class WaveformShape {
	private readonly color: WaveformColor;
	private readonly shape: Shape;
	private readonly view: WaveformViewAPI;
	private segment: TimeRange | undefined;

	/**
	 * Creates a waveform shape for a solid color or linear gradient fill.
	 *
	 * @throws {TypeError} If the provided color is neither a string nor a valid linear gradient.
	 */
	static from(options: WaveformShapeFromOptions): WaveformShape {
		return new WaveformShape(options);
	}

	private constructor(options: WaveformShapeFromOptions) {
		this.color = options.color;

		const shapeOptions: ShapeConfig = {};

		if (isString(options.color)) {
			shapeOptions.fill = options.color;
		} else if (isLinearGradientColor(options.color)) {
			const startY =
				options.view.height * (options.color.linearGradientStart / 100);
			const endY =
				options.view.height * (options.color.linearGradientEnd / 100);

			shapeOptions.fillLinearGradientStartPointY = startY;
			shapeOptions.fillLinearGradientEndPointY = endY;
			shapeOptions.fillLinearGradientColorStops = [
				0,
				options.color.linearGradientColorStops[0] as string | number,
				1,
				options.color.linearGradientColorStops[1] as string | number,
			];
		} else {
			throw new TypeError("Unknown type for color property");
		}

		this.shape = new Konva.Shape(shapeOptions);
		this.view = options.view;
		this.segment = options.segment;

		this.shape.sceneFunc(this.sceneFunc);
	}

	getX(): number {
		return this.shape.x();
	}

	setX(x: number): void {
		this.shape.x(x);
	}

	setSegment(segment: TimeRange | undefined): void {
		this.segment = segment;
	}

	/**
	 * Updates the waveform fill color.
	 *
	 * @throws {TypeError} If color is neither a string nor a valid linear gradient.
	 */
	setWaveformColor(color: WaveformColor): undefined | never {
		if (isString(color)) {
			this.shape.fill(color);

			this.shape.fillLinearGradientStartPointY(null);
			this.shape.fillLinearGradientEndPointY(null);
			this.shape.fillLinearGradientColorStops(null);
		} else if (isLinearGradientColor(color)) {
			this.shape.fill(null);

			const startY = this.view.height * (color.linearGradientStart / 100);
			const endY = this.view.height * (color.linearGradientEnd / 100);

			this.shape.fillLinearGradientStartPointY(startY);
			this.shape.fillLinearGradientEndPointY(endY);
			this.shape.fillLinearGradientColorStops([
				0,
				color.linearGradientColorStops[0] as string | number,
				1,
				color.linearGradientColorStops[1] as string | number,
			]);
		} else {
			throw new TypeError("Unknown type for color property");
		}
	}

	fitToView(): void {
		this.setWaveformColor(this.color);
	}

	private sceneFunc = (context: Context): void => {
		const frameOffset = this.view.getFrameOffset();
		const width = this.view.getWidth();
		const height = this.view.getHeight();

		const waveformData = this.view.getWaveformData();

		if (!waveformData) {
			return;
		}

		this.drawWaveform(
			context,
			waveformData,
			frameOffset,
			this.segment
				? this.view.timeToPixels(this.segment.startTime)
				: frameOffset,
			this.segment
				? this.view.timeToPixels(this.segment.endTime)
				: frameOffset + width,
			width,
			height,
		);
	};

	/**
	 * Draws a waveform on a canvas context.
	 *
	 * @param context The canvas context to draw on.
	 * @param waveformData The waveform data to draw.
	 * @param frameOffset The start position of the waveform shown
	 *   in the view, in pixels.
	 * @param startPixels The start position of the waveform to draw,
	 *   in pixels.
	 * @param endPixels The end position of the waveform to draw,
	 *   in pixels.
	 * @param width The width of the waveform area, in pixels.
	 * @param height The height of the waveform area, in pixels.
	 */

	private drawWaveform(
		context: Context,
		waveformData: WaveformData,
		frameOffset: number,
		startPixels: number,
		endPixels: number,
		width: number,
		height: number,
	): void {
		if (startPixels < frameOffset) {
			startPixels = frameOffset;
		}

		const limit = frameOffset + width;

		if (endPixels > limit) {
			endPixels = limit;
		}

		if (endPixels > waveformData.length - 1) {
			endPixels = waveformData.length - 1;
		}

		const channels = waveformData.channels;

		let waveformTop = 0;
		let waveformHeight = Math.floor(height / channels);

		for (let i = 0; i < channels; i++) {
			if (i === channels - 1) {
				waveformHeight = height - (channels - 1) * waveformHeight;
			}

			this.drawChannel(
				context,
				waveformData.channel(i),
				frameOffset,
				startPixels,
				endPixels,
				waveformTop,
				waveformHeight,
			);

			waveformTop += waveformHeight;
		}
	}

	/**
	 * Draws a single waveform channel on a canvas context.
	 *
	 * @param context The canvas context to draw on.
	 * @param channel The waveform data to draw.
	 * @param frameOffset The start position of the waveform shown
	 *   in the view, in pixels.
	 * @param startPixels The start position of the waveform to draw,
	 *   in pixels.
	 * @param endPixels The end position of the waveform to draw,
	 *   in pixels.
	 * @param top The top of the waveform channel area, in pixels.
	 * @param height The height of the waveform channel area, in pixels.
	 */

	private drawChannel(
		context: Context,
		channel: WaveformDataChannel,
		frameOffset: number,
		startPixels: number,
		endPixels: number,
		top: number,
		height: number,
	): void {
		let x: number;
		let amplitude: number;

		const amplitudeScale = this.view.getAmplitudeScale();

		let lineX: number;
		let lineY: number;

		context.beginPath();

		for (x = startPixels; x <= endPixels; x++) {
			amplitude = channel.min_sample(x);

			lineX = x - frameOffset + 0.5;
			lineY =
				top + WaveformShape.scaleY(amplitude, height, amplitudeScale) + 0.5;

			context.lineTo(lineX, lineY);
		}

		for (x = endPixels; x >= startPixels; x--) {
			amplitude = channel.max_sample(x);

			lineX = x - frameOffset + 0.5;
			lineY =
				top + WaveformShape.scaleY(amplitude, height, amplitudeScale) + 1.0;

			context.lineTo(lineX, lineY);
		}

		context.closePath();

		context.fillShape(this.shape);
	}

	addToLayer(layer: Layer): void {
		layer.add(this.shape);
	}

	destroy(): void {
		this.shape.destroy();
	}

	on(
		event: string,
		handler: (event: KonvaEventObject<MouseEvent>) => void,
	): void {
		this.shape.on(event, handler);
	}

	off(
		event: string,
		handler: (event: KonvaEventObject<MouseEvent>) => void,
	): void {
		this.shape.off(event, handler);
	}

	/**
	 * Scales the waveform data for drawing on a canvas context.
	 *
	 * @see https://stats.stackexchange.com/questions/281162
	 *
	 * @param amplitude The waveform data point amplitude.
	 * @param height The height of the waveform, in pixels.
	 * @param scale Amplitude scaling factor.
	 * @returns The scaled waveform data point.
	 */

	static scaleY(amplitude: number, height: number, scale: number): number {
		const y = (-(height - 1) * (amplitude * scale + 128)) / 255 + (height - 1);

		return clamp(Math.floor(y), 0, height - 1);
	}
}
