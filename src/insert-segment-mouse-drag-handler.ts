import type { Group } from "konva/lib/Group";
import MouseDragHandler from "./mouse-drag-handler";
import type { Segment } from "./segment";
import type { PeaksInstance, SegmentShapeAPI } from "./types";

class InsertSegmentMouseDragHandler {
	private _peaks: PeaksInstance;
	private _view: import("./waveform-zoomview").default;
	private _insertSegment: Segment | null;
	private _insertSegmentShape: SegmentShapeAPI | null;
	private _segmentIsDraggable: boolean;
	private _segment: Group | null;
	private _mouseDragHandler: MouseDragHandler;

	constructor(
		peaks: PeaksInstance,
		view: InsertSegmentMouseDragHandler["_view"],
	) {
		this._peaks = peaks;
		this._view = view;

		this._insertSegment = null;
		this._insertSegmentShape = null;
		this._segmentIsDraggable = false;
		this._segment = null;

		this._onMouseDown = this._onMouseDown.bind(this);
		this._onMouseMove = this._onMouseMove.bind(this);
		this._onMouseUp = this._onMouseUp.bind(this);

		this._mouseDragHandler = new MouseDragHandler(view._stage, {
			onMouseDown: this._onMouseDown,
			onMouseMove: this._onMouseMove,
			onMouseUp: this._onMouseUp,
		});
	}

	isDragging(): boolean {
		return this._mouseDragHandler.isDragging();
	}

	private _reset(): void {
		this._insertSegment = null;
		this._insertSegmentShape = null;
		this._segmentIsDraggable = false;
		this._peaks.segments.setInserting(false);
	}

	private _onMouseDown(mousePosX: number, segment: Group | null): void {
		this._reset();
		this._segment = segment;

		if (this._segment) {
			if (this._view.getSegmentDragMode() !== "overlap") {
				return;
			} else {
				// The user has clicked within a segment. We want to prevent
				// the segment from being dragged while the user inserts a new
				// segment. So we temporarily make the segment non-draggable,
				// and restore its draggable state in onMouseUp().
				this._segmentIsDraggable = this._segment.draggable();
				this._segment.draggable(false);
			}
		}

		const time = this._view.pixelsToTime(
			mousePosX + this._view.getFrameOffset(),
		);

		this._peaks.segments.setInserting(true);

		this._insertSegment = this._peaks.segments.add({
			startTime: time,
			endTime: time,
			editable: true,
		}) as Segment;

		this._insertSegmentShape =
			this._view._segmentsLayer?.getSegmentShape(this._insertSegment) ?? null;

		if (this._insertSegmentShape) {
			this._insertSegmentShape.moveMarkersToTop();
			this._insertSegmentShape.startDrag();
		}
	}

	private _onMouseMove(): void {}

	private _onMouseUp(): void {
		if (!this._insertSegment) {
			return;
		}

		if (this._insertSegmentShape) {
			this._insertSegmentShape.stopDrag();
			this._insertSegmentShape = null;
		}

		// If the user was dragging within an existing segment,
		// restore the segment's original draggable state.
		if (this._segment && this._segmentIsDraggable) {
			this._segment.draggable(true);
		}

		this._peaks.emit("segments.insert", {
			segment: this._insertSegment,
		});

		this._peaks.segments.setInserting(false);
	}

	destroy(): void {
		this._mouseDragHandler.destroy();
	}
}

export default InsertSegmentMouseDragHandler;
