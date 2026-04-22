import { MouseDragHandler } from "./mouse-drag-handler";
import type { PeaksGroup } from "./peaks-group";
import type { Segment } from "./segment";
import type { PeaksInstance, SegmentShapeAPI } from "./types";

export interface InsertSegmentMouseDragHandlerFromOptions {
	readonly peaks: PeaksInstance;
	readonly view: import("./waveform/zoomview").WaveformZoomView; // TODO: no dynamic imports
}

export class InsertSegmentMouseDragHandler {
	private constructor(
		private readonly peaks: PeaksInstance,
		private readonly view: import("./waveform/zoomview").WaveformZoomView,
		private insertSegment: Segment | undefined = undefined,
		private insertSegmentShape: SegmentShapeAPI | undefined = undefined,
		private segmentIsDraggable: boolean = false,
		private segment: PeaksGroup | undefined = undefined,
		private mouseDragHandler: MouseDragHandler | undefined = undefined,
	) {}

	static from(
		options: InsertSegmentMouseDragHandlerFromOptions,
	): InsertSegmentMouseDragHandler {
		const instance = new InsertSegmentMouseDragHandler(
			options.peaks,
			options.view,
		);
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

	private reset(): void {
		this.insertSegment = undefined;
		this.insertSegmentShape = undefined;
		this.segmentIsDraggable = false;
		this.peaks.segments.setInserting(false);
	}

	private onMouseDown = (
		mousePosX: number,
		segment: PeaksGroup | undefined,
	): void => {
		this.reset();
		this.segment = segment;

		if (this.segment) {
			if (this.view.getSegmentDragMode() !== "overlap") {
				return;
			}
			this.segmentIsDraggable = this.segment.draggable();
			this.segment.draggable(false);
		}

		const time = this.view.pixelsToTime(mousePosX + this.view.getFrameOffset());

		this.peaks.segments.setInserting(true);

		this.insertSegment = this.peaks.segments.add({
			editable: true,
			endTime: time,
			startTime: time,
		}) as Segment;

		this.insertSegmentShape = this.view.segmentsLayer?.getSegmentShape(
			this.insertSegment,
		);

		if (this.insertSegmentShape) {
			this.insertSegmentShape.moveMarkersToTop();
			this.insertSegmentShape.startDrag();
		}
	};

	private onMouseMove = (): void => {};

	private onMouseUp = (): void => {
		if (!this.insertSegment) {
			return;
		}

		if (this.insertSegmentShape) {
			this.insertSegmentShape.stopDrag();
			this.insertSegmentShape = undefined;
		}

		if (this.segment && this.segmentIsDraggable) {
			this.segment.draggable(true);
		}

		this.peaks.emit("segments.insert", {
			segment: this.insertSegment,
		});

		this.peaks.segments.setInserting(false);
	};
}
