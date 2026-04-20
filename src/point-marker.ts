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
	private readonly point: Point;
	private readonly marker: Marker;
	private readonly draggable: boolean;
	private readonly onDragStart: (event: KonvaMouseEvent, point: Point) => void;
	private readonly onDragMove: (event: KonvaMouseEvent, point: Point) => void;
	private readonly onDragEnd: (event: KonvaMouseEvent, point: Point) => void;
	private readonly onMouseEnter: (event: KonvaMouseEvent, point: Point) => void;
	private readonly onMouseLeave: (event: KonvaMouseEvent, point: Point) => void;
	private readonly group: Group;

	static from(options: PointMarkerFromOptions): PointMarker {
		return new PointMarker(options.options);
	}

	private constructor(options: PointMarkerOptions) {
		this.point = options.point;
		this.marker = options.marker;
		this.draggable = options.draggable;

		this.onDragStart = options.onDragStart;
		this.onDragMove = options.onDragMove;
		this.onDragEnd = options.onDragEnd;
		this.onMouseEnter = options.onMouseEnter;
		this.onMouseLeave = options.onMouseLeave;

		this.group = new Konva.Group({
			dragBoundFunc: options.dragBoundFunc,
			draggable: this.draggable,
			name: "point-marker",
			point: this.point,
		});

		this.bindDefaultEventHandlers();

		this.marker.init(this.group);
	}

	private bindDefaultEventHandlers(): void {
		this.group.on("dragstart", (event: KonvaEventObject<MouseEvent>) => {
			this.onDragStart(event, this.point);
		});

		this.group.on("dragmove", (event: KonvaEventObject<MouseEvent>) => {
			this.onDragMove(event, this.point);
		});

		this.group.on("dragend", (event: KonvaEventObject<MouseEvent>) => {
			this.onDragEnd(event, this.point);
		});

		this.group.on("mouseenter", (event: KonvaEventObject<MouseEvent>) => {
			this.onMouseEnter(event, this.point);
		});

		this.group.on("mouseleave", (event: KonvaEventObject<MouseEvent>) => {
			this.onMouseLeave(event, this.point);
		});
	}

	addToLayer(layer: Layer): void {
		layer.add(this.group);
	}

	fitToView(): void {
		this.marker.fitToView();
	}

	getPoint(): Point {
		return this.point;
	}

	getX(): number {
		return this.group.x();
	}

	setX(x: number): void {
		this.group.x(x);
	}

	getWidth(): number {
		return this.group.width();
	}

	getAbsolutePosition(): { x: number; y: number } {
		return this.group.getAbsolutePosition();
	}

	update(options: Record<string, unknown>): void {
		if (options.editable !== undefined) {
			this.group.draggable(options.editable as boolean);
		}

		if (this.marker.update) {
			this.marker.update(options);
		}
	}

	destroy(): void {
		if (this.marker.destroy) {
			this.marker.destroy();
		}

		this.group.destroyChildren();
		this.group.destroy();
	}
}
