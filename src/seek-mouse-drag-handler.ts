import MouseDragHandler from "./mouse-drag-handler";
import type { PeaksInstance, WaveformViewAPI } from "./types";
import { clamp } from "./utils";

class SeekMouseDragHandler {
	private _peaks: PeaksInstance;
	private _view: WaveformViewAPI & {
		_stage: import("konva/lib/Stage").Stage;
		dragSeek(dragging: boolean): void;
	};
	private _firstMove: boolean;
	private _width!: number;
	private _mouseDragHandler: MouseDragHandler;

	constructor(peaks: PeaksInstance, view: SeekMouseDragHandler["_view"]) {
		this._peaks = peaks;
		this._view = view;
		this._firstMove = false;

		this._onMouseDown = this._onMouseDown.bind(this);
		this._onMouseMove = this._onMouseMove.bind(this);
		this._onMouseUp = this._onMouseUp.bind(this);

		this._mouseDragHandler = new MouseDragHandler(view._stage, {
			onMouseDown: this._onMouseDown,
			onMouseMove: this._onMouseMove,
			onMouseUp: this._onMouseUp,
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

export default SeekMouseDragHandler;
