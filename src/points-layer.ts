import type {
	DriverLayer,
	DriverStage,
	PeaksPointerEvent,
} from "./driver/types";
import type { EventFor, PeaksEventMap } from "./events";
import type { Point } from "./point";
import { PointMarker } from "./point-marker";
import type { PeaksInstance, WaveformViewAPI, XY } from "./types";
import { clamp, objectHasProperty } from "./utils";

/**
 * Creates a layer that displays point markers against the audio
 * waveform.
 */
export interface PointsLayerFromOptions {
	readonly peaks: PeaksInstance;
	readonly view: WaveformViewAPI;
	readonly enableEditing: boolean;
}

export class PointsLayer {
	private constructor(
		private readonly peaks: PeaksInstance,
		private readonly view: WaveformViewAPI,
		private editingEnabled: boolean,
		private readonly layer: DriverLayer,
		private readonly markers: Map<number, PointMarker>,
		private dragPointMarker: PointMarker | undefined,
	) {}

	static from(options: PointsLayerFromOptions): PointsLayer {
		const layers = new PointsLayer(
			options.peaks,
			options.view,
			options.enableEditing ?? false,
			options.view.getDriver().createLayer(),
			new Map<number, PointMarker>(),
			undefined,
		);
		layers.peaks.events.addEventListener(
			"points.update",
			layers.onPointsUpdate,
		);
		layers.peaks.events.addEventListener("points.add", layers.onPointsAdd);
		layers.peaks.events.addEventListener(
			"points.remove",
			layers.onPointsRemove,
		);
		layers.peaks.events.addEventListener(
			"points.remove_all",
			layers.onPointsRemoveAll,
		);
		layers.peaks.events.addEventListener(
			"points.dragstart",
			layers.onPointsDrag,
		);
		layers.peaks.events.addEventListener(
			"points.dragmove",
			layers.onPointsDrag,
		);
		layers.peaks.events.addEventListener("points.dragend", layers.onPointsDrag);
		return layers;
	}

	enableEditing(enable: boolean): void {
		this.editingEnabled = enable;
	}

	isEditingEnabled(): boolean {
		return this.editingEnabled;
	}

	addToStage(stage: DriverStage): void {
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

	getDriver() {
		return this.peaks.options.driver;
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
		this.peaks.events.removeEventListener("points.update", this.onPointsUpdate);
		this.peaks.events.removeEventListener("points.add", this.onPointsAdd);
		this.peaks.events.removeEventListener("points.remove", this.onPointsRemove);
		this.peaks.events.removeEventListener(
			"points.remove_all",
			this.onPointsRemoveAll,
		);
		this.peaks.events.removeEventListener(
			"points.dragstart",
			this.onPointsDrag,
		);
		this.peaks.events.removeEventListener("points.dragmove", this.onPointsDrag);
		this.peaks.events.removeEventListener("points.dragend", this.onPointsDrag);
	}

	private onPointsUpdate = (
		event: EventFor<PeaksEventMap, "points.update">,
	): void => {
		const { point, options } = event;
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

	private onPointsAdd = (
		event: EventFor<PeaksEventMap, "points.add">,
	): void => {
		const frameStartTime = this.view.getStartTime();
		const frameEndTime = this.view.getEndTime();

		for (const point of event.points) {
			if (point.isVisible(frameStartTime, frameEndTime)) {
				this.updatePoint(point);
			}
		}
	};

	private onPointsRemove = (
		event: EventFor<PeaksEventMap, "points.remove">,
	): void => {
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
		const editable = this.editingEnabled && point.editable;
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
			driver: this.peaks.options.driver,
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
		pointMarker.addToLayer(this.layer as unknown as DriverLayer);
		return pointMarker;
	}

	private onPointsDrag = (
		event:
			| EventFor<PeaksEventMap, "points.dragstart">
			| EventFor<PeaksEventMap, "points.dragmove">
			| EventFor<PeaksEventMap, "points.dragend">,
	): void => {
		const pointMarker = this.updatePoint(event.point);
		pointMarker.update({ time: event.point.time });
	};

	private onPointMarkerMouseEnter = (
		event: PeaksPointerEvent<MouseEvent>,
		point: Point,
	): void => {
		this.peaks.events.dispatch("points.mouseenter", {
			evt: event.evt,
			point: point,
		});
	};

	private onPointMarkerMouseLeave = (
		event: PeaksPointerEvent<MouseEvent>,
		point: Point,
	): void => {
		this.peaks.events.dispatch("points.mouseleave", {
			evt: event.evt,
			point: point,
		});
	};

	private onPointMarkerDragStart = (
		event: PeaksPointerEvent<MouseEvent>,
		point: Point,
	): void => {
		this.dragPointMarker = this.getPointMarker(point);

		this.peaks.events.dispatch("points.dragstart", {
			evt: event.evt,
			point: point,
		});
	};

	private onPointMarkerDragMove = (
		event: PeaksPointerEvent<MouseEvent>,
		point: Point,
	): void => {
		const marker = this.markers.get(point.pid);
		if (marker === undefined) {
			return;
		}

		const x = marker.getX();
		const offset = x + marker.getWidth();
		point.setTime(this.view.pixelOffsetToTime(offset));

		this.peaks.events.dispatch("points.dragmove", {
			evt: event.evt,
			point: point,
		});
	};

	private onPointMarkerDragEnd = (
		event: PeaksPointerEvent<MouseEvent>,
		point: Point,
	): void => {
		this.dragPointMarker = undefined;

		this.peaks.events.dispatch("points.dragend", {
			evt: event.evt,
			point: point,
		});
	};

	private pointMarkerDragBoundFunc = (pos: XY): XY => {
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
