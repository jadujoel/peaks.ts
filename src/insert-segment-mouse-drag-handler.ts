import type { Group } from "konva/lib/Group";
import { MouseDragHandler } from "./mouse-drag-handler";
import type { Segment } from "./segment";
import type { PeaksInstance, SegmentShapeAPI } from "./types";

export interface InsertSegmentMouseDragHandlerFromOptions {
	readonly peaks: PeaksInstance;
	readonly view: import("./waveform-zoomview").WaveformZoomView;
}

export class InsertSegmentMouseDragHandler {
	private readonly peaks: PeaksInstance;
	private readonly view: import("./waveform-zoomview").WaveformZoomView;
	private insertSegment: Segment | undefined;
	private insertSegmentShape: SegmentShapeAPI | undefined;
	private segmentIsDraggable: boolean;
	private segment: Group | undefined;
	private readonly mouseDragHandler: MouseDragHandler;

	static from(
		options: InsertSegmentMouseDragHandlerFromOptions,
	): InsertSegmentMouseDragHandler {
		return new InsertSegmentMouseDragHandler(options.peaks, options.view);
	}

	private constructor(
		peaks: PeaksInstance,
		view: import("./waveform-zoomview").WaveformZoomView,
	) {
		this.peaks = peaks;
		this.view = view;

		this.insertSegment = undefined;
		this.insertSegmentShape = undefined;
		this.segmentIsDraggable = false;
		this.segment = undefined;

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

	private reset(): void {
		this.insertSegment = undefined;
		this.insertSegmentShape = undefined;
		this.segmentIsDraggable = false;
		this.peaks.segments.setInserting(false);
	}

	private onMouseDown = (
		mousePosX: number,
		segment: Group | undefined,
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

	destroy(): void {
		this.mouseDragHandler.destroy();
	}
}
