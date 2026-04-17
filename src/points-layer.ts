import Konva from "konva/lib/Core";
import type { Layer } from "konva/lib/Layer";
import type { Stage } from "konva/lib/Stage";
import type { Point } from "./point";
import PointMarker from "./point-marker";
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
class PointsLayer {
	private _peaks: PeaksInstance;
	private _view: WaveformViewAPI;
	private _enableEditing: boolean;
	private _pointMarkers: Record<string, PointMarker>;
	private _layer: Layer;
	private _dragPointMarker: PointMarker | null;

	constructor(
		peaks: PeaksInstance,
		view: WaveformViewAPI,
		enableEditing: boolean,
	) {
		this._peaks = peaks;
		this._view = view;
		this._enableEditing = enableEditing;
		this._pointMarkers = {};
		this._layer = new Konva.Layer();
		this._dragPointMarker = null;

		this._onPointsDrag = this._onPointsDrag.bind(this);

		this._onPointMarkerDragStart = this._onPointMarkerDragStart.bind(this);
		this._onPointMarkerDragMove = this._onPointMarkerDragMove.bind(this);
		this._onPointMarkerDragEnd = this._onPointMarkerDragEnd.bind(this);
		this._pointMarkerDragBoundFunc = this._pointMarkerDragBoundFunc.bind(this);
		this._onPointMarkerMouseEnter = this._onPointMarkerMouseEnter.bind(this);
		this._onPointMarkerMouseLeave = this._onPointMarkerMouseLeave.bind(this);

		this._onPointsUpdate = this._onPointsUpdate.bind(this);
		this._onPointsAdd = this._onPointsAdd.bind(this);
		this._onPointsRemove = this._onPointsRemove.bind(this);
		this._onPointsRemoveAll = this._onPointsRemoveAll.bind(this);

		this._peaks.on("points.update", this._onPointsUpdate);
		this._peaks.on("points.add", this._onPointsAdd);
		this._peaks.on("points.remove", this._onPointsRemove);
		this._peaks.on("points.remove_all", this._onPointsRemoveAll);

		this._peaks.on("points.dragstart", this._onPointsDrag);
		this._peaks.on("points.dragmove", this._onPointsDrag);
		this._peaks.on("points.dragend", this._onPointsDrag);
	}

	addToStage(stage: Stage): void {
		stage.add(this._layer);
	}

	setListening(listening: boolean): void {
		this._layer.listening(listening);
	}

	enableEditing(enable: boolean): void {
		this._enableEditing = enable;
	}

	getPointMarker(point: Point): PointMarker | undefined {
		return this._pointMarkers[point.pid];
	}

	formatTime(time: number): string {
		return this._view.formatTime(time);
	}

	private _onPointsUpdate(point: Point, options: PointUpdateOptions): void {
		const frameStartTime = this._view.getStartTime();
		const frameEndTime = this._view.getEndTime();

		const pointMarker = this.getPointMarker(point);
		const isVisible = point.isVisible(frameStartTime, frameEndTime);

		if (pointMarker && !isVisible) {
			// Remove point marker that is no longer visible.
			this._removePoint(point);
		} else if (!pointMarker && isVisible) {
			// Add point marker for visible point.
			this._updatePoint(point);
		} else if (pointMarker && isVisible) {
			// Update the point marker with the changed attributes.
			if (objectHasProperty(options, "time")) {
				const pointMarkerOffset = this._view.timeToPixels(point.time);

				const pointMarkerX = pointMarkerOffset - this._view.getFrameOffset();

				pointMarker.setX(pointMarkerX);
			}

			pointMarker.update(options);
		}
	}

	private _onPointsAdd(event: { points: Point[] }): void {
		const frameStartTime = this._view.getStartTime();
		const frameEndTime = this._view.getEndTime();

		event.points.forEach((point: Point) => {
			if (point.isVisible(frameStartTime, frameEndTime)) {
				this._updatePoint(point);
			}
		});
	}

	private _onPointsRemove(event: { points: Point[] }): void {
		event.points.forEach((point: Point) => {
			this._removePoint(point);
		});
	}

	private _onPointsRemoveAll(): void {
		this._layer.removeChildren();
		this._pointMarkers = {};
	}

	/**
	 * Creates the Konva UI objects for a given point.
	 */
	private _createPointMarker(point: Point): PointMarker {
		const editable = this._enableEditing && point.editable;
		const viewOptions = this._view.getViewOptions();

		const marker = this._peaks.options.createPointMarker({
			point: point,
			editable: editable,
			color: point.color,
			fontFamily: viewOptions.fontFamily,
			fontSize: viewOptions.fontSize,
			fontStyle: viewOptions.fontStyle,
			layer: this,
			view: this._view.getName(),
		});

		return new PointMarker({
			point: point,
			draggable: editable,
			marker: marker,
			onDragStart: this._onPointMarkerDragStart,
			onDragMove: this._onPointMarkerDragMove,
			onDragEnd: this._onPointMarkerDragEnd,
			dragBoundFunc: this._pointMarkerDragBoundFunc,
			onMouseEnter: this._onPointMarkerMouseEnter,
			onMouseLeave: this._onPointMarkerMouseLeave,
		});
	}

