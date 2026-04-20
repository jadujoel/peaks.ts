import type { Stage } from "konva/lib/Stage";
import { MouseDragHandler } from "./mouse-drag-handler";
import type { PeaksInstance, WaveformViewAPI } from "./types";
import { clamp } from "./utils";

export interface SeekMouseDragHandlerFromOptions {
	readonly peaks: PeaksInstance;
	readonly view: SeekMouseDragHandlerView;
}

export interface SeekMouseDragHandlerView extends WaveformViewAPI {
	readonly _stage: Stage;
	dragSeek(dragging: boolean): void;
}

export class SeekMouseDragHandler {
	private readonly _peaks: PeaksInstance;
	private readonly _view: SeekMouseDragHandlerView;
	private _firstMove: boolean;
	private readonly _width!: number;
	private readonly _mouseDragHandler: MouseDragHandler;

	static from(options: SeekMouseDragHandlerFromOptions): SeekMouseDragHandler {
		return new SeekMouseDragHandler(options.peaks, options.view);
	}

	private constructor(
		peaks: PeaksInstance,
		view: SeekMouseDragHandler["_view"],
	) {
		this._peaks = peaks;
		this._view = view;
		this._firstMove = false;

		this._onMouseDown = this._onMouseDown.bind(this);
		this._onMouseMove = this._onMouseMove.bind(this);
		this._onMouseUp = this._onMouseUp.bind(this);

		this._mouseDragHandler = MouseDragHandler.from({
			stage: view._stage,
			handlers: {
				onMouseDown: this._onMouseDown,
				onMouseMove: this._onMouseMove,
				onMouseUp: this._onMouseUp,
			},
		});
	}

	private _onMouseDown(mousePosX: number): void {
		this._firstMove = true;
		this._seek(mousePosX);
	}

	private _onMouseMove(mousePosX: number): void {
		if (this._firstMove) {
			this._view.dragSeek(true);
			this._firstMove = false;
		}

		this._seek(mousePosX);
	}

	private _onMouseUp(): void {
		this._view.dragSeek(false);
	}

	private _seek(mousePosX: number): void {
		if (!this._view.isSeekEnabled()) {
			return;
		}

		mousePosX = clamp(mousePosX, 0, this._width);

		let time = this._view.pixelsToTime(mousePosX);
		const duration = this._peaks.player.getDuration();

		// Prevent the playhead position from jumping by limiting click
		// handling to the waveform duration.
		if (time > duration) {
			time = duration;
		}

		// Update the playhead position. This gives a smoother visual update
		// than if we only use the player.timeupdate event.
		this._view.updatePlayheadTime(time);

		this._peaks.player.seek(time);
	}

	destroy(): void {
		this._mouseDragHandler.destroy();
	}
}
