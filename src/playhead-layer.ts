import { Animation } from "konva/lib/Animation";
import type { Context } from "konva/lib/Context";
import Konva from "konva/lib/Core";
import type { Group } from "konva/lib/Group";
import type { Layer } from "konva/lib/Layer";
import type { Shape } from "konva/lib/Shape";
import type { Stage } from "konva/lib/Stage";
import { Line } from "konva/lib/shapes/Line";
import { Text } from "konva/lib/shapes/Text";
import type { PlayerInstance, ViewOptions, WaveformViewAPI } from "./types";

/**
 * Creates a Konva.Layer that displays a playhead marker.
 */

export interface PlayheadLayerFromOptions {
	readonly player: PlayerInstance;
	readonly view: WaveformViewAPI;
	readonly options: ViewOptions;
}

export class PlayheadLayer {
	private constructor(
		private readonly player: PlayerInstance,
		private readonly view: WaveformViewAPI,
		private readonly playheadColor: string,
		private readonly playheadTextColor: string,
		private readonly playheadBackgroundColor: string,
		private readonly playheadPadding: number,
		private readonly playheadWidth: number,
		private readonly playheadFontFamily: string,
		private readonly playheadFontSize: number,
		private readonly playheadFontStyle: string,
		private readonly playheadLayer: Layer,
		private readonly playheadLine: Line,
		private readonly playheadGroup: Group,
		private playheadPixel: number,
		private playheadLineAnimation: Animation | undefined,
		private playheadVisible: boolean,
		private playheadText: Text | undefined,
		private useAnimation: boolean,
	) {}

	static from(options: PlayheadLayerFromOptions): PlayheadLayer {
		const opts = options.options;
		const playheadLine = new Line({
			stroke: opts.playheadColor,
			strokeWidth: opts.playheadWidth,
		});

		const playheadGroup = new Konva.Group({
			x: 0,
			y: 0,
		});

		playheadGroup.add(playheadLine);

		const playheadLayer = new Konva.Layer({ listening: false });
		playheadLayer.add(playheadGroup);

		const instance = new PlayheadLayer(
			options.player,
			options.view,
			opts.playheadColor,
			opts.playheadTextColor,
			opts.playheadBackgroundColor,
			opts.playheadPadding,
			opts.playheadWidth,
			opts.playheadFontFamily,
			opts.playheadFontSize,
			opts.playheadFontStyle,
			playheadLayer,
			playheadLine,
			playheadGroup,
			0,
			undefined,
			false,
			undefined,
			false,
		);

		if (opts.showPlayheadTime) {
			instance.createPlayheadText();
		}

		instance.fitToView();
		instance.zoomLevelChanged();

		return instance;
	}

	addToStage(stage: Stage): void {
		stage.add(this.playheadLayer);
	}

	zoomLevelChanged(): void {
		const pixelsPerSecond = this.view.timeToPixels(1.0);

		this.useAnimation = pixelsPerSecond >= 5;

		if (this.useAnimation) {
			if (this.player.isPlaying() && !this.playheadLineAnimation) {
				this.start();
			}
		} else {
			if (this.playheadLineAnimation) {
				const time = this.player.getCurrentTime();

				this.stop(time);
			}
		}
	}

	fitToView(): void {
		const height = this.view.getHeight();

		this.playheadLine.points([0.5, 0, 0.5, height]);

		if (this.playheadText) {
			this.playheadText.y(12);
		}
	}

	updatePlayheadTime(time: number): void {
		this.syncPlayhead(time);

		if (this.player.isPlaying()) {
			this.start();
		}
	}

	stop(time: number): void {
		if (this.playheadLineAnimation) {
			this.playheadLineAnimation.stop();
			this.playheadLineAnimation = undefined;
		}

		this.syncPlayhead(time);
	}

	getPlayheadPixel(): number {
		return this.playheadPixel;
	}

	showPlayheadTime(show: boolean): void {
		if (show) {
			if (!this.playheadText) {
				this.createPlayheadText();
				this.fitToView();
			}
		} else {
			if (this.playheadText) {
				this.playheadText.remove();
				this.playheadText.destroy();
				this.playheadText = undefined;
			}
		}
	}

	updatePlayheadText(): void {
		if (this.playheadText) {
			const time = this.player.getCurrentTime();
			const text = this.view.formatTime(time);

			this.playheadText.setText(text);
		}
	}

	dispose(): void {
		if (this.playheadLineAnimation) {
			this.playheadLineAnimation.stop();
			this.playheadLineAnimation = undefined;
		}
	}

	private createPlayheadText(): void {
		const time = this.player.getCurrentTime();
		const text = this.view.formatTime(time);

		this.playheadText = new Text({
			align: "right",
			fill: this.playheadTextColor,
			fontFamily: this.playheadFontFamily,
			fontSize: this.playheadFontSize,
			fontStyle: this.playheadFontStyle,
			padding: this.playheadPadding,
			sceneFunc: (context: Context, shape: Shape) => {
				const width = shape.width();
				const height = shape.height() + 2 * this.playheadPadding;

				context.fillStyle = this.playheadBackgroundColor;
				context.fillRect(0, -this.playheadPadding, width, height);
				(shape as Text)._sceneFunc(context);
			},
			text: text,
			x: 0,
			y: 0,
		});

		this.playheadGroup.add(this.playheadText);
	}

	private syncPlayhead(time: number): void {
		const pixelIndex = this.view.timeToPixels(time);

		const frameOffset = this.view.getFrameOffset();
		const width = this.view.getWidth();

		const isVisible =
			pixelIndex >= frameOffset && pixelIndex <= frameOffset + width;

		this.playheadPixel = pixelIndex;

		if (isVisible) {
			const playheadX = this.playheadPixel - frameOffset;

			if (!this.playheadVisible) {
				this.playheadVisible = true;
				this.playheadGroup.show();
			}

			this.playheadGroup.x(playheadX);

			if (this.playheadText) {
				const text = this.view.formatTime(time);
				const playheadTextWidth = this.playheadText.width();

				this.playheadText.setText(text);

				if (playheadTextWidth + playheadX > width - 2) {
					this.playheadText.x(-playheadTextWidth);
				} else if (playheadTextWidth + playheadX < width) {
					this.playheadText.x(0);
				}
			}
		} else {
			if (this.playheadVisible) {
				this.playheadVisible = false;
				this.playheadGroup.hide();
			}
		}

		if (this.view.playheadPosChanged) {
			this.view.playheadPosChanged(time);
		}
	}

	private start(): void {
		if (this.playheadLineAnimation) {
			this.playheadLineAnimation.stop();
			this.playheadLineAnimation = undefined;
		}

		if (!this.useAnimation) {
			return;
		}

		let lastPlayheadPosition: number | undefined;

		this.playheadLineAnimation = new Animation(() => {
			const time = this.player.getCurrentTime();
			const playheadPosition = this.view.timeToPixels(time);

			if (playheadPosition !== lastPlayheadPosition) {
				this.syncPlayhead(time);
				lastPlayheadPosition = playheadPosition;
			}
		}, this.playheadLayer);

		this.playheadLineAnimation.start();
	}
}
