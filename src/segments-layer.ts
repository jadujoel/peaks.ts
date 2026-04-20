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
	private readonly peaks: PeaksInstance;
	private readonly view: WaveformViewAPI;
	private editingEnabled: boolean;
	private segmentShapes = new Map<number, SegmentShape>();
	private readonly layer: Layer;

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
		this.peaks = peaks;
		this.view = view;
		this.editingEnabled = enableEditing;
		this.layer = new Konva.Layer();

		this.peaks.on("segments.update", this.onSegmentsUpdate);
		this.peaks.on("segments.add", this.onSegmentsAdd);
		this.peaks.on("segments.remove", this.onSegmentsRemove);
		this.peaks.on("segments.remove_all", this.onSegmentsRemoveAll);
		this.peaks.on("segments.dragged", this.onSegmentsDragged);
	}

	/**
	 * Adds the layer to the given Konva.Stage.
	 */

	addToStage(stage: Stage): void {
		stage.add(this.layer);
	}

	setListening(listening: boolean): void {
		this.layer.listening(listening);
	}

	enableEditing(enable: boolean): void {
		this.editingEnabled = enable;
	}

	isEditingEnabled(): boolean {
		return this.editingEnabled;
	}

	enableSegmentDragging(enable: boolean): void {
		for (const [, segmentShape] of this.segmentShapes) {
			segmentShape.enableSegmentDragging(enable);
		}
	}

	getSegmentShape(segment: Segment): SegmentShape | undefined {
		return this.segmentShapes.get(segment.pid);
	}

	formatTime(time: number): string {
		return this.view.formatTime(time);
	}

	private onSegmentsUpdate = (
		segment: Segment,
		options: SegmentUpdateOptions,
	): void => {
		const frameStartTime = this.view.getStartTime();
		const frameEndTime = this.view.getEndTime();

		const segmentShape = this.getSegmentShape(segment);
		const isVisible = segment.isVisible(frameStartTime, frameEndTime);

		if (segmentShape && !isVisible) {
			// Remove segment shape that is no longer visible.

			if (!segmentShape.isDragging()) {
				this.removeSegment(segment);
			}
		} else if (!segmentShape && isVisible) {
			// Add segment shape for visible segment.
			this.updateSegment(segment);
		} else if (segmentShape && isVisible) {
			// Update the segment shape with the changed attributes.
			segmentShape.update(options as unknown as Record<string, unknown>);
		}
	};

	private onSegmentsAdd = (event: {
		segments: Segment[];
		insert: boolean;
	}): void => {
		const frameStartTime = this.view.getStartTime();
		const frameEndTime = this.view.getEndTime();

		for (const segment of event.segments) {
			if (segment.isVisible(frameStartTime, frameEndTime)) {
				const segmentShape = this.addSegmentShape(segment);

				segmentShape.update();
			}
		}

		// Ensure segment markers are always draggable.
		this.moveSegmentMarkersToTop();
	};

	private onSegmentsRemove = (event: { segments: Segment[] }): void => {
		for (const segment of event.segments) {
			this.removeSegment(segment);
		}
	};

	private onSegmentsRemoveAll = (): void => {
		this.layer.removeChildren();
		this.segmentShapes.clear();
	};

	private onSegmentsDragged = (event: { segment: Segment }): void => {
		this.updateSegment(event.segment);
	};

	/**
	 * Creates the Konva UI objects for a given segment.
	 */

	private createSegmentShape(segment: Segment): SegmentShape {
		return SegmentShape.from({
			layer: this,
			peaks: this.peaks,
			segment,
			view: this.view,
		});
	}

	/**
	 * Adds a Konva UI object to the layer for a given segment.
	 */

	private addSegmentShape(segment: Segment): SegmentShape {
		const segmentShape = this.createSegmentShape(segment);

		segmentShape.addToLayer(this.layer);

		this.segmentShapes.set(segment.pid, segmentShape);

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
		const segments = this.peaks.segments.find(startTime, endTime);

		for (const segment of segments) {
			this.updateSegment(segment);
		}

		// TODO: In the overview all segments are visible, so no need to do this.
		this.removeInvisibleSegments(startTime, endTime);
	}

	private updateSegment(segment: Segment): void {
		let segmentShape = this.getSegmentShape(segment);

		if (!segmentShape) {
			segmentShape = this.addSegmentShape(segment);
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

	private removeInvisibleSegments(startTime: number, endTime: number): void {
		for (const [, segmentShape] of this.segmentShapes) {
			const segment = segmentShape.getSegment();

			if (segment && !segment.isVisible(startTime, endTime)) {
				this.removeSegment(segment);
			}
		}
	}

	/**
	 * Removes the given segment from the view.
	 */

	private removeSegment(segment: Segment): void {
		const segmentShape = this.segmentShapes.get(segment.pid);

		if (segmentShape) {
			segmentShape.destroy();
			this.segmentShapes.delete(segment.pid);
		}
	}

	/**
	 * Moves all segment markers to the top of the z-order,
	 * so the user can always drag them.
	 */

	moveSegmentMarkersToTop(): void {
		for (const [, segmentShape] of this.segmentShapes) {
			segmentShape.moveMarkersToTop();
		}
	}

	/**
	 * Toggles visibility of the segments layer.
	 */

	setVisible(visible: boolean): void {
		this.layer.visible(visible);
	}

	segmentClicked(eventName: string, event: SegmentClickEvent): void {
		const segmentShape = this.segmentShapes.get(event.segment.pid);

		if (segmentShape) {
			segmentShape.segmentClicked(eventName, event);
		}
	}

	destroy(): void {
		this.peaks.off("segments.update", this.onSegmentsUpdate);
		this.peaks.off("segments.add", this.onSegmentsAdd);
		this.peaks.off("segments.remove", this.onSegmentsRemove);
		this.peaks.off("segments.remove_all", this.onSegmentsRemoveAll);
		this.peaks.off("segments.dragged", this.onSegmentsDragged);
	}

	fitToView(): void {
		for (const [, segmentShape] of this.segmentShapes) {
			segmentShape.fitToView();
		}
	}

	draw(): void {
		this.layer.draw();
	}

	getHeight(): number {
		return this.layer.getHeight() ?? 0;
	}
}
