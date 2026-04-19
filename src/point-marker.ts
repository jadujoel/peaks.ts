import Konva from "konva/lib/Core";
import type { Group } from "konva/lib/Group";
import type { Layer } from "konva/lib/Layer";
import type { KonvaEventObject } from "konva/lib/Node";
import type { Point } from "./point";
import type { KonvaMouseEvent, Marker, PointMarkerOptions } from "./types";

export interface PointMarkerFromOptions {
	readonly options: PointMarkerOptions;
}

export class PointMarker {
	private _point: Point;
	private _marker: Marker;
	private _draggable: boolean;
	private _onDragStart: (event: KonvaMouseEvent, point: Point) => void;
	private _onDragMove: (event: KonvaMouseEvent, point: Point) => void;
	private _onDragEnd: (event: KonvaMouseEvent, point: Point) => void;
	private _onMouseEnter: (event: KonvaMouseEvent, point: Point) => void;
	private _onMouseLeave: (event: KonvaMouseEvent, point: Point) => void;
	private _group: Group;

	static from(options: PointMarkerFromOptions): PointMarker {
		return new PointMarker(options.options);
	}

	private constructor(options: PointMarkerOptions) {
		this._point = options.point;
		this._marker = options.marker;
		this._draggable = options.draggable;

		this._onDragStart = options.onDragStart;
		this._onDragMove = options.onDragMove;
		this._onDragEnd = options.onDragEnd;
		this._onMouseEnter = options.onMouseEnter;
		this._onMouseLeave = options.onMouseLeave;

		this._group = new Konva.Group({
			name: "point-marker",
			point: this._point,
			draggable: this._draggable,
			dragBoundFunc: options.dragBoundFunc,
		});

		this._bindDefaultEventHandlers();

		this._marker.init(this._group);
	}

	private _bindDefaultEventHandlers(): void {
		this._group.on("dragstart", (event: KonvaEventObject<MouseEvent>) => {
			this._onDragStart(event, this._point);
		});

		this._group.on("dragmove", (event: KonvaEventObject<MouseEvent>) => {
			this._onDragMove(event, this._point);
		});

		this._group.on("dragend", (event: KonvaEventObject<MouseEvent>) => {
			this._onDragEnd(event, this._point);
		});

		this._group.on("mouseenter", (event: KonvaEventObject<MouseEvent>) => {
			this._onMouseEnter(event, this._point);
		});

		this._group.on("mouseleave", (event: KonvaEventObject<MouseEvent>) => {
			this._onMouseLeave(event, this._point);
		});
	}

	addToLayer(layer: Layer): void {
		layer.add(this._group);
	}

	fitToView(): void {
		this._marker.fitToView();
	}

	getPoint(): Point {
		return this._point;
	}

	getX(): number {
		return this._group.x();
	}

	setX(x: number): void {
		this._group.x(x);
	}

	getWidth(): number {
		return this._group.width();
	}

	getAbsolutePosition(): { x: number; y: number } {
		return this._group.getAbsolutePosition();
	}

	update(options: Record<string, unknown>): void {
		if (options.editable !== undefined) {
			this._group.draggable(options.editable as boolean);
		}

		if (this._marker.update) {
			this._marker.update(options);
		}
	}

	destroy(): void {
		if (this._marker.destroy) {
			this._marker.destroy();
		}

		this._group.destroyChildren();
		this._group.destroy();
	}
}
