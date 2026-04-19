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
	private _player: PlayerInstance;
	private _view: WaveformViewAPI;
	private _playheadPixel: number;
	private _playheadLineAnimation: Animation | undefined;
	private _playheadVisible: boolean;
	private _playheadColor: string;
	private _playheadTextColor: string;
	private _playheadBackgroundColor: string;
	private _playheadPadding: number;
	private _playheadWidth: number;
	private _playheadFontFamily: string;
	private _playheadFontSize: number;
	private _playheadFontStyle: string;
	private _playheadLayer: Layer;
	private _playheadLine!: Line;
	private _playheadGroup!: Group;
	private _playheadText: Text | undefined;
	private _useAnimation: boolean;

	static from(options: PlayheadLayerFromOptions): PlayheadLayer {
		return new PlayheadLayer(options.player, options.view, options.options);
	}

	private constructor(
		player: PlayerInstance,
		view: WaveformViewAPI,
		options: ViewOptions,
	) {
		this._player = player;
		this._view = view;
		this._playheadPixel = 0;
		this._playheadLineAnimation = undefined;
		this._playheadVisible = false;
		this._playheadColor = options.playheadColor;
		this._playheadTextColor = options.playheadTextColor;
		this._playheadBackgroundColor = options.playheadBackgroundColor;
		this._playheadPadding = options.playheadPadding;
		this._playheadWidth = options.playheadWidth;

		this._playheadFontFamily = options.playheadFontFamily;
		this._playheadFontSize = options.playheadFontSize;
		this._playheadFontStyle = options.playheadFontStyle;

		this._playheadLayer = new Konva.Layer({ listening: false });
		this._useAnimation = false;

		this._createPlayhead();

		if (options.showPlayheadTime) {
			this._createPlayheadText();
		}

		this.fitToView();

		this.zoomLevelChanged();
	}

	/**
	 * Adds the layer to the given Konva.Stage.
	 */

	addToStage(stage: Stage): void {
		stage.add(this._playheadLayer);
	}

	/**
	 * Decides whether to use an animation to update the playhead position.
	 *
	 * If the zoom level is such that the number of pixels per second of audio is
	 * low, we can use timeupdate events from the HTMLMediaElement to
	 * set the playhead position. Otherwise, we use an animation to update the
	 * playhead position more smoothly. The animation is CPU intensive, so we
	 * avoid using it where possible.
	 */

	zoomLevelChanged(): void {
		const pixelsPerSecond = this._view.timeToPixels(1.0);

		this._useAnimation = pixelsPerSecond >= 5;

		if (this._useAnimation) {
			if (this._player.isPlaying() && !this._playheadLineAnimation) {
				// Start the animation
				this._start();
			}
		} else {
			if (this._playheadLineAnimation) {
				// Stop the animation
				const time = this._player.getCurrentTime();

				this.stop(time);
			}
		}
	}

	/**
	 * Resizes the playhead UI objects to fit the available space in the
	 * view.
	 */

	fitToView(): void {
		const height = this._view.getHeight();

		this._playheadLine.points([0.5, 0, 0.5, height]);

		if (this._playheadText) {
			this._playheadText.y(12);
		}
	}

	/**
	 * Creates the playhead UI objects.
	 */

	private _createPlayhead(): void {
		// Create with default points, the real values are set in fitToView().
		this._playheadLine = new Line({
			stroke: this._playheadColor,
			strokeWidth: this._playheadWidth,
		});

		this._playheadGroup = new Konva.Group({
			x: 0,
			y: 0,
		});

		this._playheadGroup.add(this._playheadLine);
		this._playheadLayer.add(this._playheadGroup);
	}

	private _createPlayheadText(): void {
		const time = this._player.getCurrentTime();
		const text = this._view.formatTime(time);

		// Create with default y, the real value is set in fitToView().
		this._playheadText = new Text({
			x: 0,
			y: 0,
			padding: this._playheadPadding,
			text: text,
			fontSize: this._playheadFontSize,
			fontFamily: this._playheadFontFamily,
			fontStyle: this._playheadFontStyle,
			fill: this._playheadTextColor,
			align: "right",
			sceneFunc: (context: Context, shape: Shape) => {
				const width = shape.width();
				const height = shape.height() + 2 * this._playheadPadding;

				context.fillStyle = this._playheadBackgroundColor;
				context.fillRect(0, -this._playheadPadding, width, height);
				(shape as Text)._sceneFunc(context);
			},
		});

		this._playheadGroup.add(this._playheadText);
	}

	/**
	 * Updates the playhead position.
	 *
	 * @param time Current playhead position, in seconds.
	 */

	updatePlayheadTime(time: number): void {
		this._syncPlayhead(time);

		if (this._player.isPlaying()) {
			this._start();
		}
	}

	/**
	 * Updates the playhead position.
	 *
	 * @param time Current playhead position, in seconds.
	 */

	private _syncPlayhead(time: number): void {
		const pixelIndex = this._view.timeToPixels(time);

		const frameOffset = this._view.getFrameOffset();
		const width = this._view.getWidth();

		const isVisible =
			pixelIndex >= frameOffset && pixelIndex <= frameOffset + width;

		this._playheadPixel = pixelIndex;

		if (isVisible) {
			const playheadX = this._playheadPixel - frameOffset;

			if (!this._playheadVisible) {
				this._playheadVisible = true;
				this._playheadGroup.show();
			}

			this._playheadGroup.x(playheadX);

			if (this._playheadText) {
				const text = this._view.formatTime(time);
				const playheadTextWidth = this._playheadText.width();

				this._playheadText.setText(text);

				if (playheadTextWidth + playheadX > width - 2) {
					this._playheadText.x(-playheadTextWidth);
				} else if (playheadTextWidth + playheadX < width) {
					this._playheadText.x(0);
				}
			}
		} else {
			if (this._playheadVisible) {
				this._playheadVisible = false;
				this._playheadGroup.hide();
			}
		}

		if (this._view.playheadPosChanged) {
			this._view.playheadPosChanged(time);
		}
	}

	/**
	 * Starts a playhead animation in sync with the media playback.
	 */

	private _start(): void {
		if (this._playheadLineAnimation) {
			this._playheadLineAnimation.stop();
			this._playheadLineAnimation = undefined;
		}

		if (!this._useAnimation) {
			return;
		}

		let lastPlayheadPosition: number | undefined;

		this._playheadLineAnimation = new Animation(() => {
			const time = this._player.getCurrentTime();
			const playheadPosition = this._view.timeToPixels(time);

			if (playheadPosition !== lastPlayheadPosition) {
				this._syncPlayhead(time);
				lastPlayheadPosition = playheadPosition;
			}
		}, this._playheadLayer);

		this._playheadLineAnimation.start();
	}

	stop(time: number): void {
		if (this._playheadLineAnimation) {
			this._playheadLineAnimation.stop();
			this._playheadLineAnimation = undefined;
		}

		this._syncPlayhead(time);
	}

	getPlayheadPixel(): number {
		return this._playheadPixel;
	}

	showPlayheadTime(show: boolean): void {
		if (show) {
			if (!this._playheadText) {
				// Create it
				this._createPlayheadText();
				this.fitToView();
			}
		} else {
			if (this._playheadText) {
				this._playheadText.remove();
				this._playheadText.destroy();
				this._playheadText = undefined;
			}
		}
	}

	updatePlayheadText(): void {
		if (this._playheadText) {
			const time = this._player.getCurrentTime();
			const text = this._view.formatTime(time);

			this._playheadText.setText(text);
		}
	}

	destroy(): void {
		if (this._playheadLineAnimation) {
			this._playheadLineAnimation.stop();
			this._playheadLineAnimation = undefined;
		}
	}
}
