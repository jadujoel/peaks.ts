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
	private constructor(
		private readonly peaks: PeaksInstance,
		private readonly view: WaveformViewAPI,
		private readonly layer: Layer,
		private readonly segmentShapes: Map<number, SegmentShape>,
		private editingEnabled: boolean,
	) {}

	static from(options: SegmentsLayerFromOptions): SegmentsLayer {
		const instance = new SegmentsLayer(
			options.peaks,
			options.view,
			new Konva.Layer(),
			new Map<number, SegmentShape>(),
			options.enableEditing,
		);
		instance.peaks.on("segments.update", instance.onSegmentsUpdate);
		instance.peaks.on("segments.add", instance.onSegmentsAdd);
		instance.peaks.on("segments.remove", instance.onSegmentsRemove);
		instance.peaks.on("segments.remove_all", instance.onSegmentsRemoveAll);
		instance.peaks.on("segments.dragged", instance.onSegmentsDragged);
		return instance;
	}

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

	/**
	 * Updates the positions of all displayed segments in the view.
	 */

	updateSegments(startTime: number, endTime: number): void {
		const segments = this.peaks.segments.find(startTime, endTime);

		for (const segment of segments) {
			this.updateSegment(segment);
		}

		this.removeInvisibleSegments(startTime, endTime);
	}

	moveSegmentMarkersToTop(): void {
		for (const [, segmentShape] of this.segmentShapes) {
			segmentShape.moveMarkersToTop();
		}
	}

	setVisible(visible: boolean): void {
		this.layer.visible(visible);
	}

	segmentClicked(eventName: string, event: SegmentClickEvent): void {
		const segmentShape = this.segmentShapes.get(event.segment.pid);

		if (segmentShape) {
			segmentShape.segmentClicked(eventName, event);
		}
	}

	dispose(): void {
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

	private onSegmentsUpdate = (
		segment: Segment,
		options: SegmentUpdateOptions,
	): void => {
		const frameStartTime = this.view.getStartTime();
		const frameEndTime = this.view.getEndTime();

		const segmentShape = this.getSegmentShape(segment);
		const isVisible = segment.isVisible(frameStartTime, frameEndTime);

		if (segmentShape && !isVisible) {
			if (!segmentShape.isDragging()) {
				this.removeSegment(segment);
			}
		} else if (!segmentShape && isVisible) {
			this.updateSegment(segment);
		} else if (segmentShape && isVisible) {
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

	private createSegmentShape(segment: Segment): SegmentShape {
		return SegmentShape.from({
			layer: this,
			peaks: this.peaks,
			segment,
			view: this.view,
		});
	}

	private addSegmentShape(segment: Segment): SegmentShape {
		const segmentShape = this.createSegmentShape(segment);

		segmentShape.addToLayer(this.layer);

		this.segmentShapes.set(segment.pid, segmentShape);

		return segmentShape;
	}

	private updateSegment(segment: Segment): void {
		let segmentShape = this.getSegmentShape(segment);

		if (!segmentShape) {
			segmentShape = this.addSegmentShape(segment);
		}

		segmentShape.update();
	}

	private removeInvisibleSegments(startTime: number, endTime: number): void {
		for (const [, segmentShape] of this.segmentShapes) {
			const segment = segmentShape.getSegment();

			if (segment && !segment.isVisible(startTime, endTime)) {
				this.removeSegment(segment);
			}
		}
	}

	private removeSegment(segment: Segment): void {
		const segmentShape = this.segmentShapes.get(segment.pid);

		if (segmentShape) {
			segmentShape.destroy();
			this.segmentShapes.delete(segment.pid);
		}
	}
}
