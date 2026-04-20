import Konva from "konva/lib/Core";
import type { Layer } from "konva/lib/Layer";
import type { Stage } from "konva/lib/Stage";
import type { Point } from "./point";
import { PointMarker } from "./point-marker";
import type {
	KonvaMouseEvent,
	PeaksInstance,
	PointUpdateOptions,
	WaveformViewAPI,
} from "./types";
import { clamp, objectHasProperty } from "./utils";

/**
 * Creates a Konva.Layer that displays point markers against the audio
 * waveform.
 */
export interface PointsLayerFromOptions {
	readonly peaks: PeaksInstance;
	readonly view: WaveformViewAPI;
	readonly enableEditing: boolean;
}

export class PointsLayer {
	private constructor(
		public readonly peaks: PeaksInstance,
		public readonly view: WaveformViewAPI,
		public enableEditing: boolean,
		private readonly layer: Layer,
		private readonly markers: Map<number, PointMarker>,
		private dragPointMarker: PointMarker | undefined,
	) {}
	static from(options: PointsLayerFromOptions): PointsLayer {
		const layers = new PointsLayer(
			options.peaks,
			options.view,
			options.enableEditing ?? false,
			new Konva.Layer(),
			new Map<number, PointMarker>(),
			undefined,
		);
		layers.peaks.on("points.update", layers.onPointsUpdate);
		layers.peaks.on("points.add", layers.onPointsAdd);
		layers.peaks.on("points.remove", layers.onPointsRemove);
		layers.peaks.on("points.remove_all", layers.onPointsRemoveAll);
		layers.peaks.on("points.dragstart", layers.onPointsDrag);
		layers.peaks.on("points.dragmove", layers.onPointsDrag);
		layers.peaks.on("points.dragend", layers.onPointsDrag);
		return layers;
	}

	addToStage(stage: Stage): void {
		stage.add(this.layer);
	}

	setListening(listening: boolean): void {
		this.layer.listening(listening);
	}

	getPointMarker(point: Point): PointMarker | undefined {
		return this.markers.get(point.pid);
	}

	formatTime(time: number): string {
		return this.view.formatTime(time);
	}

	getHeight(): number {
		return this.view.getHeight();
	}

	setVisible(visible: boolean): void {
		this.layer.visible(visible);
	}

	fitToView(): void {
		for (const [, pointMarker] of this.markers) {
			pointMarker.fitToView();
		}
	}

	draw(): void {
		this.layer.draw();
	}

	dispose(): void {
		this.peaks.off("points.update", this.onPointsUpdate);
		this.peaks.off("points.add", this.onPointsAdd);
		this.peaks.off("points.remove", this.onPointsRemove);
		this.peaks.off("points.remove_all", this.onPointsRemoveAll);
		this.peaks.off("points.dragstart", this.onPointsDrag);
		this.peaks.off("points.dragmove", this.onPointsDrag);
		this.peaks.off("points.dragend", this.onPointsDrag);
	}

	private onPointsUpdate = (
		point: Point,
		options: PointUpdateOptions,
	): void => {
		const frameStartTime = this.view.getStartTime();
		const frameEndTime = this.view.getEndTime();

		const pointMarker = this.getPointMarker(point);
		const isVisible = point.isVisible(frameStartTime, frameEndTime);

		if (pointMarker && !isVisible) {
			// Remove point marker that is no longer visible.
			this.removePoint(point);
		} else if (!pointMarker && isVisible) {
			// Add point marker for visible point.
			this.updatePoint(point);
		} else if (pointMarker && isVisible) {
			// Update the point marker with the changed attributes.
			if (objectHasProperty(options, "time")) {
				const pointMarkerOffset = this.view.timeToPixels(point.time);

				const pointMarkerX = pointMarkerOffset - this.view.getFrameOffset();

				pointMarker.setX(pointMarkerX);
			}

			pointMarker.update(options);
		}
	};

	private onPointsAdd = (event: { points: Point[] }): void => {
		const frameStartTime = this.view.getStartTime();
		const frameEndTime = this.view.getEndTime();

		for (const point of event.points) {
			if (point.isVisible(frameStartTime, frameEndTime)) {
				this.updatePoint(point);
			}
		}
	};

	private onPointsRemove = (event: { points: Point[] }): void => {
		for (const point of event.points) {
			this.removePoint(point);
		}
	};

	private onPointsRemoveAll = (): void => {
		this.layer.removeChildren();
		this.markers.clear();
	};

