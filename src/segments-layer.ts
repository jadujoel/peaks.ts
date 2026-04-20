import Konva from "konva/lib/Core";
import type { Layer } from "konva/lib/Layer";
import type { Stage } from "konva/lib/Stage";
import type { Segment } from "./segment";
import { SegmentShape } from "./segment-shape";
import type {
	PeaksInstance,
	SegmentClickEvent,
	SegmentUpdateOptions,
	WaveformViewAPI,
} from "./types";

import { objectHasProperty } from "./utils";

/**
 * Creates a Konva.Layer that displays segment markers against the audio
 * waveform.
 */

export interface SegmentsLayerFromOptions {
	readonly peaks: PeaksInstance;
	readonly view: WaveformViewAPI;
	readonly enableEditing: boolean;
}

export class SegmentsLayer {
	private readonly _peaks: PeaksInstance;
	private readonly _view: WaveformViewAPI;
	private _enableEditing: boolean;
	private _segmentShapes: Record<string, SegmentShape>;
	private readonly _layer: Layer;

	static from(options: SegmentsLayerFromOptions): SegmentsLayer {
		return new SegmentsLayer(
			options.peaks,
			options.view,
			options.enableEditing,
		);
	}

	private constructor(
		peaks: PeaksInstance,
		view: WaveformViewAPI,
		enableEditing: boolean,
	) {
		this._peaks = peaks;
		this._view = view;
		this._enableEditing = enableEditing;
		this._segmentShapes = {};
		this._layer = new Konva.Layer();

		this._onSegmentsUpdate = this._onSegmentsUpdate.bind(this);
		this._onSegmentsAdd = this._onSegmentsAdd.bind(this);
		this._onSegmentsRemove = this._onSegmentsRemove.bind(this);
		this._onSegmentsRemoveAll = this._onSegmentsRemoveAll.bind(this);
		this._onSegmentsDragged = this._onSegmentsDragged.bind(this);

		this._peaks.on("segments.update", this._onSegmentsUpdate);
		this._peaks.on("segments.add", this._onSegmentsAdd);
		this._peaks.on("segments.remove", this._onSegmentsRemove);
		this._peaks.on("segments.remove_all", this._onSegmentsRemoveAll);
		this._peaks.on("segments.dragged", this._onSegmentsDragged);
	}

	/**
	 * Adds the layer to the given Konva.Stage.
	 */

	addToStage(stage: Stage): void {
		stage.add(this._layer);
	}

	setListening(listening: boolean): void {
		this._layer.listening(listening);
	}

	enableEditing(enable: boolean): void {
		this._enableEditing = enable;
	}

	isEditingEnabled(): boolean {
		return this._enableEditing;
	}

	enableSegmentDragging(enable: boolean): void {
		for (const segmentPid in this._segmentShapes) {
			if (objectHasProperty(this._segmentShapes, segmentPid)) {
				this._segmentShapes[segmentPid]?.enableSegmentDragging(enable);
			}
		}
	}

	getSegmentShape(segment: Segment): SegmentShape | undefined {
		return this._segmentShapes[segment.pid];
	}

	formatTime(time: number): string {
		return this._view.formatTime(time);
	}

	private _onSegmentsUpdate(
		segment: Segment,
		options: SegmentUpdateOptions,
	): void {
		const frameStartTime = this._view.getStartTime();
		const frameEndTime = this._view.getEndTime();

		const segmentShape = this.getSegmentShape(segment);
		const isVisible = segment.isVisible(frameStartTime, frameEndTime);

		if (segmentShape && !isVisible) {
			// Remove segment shape that is no longer visible.

			if (!segmentShape.isDragging()) {
				this._removeSegment(segment);
			}
		} else if (!segmentShape && isVisible) {
			// Add segment shape for visible segment.
			this._updateSegment(segment);
		} else if (segmentShape && isVisible) {
			// Update the segment shape with the changed attributes.
			segmentShape.update(options);
		}
	}

	private _onSegmentsAdd(event: {
		segments: Segment[];
		insert: boolean;
	}): void {
		const frameStartTime = this._view.getStartTime();
		const frameEndTime = this._view.getEndTime();

		for (const segment of event.segments) {
			if (segment.isVisible(frameStartTime, frameEndTime)) {
				const segmentShape = this._addSegmentShape(segment);

				segmentShape.update();
			}
		}

		// Ensure segment markers are always draggable.
		this.moveSegmentMarkersToTop();
	}

