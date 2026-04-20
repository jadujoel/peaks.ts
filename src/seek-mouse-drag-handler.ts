import type { Stage } from "konva/lib/Stage";
import { MouseDragHandler } from "./mouse-drag-handler";
import type { PeaksInstance, WaveformViewAPI } from "./types";
import { clamp } from "./utils";

export interface SeekMouseDragHandlerFromOptions {
	readonly peaks: PeaksInstance;
	readonly view: SeekMouseDragHandlerView;
}

export interface SeekMouseDragHandlerView extends WaveformViewAPI {
	readonly stage: Stage;
	dragSeek(dragging: boolean): void;
}

export class SeekMouseDragHandler {
	private readonly peaks: PeaksInstance;
	private readonly view: SeekMouseDragHandlerView;
	private firstMove: boolean;
	private readonly width!: number;
	private readonly mouseDragHandler: MouseDragHandler;

	static from(options: SeekMouseDragHandlerFromOptions): SeekMouseDragHandler {
		return new SeekMouseDragHandler(options.peaks, options.view);
	}

	private constructor(peaks: PeaksInstance, view: SeekMouseDragHandlerView) {
		this.peaks = peaks;
		this.view = view;
		this.firstMove = false;

		this.mouseDragHandler = MouseDragHandler.from({
			handlers: {
				onMouseDown: this.onMouseDown,
				onMouseMove: this.onMouseMove,
				onMouseUp: this.onMouseUp,
			},
			stage: view.stage,
		});
	}

	private onMouseDown = (mousePosX: number): void => {
		this.firstMove = true;
		this.seek(mousePosX);
	};

	private onMouseMove = (mousePosX: number): void => {
		if (this.firstMove) {
			this.view.dragSeek(true);
			this.firstMove = false;
		}

		this.seek(mousePosX);
	};

	private onMouseUp = (): void => {
		this.view.dragSeek(false);
	};

	private seek(mousePosX: number): void {
		if (!this.view.isSeekEnabled()) {
			return;
		}

		mousePosX = clamp(mousePosX, 0, this.width);

		let time = this.view.pixelsToTime(mousePosX);
		const duration = this.peaks.player.getDuration();

		if (time > duration) {
			time = duration;
		}

		this.view.updatePlayheadTime(time);

		this.peaks.player.seek(time);
	}

	destroy(): void {
		this.mouseDragHandler.destroy();
	}
}
