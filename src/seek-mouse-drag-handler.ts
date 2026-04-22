import type { DriverStage } from "./driver/types";
import { MouseDragHandler } from "./mouse-drag-handler";
import type { PeaksInstance, WaveformViewAPI } from "./types";
import { clamp } from "./utils";

export interface SeekMouseDragHandlerFromOptions {
	readonly peaks: PeaksInstance;
	readonly view: SeekMouseDragHandlerViewApi;
}

export interface SeekMouseDragHandlerViewApi extends WaveformViewAPI {
	readonly stage: DriverStage;
	dragSeek(dragging: boolean): void;
}

export class SeekMouseDragHandler {
	private constructor(
		private readonly peaks: PeaksInstance,
		private readonly view: SeekMouseDragHandlerViewApi,
		private firstMove: boolean = false,
		private handler: MouseDragHandler | undefined = undefined,
	) {}

	static from(options: SeekMouseDragHandlerFromOptions): SeekMouseDragHandler {
		const instance = new SeekMouseDragHandler(options.peaks, options.view);
		instance.handler = MouseDragHandler.from({
			driver: options.peaks.options.driver,
			handlers: {
				onMouseDown: instance.onMouseDown,
				onMouseMove: instance.onMouseMove,
				onMouseUp: instance.onMouseUp,
			},
			stage: options.view.stage,
		});
		return instance;
	}

	dispose(): void {
		this.handler?.dispose();
	}

	private onMouseDown = (x: number): void => {
		this.firstMove = true;
		this.seek(x);
	};

	private onMouseMove = (x: number): void => {
		if (this.firstMove) {
			this.view.dragSeek(true);
			this.firstMove = false;
		}

		this.seek(x);
	};

	private onMouseUp = (): void => {
		this.view.dragSeek(false);
	};

	private seek(x: number): void {
		if (!this.view.isSeekEnabled()) {
			return;
		}

		const width = this.view.getWidth();
		const clamped = clamp(x, 0, width);
		const duration = this.peaks.player.getDuration();
		const time =
			clamped >= width
				? duration
				: Math.min(this.view.pixelsToTime(clamped), duration);

		this.view.updatePlayheadTime(time);
		this.peaks.player.seek(time);
	}
}