	getHeight(): number {
		return this._view.getHeight();
	}

	/**
	 * Adds a Konva UI object to the layer for a given point.
	 */
	private _addPointMarker(point: Point): PointMarker {
		const pointMarker = this._createPointMarker(point);

		this._pointMarkers[point.pid] = pointMarker;

		pointMarker.addToLayer(this._layer);

		return pointMarker;
	}

	private _onPointsDrag(event: { point: Point }): void {
		const pointMarker = this._updatePoint(event.point);

		pointMarker.update({ time: event.point.time });
	}

	private _onPointMarkerMouseEnter(event: KonvaMouseEvent, point: Point): void {
		this._peaks.emit("points.mouseenter", {
			point: point,
			evt: event.evt,
		});
	}

	private _onPointMarkerMouseLeave(event: KonvaMouseEvent, point: Point): void {
		this._peaks.emit("points.mouseleave", {
			point: point,
			evt: event.evt,
		});
	}

	private _onPointMarkerDragStart(event: KonvaMouseEvent, point: Point): void {
		this._dragPointMarker = this.getPointMarker(point) ?? null;

		this._peaks.emit("points.dragstart", {
			point: point,
			evt: event.evt,
		});
	}

	private _onPointMarkerDragMove(event: KonvaMouseEvent, point: Point): void {
		const pointMarker = this._pointMarkers[point.pid];

		if (!pointMarker) {
			return;
		}

		const markerX = pointMarker.getX();

		const offset = markerX + pointMarker.getWidth();

		point._setTime(this._view.pixelOffsetToTime(offset));

		this._peaks.emit("points.dragmove", {
			point: point,
			evt: event.evt,
		});
	}

	private _onPointMarkerDragEnd(event: KonvaMouseEvent, point: Point): void {
		this._dragPointMarker = null;

		this._peaks.emit("points.dragend", {
			point: point,
			evt: event.evt,
		});
	}

	private _pointMarkerDragBoundFunc(pos: { x: number; y: number }): {
		x: number;
		y: number;
	} {
		// Allow the marker to be moved horizontally but not vertically.
		return {
			x: clamp(pos.x, 0, this._view.getWidth()),
			y: this._dragPointMarker?.getAbsolutePosition().y ?? 0,
		};
	}

	/**
	 * Updates the positions of all displayed points in the view.
	 *
	 * @param startTime The start of the visible range in the view, in seconds.
	 * @param endTime The end of the visible range in the view, in seconds.
	 */
	updatePoints(startTime: number, endTime: number): void {
		// Update all points in the visible time range.
		const points = this._peaks.points.find(startTime, endTime);

		points.forEach(this._updatePoint.bind(this));

		// TODO: In the overview all points are visible, so no need to do this.
		this._removeInvisiblePoints(startTime, endTime);
	}

	private _updatePoint(point: Point): PointMarker {
		let pointMarker = this.getPointMarker(point);

		if (!pointMarker) {
			pointMarker = this._addPointMarker(point);
		}

		const pointMarkerOffset = this._view.timeToPixels(point.time);
		const pointMarkerX = pointMarkerOffset - this._view.getFrameOffset();

		pointMarker.setX(pointMarkerX);

		return pointMarker;
	}

	/**
	 * Remove any points that are not visible, i.e., are outside the given time
	 * range.
	 */
	private _removeInvisiblePoints(startTime: number, endTime: number): void {
		for (const pointPid in this._pointMarkers) {
			if (objectHasProperty(this._pointMarkers, pointPid)) {
				const point = this._pointMarkers[pointPid]?.getPoint();

				if (point && !point.isVisible(startTime, endTime)) {
					this._removePoint(point);
				}
			}
		}
	}

	/**
	 * Removes the UI object for a given point.
	 */
	private _removePoint(point: Point): void {
		const pointMarker = this.getPointMarker(point);

		if (pointMarker) {
			pointMarker.destroy();
			delete this._pointMarkers[point.pid];
		}
	}

	setVisible(visible: boolean): void {
		this._layer.visible(visible);
	}

	destroy(): void {
		this._peaks.off("points.update", this._onPointsUpdate);
		this._peaks.off("points.add", this._onPointsAdd);
		this._peaks.off("points.remove", this._onPointsRemove);
		this._peaks.off("points.remove_all", this._onPointsRemoveAll);
		this._peaks.off("points.dragstart", this._onPointsDrag);
		this._peaks.off("points.dragmove", this._onPointsDrag);
		this._peaks.off("points.dragend", this._onPointsDrag);
	}

	fitToView(): void {
		for (const pointPid in this._pointMarkers) {
			if (objectHasProperty(this._pointMarkers, pointPid)) {
				const pointMarker = this._pointMarkers[pointPid];

				if (pointMarker) {
					pointMarker.fitToView();
				}
			}
		}
	}

	draw(): void {
		this._layer.draw();
	}
}

export default PointsLayer;