	/**
	 * Creates the Konva UI objects for a given point.
	 */
	private createPointMarker(point: Point): PointMarker {
		const editable = this.enableEditing && point.editable;
		const viewOptions = this.view.getViewOptions();

		const marker = this.peaks.options.createPointMarker({
			color: point.color ?? "#000",
			editable: editable,
			fontFamily: viewOptions.fontFamily ?? "",
			fontSize: viewOptions.fontSize ?? 0,
			fontStyle: viewOptions.fontStyle ?? "",
			layer: this,
			point: point,
			view: this.view.getName(),
		});

		if (marker === undefined) {
			throw new Error("Failed To Create Marker");
		}

		return PointMarker.from({
			options: {
				dragBoundFunc: this.pointMarkerDragBoundFunc,
				draggable: editable,
				marker: marker,
				onDragEnd: this.onPointMarkerDragEnd,
				onDragMove: this.onPointMarkerDragMove,
				onDragStart: this.onPointMarkerDragStart,
				onMouseEnter: this.onPointMarkerMouseEnter,
				onMouseLeave: this.onPointMarkerMouseLeave,
				point: point,
			},
		});
	}

	/**
	 * Adds a Konva UI object to the layer for a given point.
	 */
	private addPointMarker(point: Point): PointMarker {
		const pointMarker = this.createPointMarker(point);
		this.markers.set(point.pid, pointMarker);
		pointMarker.addToLayer(this.layer);
		return pointMarker;
	}

	private onPointsDrag = (_event: KonvaMouseEvent, point: Point): void => {
		const pointMarker = this.updatePoint(point);
		pointMarker.update({ time: point.time });
	};

	private onPointMarkerMouseEnter = (
		event: KonvaMouseEvent,
		point: Point,
	): void => {
		this.peaks.emit("points.mouseenter", {
			evt: event.evt,
			point: point,
		});
	};

	private onPointMarkerMouseLeave = (
		event: KonvaMouseEvent,
		point: Point,
	): void => {
		this.peaks.emit("points.mouseleave", {
			evt: event.evt,
			point: point,
		});
	};

	private onPointMarkerDragStart = (
		event: KonvaMouseEvent,
		point: Point,
	): void => {
		this.dragPointMarker = this.getPointMarker(point);

		this.peaks.emit("points.dragstart", {
			evt: event.evt,
			point: point,
		});
	};

	private onPointMarkerDragMove = (
		event: KonvaMouseEvent,
		point: Point,
	): void => {
		const marker = this.markers.get(point.pid);
		if (marker === undefined) {
			return;
		}

		const x = marker.getX();
		const offset = x + marker.getWidth();
		point.setTime(this.view.pixelOffsetToTime(offset));

		this.peaks.emit("points.dragmove", {
			evt: event.evt,
			point: point,
		});
	};

	private onPointMarkerDragEnd = (
		event: KonvaMouseEvent,
		point: Point,
	): void => {
		this.dragPointMarker = undefined;

		this.peaks.emit("points.dragend", {
			evt: event.evt,
			point: point,
		});
	};

	private pointMarkerDragBoundFunc = (pos: {
		x: number;
		y: number;
	}): {
		x: number;
		y: number;
	} => {
		// Allow the marker to be moved horizontally but not vertically.
		return {
			x: clamp(pos.x, 0, this.view.getWidth()),
			y: this.dragPointMarker?.getAbsolutePosition().y ?? 0,
		};
	};

	/**
	 * Updates the positions of all displayed points in the view.
	 *
	 * @param startTime The start of the visible range in the view, in seconds.
	 * @param endTime The end of the visible range in the view, in seconds.
	 */
	updatePoints(startTime: number, endTime: number): void {
		// Update all points in the visible time range.
		const points = this.peaks.points.find(startTime, endTime);

		for (const point of points) {
			this.updatePoint(point);
		}

		// TODO: In the overview all points are visible, so no need to do this.
		this.removeInvisiblePoints(startTime, endTime);
	}

	private updatePoint(point: Point): PointMarker {
		let pointMarker = this.getPointMarker(point);

		if (!pointMarker) {
			pointMarker = this.addPointMarker(point);
		}

		const pointMarkerOffset = this.view.timeToPixels(point.time);
		const pointMarkerX = pointMarkerOffset - this.view.getFrameOffset();

		pointMarker.setX(pointMarkerX);

		return pointMarker;
	}

	/**
	 * Remove any points that are not visible, i.e., are outside the given time
	 * range.
	 */
	private removeInvisiblePoints(startTime: number, endTime: number): void {
		for (const markers of this.markers.values()) {
			const point = markers.getPoint();
			if (point && !point.isVisible(startTime, endTime)) {
				this.removePoint(point);
			}
		}
	}

	/**
	 * Removes the UI object for a given point.
	 */
	private removePoint(point: Point): void {
		const pointMarker = this.getPointMarker(point);

		if (pointMarker) {
			pointMarker.dispose();
			this.markers.delete(point.pid);
		}
	}
}
