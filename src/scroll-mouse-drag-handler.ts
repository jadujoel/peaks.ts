import type { Group } from "konva/lib/Group";
import { MouseDragHandler } from "./mouse-drag-handler";
import type { PeaksInstance } from "./types";
import { clamp } from "./utils";

/**
 * Creates a handler for mouse events to allow scrolling the zoomable
 * waveform view by clicking and dragging the mouse.
 */

export interface ScrollMouseDragHandlerFromOptions {
	readonly peaks: PeaksInstance;
	readonly view: import("./waveform-zoomview").WaveformZoomView;
}

export class ScrollMouseDragHandler {
	private readonly peaks: PeaksInstance;
	private readonly view: import("./waveform-zoomview").WaveformZoomView;
	private seeking: boolean;
	private firstMove: boolean;
	private segment: Group | undefined;
	private segmentIsDraggable: boolean;
	private initialFrameOffset: number;
	private mouseDownX: number;
	private readonly mouseDragHandler: MouseDragHandler;

	static from(
		options: ScrollMouseDragHandlerFromOptions,
	): ScrollMouseDragHandler {
		return new ScrollMouseDragHandler(options.peaks, options.view);
	}

	private constructor(
		peaks: PeaksInstance,
		view: import("./waveform-zoomview").WaveformZoomView,
	) {
		this.peaks = peaks;
		this.view = view;
		this.seeking = false;
		this.firstMove = false;
		this.segment = undefined;
		this.segmentIsDraggable = false;
		this.initialFrameOffset = 0;
		this.mouseDownX = 0;

		this.mouseDragHandler = MouseDragHandler.from({
			handlers: {
				onMouseDown: this.onMouseDown,
				onMouseMove: this.onMouseMove,
				onMouseUp: this.onMouseUp,
			},
			stage: view.stage,
		});
	}

	isDragging(): boolean {
		return this.mouseDragHandler.isDragging();
	}

	private onMouseDown = (
		mousePosX: number,
		segment: Group | undefined,
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
			if (this.view.isSeekEnabled() && !this.mouseDragHandler.isDragging()) {
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

	destroy(): void {
		this.mouseDragHandler.destroy();
	}
}
