import { MouseDragHandler } from "./mouse-drag-handler";
import type { PeaksGroup } from "./peaks-group";
import type { PeaksInstance } from "./types";
import { clamp } from "./utils";

/**
 * Creates a handler for mouse events to allow scrolling the zoomable
 * waveform view by clicking and dragging the mouse.
 */

export interface ScrollMouseDragHandlerFromOptions {
	readonly peaks: PeaksInstance;
	readonly view: import("./waveform/zoomview").WaveformZoomView; // todo: no dynamic imports for types
}

export class ScrollMouseDragHandler {
	private constructor(
		private readonly peaks: PeaksInstance,
		private readonly view: import("./waveform/zoomview").WaveformZoomView,
		private seeking: boolean = false,
		private firstMove: boolean = false,
		private segment: PeaksGroup | undefined = undefined,
		private segmentIsDraggable: boolean = false,
		private initialFrameOffset: number = 0,
		private mouseDownX: number = 0,
		private mouseDragHandler: MouseDragHandler | undefined = undefined,
	) {}

	static from(
		options: ScrollMouseDragHandlerFromOptions,
	): ScrollMouseDragHandler {
		const instance = new ScrollMouseDragHandler(options.peaks, options.view);
		instance.mouseDragHandler = MouseDragHandler.from({
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

	isDragging(): boolean {
		return this.mouseDragHandler?.isDragging() ?? false;
	}

	dispose(): void {
		this.mouseDragHandler?.dispose();
	}

	private onMouseDown = (
		mousePosX: number,
		segment: PeaksGroup | undefined,
	): void => {
		this.seeking = false;
		this.firstMove = true;

		if (segment && !segment.attrs.draggable) {
			this.segment = undefined;
		} else {
			this.segment = segment;
		}

		const playheadOffset = this.view.getPlayheadOffset();

		if (
			this.view.isSeekEnabled() &&
			Math.abs(mousePosX - playheadOffset) <=
				this.view.getPlayheadClickTolerance()
		) {
			this.seeking = true;

			if (this.segment) {
				this.segmentIsDraggable = this.segment.draggable();
				this.segment.draggable(false);
			}
		}

		if (this.seeking) {
			mousePosX = clamp(mousePosX, 0, this.view.getWidth());

			const time = this.view.pixelsToTime(
				mousePosX + this.view.getFrameOffset(),
			);

			this.seek(time);
		} else {
			this.initialFrameOffset = this.view.getFrameOffset();
			this.mouseDownX = mousePosX;
		}
	};

	private onMouseMove = (mousePosX: number): void => {
		if (this.segment && !this.seeking) {
			return;
		}

		if (this.seeking) {
			if (this.firstMove) {
				this.view.dragSeek(true);
				this.firstMove = false;
			}

			mousePosX = clamp(mousePosX, 0, this.view.getWidth());

			const time = this.view.pixelsToTime(
				mousePosX + this.view.getFrameOffset(),
			);

			this.seek(time);
		} else {
			if (!this.view.isAutoZoom()) {
				const diff = this.mouseDownX - mousePosX;
				const newFrameOffset = this.initialFrameOffset + diff;

				if (newFrameOffset !== this.initialFrameOffset) {
					this.view.updateWaveform(newFrameOffset, false);
				}
			}
		}
	};

	private onMouseUp = (): void => {
		if (this.seeking) {
			this.view.dragSeek(false);
		} else {
			if (this.view.isSeekEnabled() && !this.mouseDragHandler?.isDragging()) {
				const time = this.view.pixelOffsetToTime(this.mouseDownX);

				this.seek(time);
			}
		}

		if (this.segment && this.seeking) {
			if (this.segmentIsDraggable) {
				this.segment.draggable(true);
			}
		}
	};

	private seek(time: number): void {
		const duration = this.peaks.player.getDuration();

		if (time > duration) {
			time = duration;
		}

		this.view.updatePlayheadTime(time);

		this.peaks.player.seek(time);
	}
}