	private _onSegmentsRemove(event: { segments: Segment[] }): void {
		for (const segment of event.segments) {
			this._removeSegment(segment);
		}
	}

	private _onSegmentsRemoveAll(): void {
		this._layer.removeChildren();
		this._segmentShapes = {};
	}

	private _onSegmentsDragged(event: { segment: Segment }): void {
		this._updateSegment(event.segment);
	}

	/**
	 * Creates the Konva UI objects for a given segment.
	 */

	private _createSegmentShape(segment: Segment): SegmentShape {
		return SegmentShape.from({
			segment,
			peaks: this._peaks,
			layer: this,
			view: this._view,
		});
	}

	/**
	 * Adds a Konva UI object to the layer for a given segment.
	 */

	private _addSegmentShape(segment: Segment): SegmentShape {
		const segmentShape = this._createSegmentShape(segment);

		segmentShape.addToLayer(this._layer);

		this._segmentShapes[segment.pid] = segmentShape;

		return segmentShape;
	}

	/**
	 * Updates the positions of all displayed segments in the view.
	 *
	 * @param startTime The start of the visible range in the view,
	 *   in seconds.
	 * @param endTime The end of the visible range in the view,
	 *   in seconds.
	 */

	updateSegments(startTime: number, endTime: number): void {
		// Update segments in visible time range.
		const segments = this._peaks.segments.find(startTime, endTime);

		for (const segment of segments) {
			this._updateSegment(segment);
		}

		// TODO: In the overview all segments are visible, so no need to do this.
		this._removeInvisibleSegments(startTime, endTime);
	}

	private _updateSegment(segment: Segment): void {
		let segmentShape = this.getSegmentShape(segment);

		if (!segmentShape) {
			segmentShape = this._addSegmentShape(segment);
		}

		segmentShape.update();
	}

	/**
	 * Removes any segments that are not visible, i.e., are not within and do not
	 * overlap the given time range.
	 *
	 * @param startTime The start of the visible time range, in seconds.
	 * @param endTime The end of the visible time range, in seconds.
	 */

	private _removeInvisibleSegments(startTime: number, endTime: number): void {
		for (const segmentPid in this._segmentShapes) {
			if (objectHasProperty(this._segmentShapes, segmentPid)) {
				const segment = this._segmentShapes[segmentPid]?.getSegment();

				if (segment && !segment.isVisible(startTime, endTime)) {
					this._removeSegment(segment);
				}
			}
		}
	}

	/**
	 * Removes the given segment from the view.
	 */

	private _removeSegment(segment: Segment): void {
		const segmentShape = this._segmentShapes[segment.pid];

		if (segmentShape) {
			segmentShape.destroy();
			delete this._segmentShapes[segment.pid];
		}
	}

	/**
	 * Moves all segment markers to the top of the z-order,
	 * so the user can always drag them.
	 */

	moveSegmentMarkersToTop(): void {
		for (const segmentPid in this._segmentShapes) {
			if (objectHasProperty(this._segmentShapes, segmentPid)) {
				this._segmentShapes[segmentPid]?.moveMarkersToTop();
			}
		}
	}

	/**
	 * Toggles visibility of the segments layer.
	 */

	setVisible(visible: boolean): void {
		this._layer.visible(visible);
	}

	segmentClicked(eventName: string, event: SegmentClickEvent): void {
		const segmentShape = this._segmentShapes[event.segment.pid];

		if (segmentShape) {
			segmentShape.segmentClicked(eventName, event);
		}
	}

	destroy(): void {
		this._peaks.off("segments.update", this._onSegmentsUpdate);
		this._peaks.off("segments.add", this._onSegmentsAdd);
		this._peaks.off("segments.remove", this._onSegmentsRemove);
		this._peaks.off("segments.remove_all", this._onSegmentsRemoveAll);
		this._peaks.off("segments.dragged", this._onSegmentsDragged);
	}

	fitToView(): void {
		for (const segmentPid in this._segmentShapes) {
			if (objectHasProperty(this._segmentShapes, segmentPid)) {
				const segmentShape = this._segmentShapes[segmentPid];

				if (segmentShape) {
					segmentShape.fitToView();
				}
			}
		}
	}

	draw(): void {
		this._layer.draw();
	}

	getHeight(): number {
		return this._layer.getHeight() ?? 0;
	}
}
