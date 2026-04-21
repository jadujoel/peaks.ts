import Konva from "konva/lib/Core";
import type { Group } from "konva/lib/Group";
import type { Layer } from "konva/lib/Layer";
import type { KonvaEventObject } from "konva/lib/Node";
import type { Point } from "./point";
import type {
	KonvaMouseEvent,
	Marker,
	MarkerUpdateOptions,
	PointMarkerOptions,
	XY,
} from "./types";

export interface PointMarkerFromOptions {
	readonly options: PointMarkerOptions;
}

export class PointMarker {
	private constructor(
		private readonly point: Point,
		private readonly marker: Marker,
		private readonly draggable: boolean,
		private readonly onDragStart: (
			event: KonvaMouseEvent,
			point: Point,
		) => void,
		private readonly onDragMove: (event: KonvaMouseEvent, point: Point) => void,
		private readonly onDragEnd: (event: KonvaMouseEvent, point: Point) => void,
		private readonly onMouseEnter: (
			event: KonvaMouseEvent,
			point: Point,
		) => void,
		private readonly onMouseLeave: (
			event: KonvaMouseEvent,
			point: Point,
		) => void,
		private readonly group: Group,
	) {}

	static from(opts: PointMarkerFromOptions): PointMarker {
		const options = opts.options;
		const group = new Konva.Group({
			dragBoundFunc: options.dragBoundFunc,
			draggable: options.draggable,
			name: "point-marker",
			point: options.point,
		});
		const instance = new PointMarker(
			options.point,
			options.marker,
			options.draggable,
			options.onDragStart,
			options.onDragMove,
			options.onDragEnd,
			options.onMouseEnter,
			options.onMouseLeave,
			group,
		);
		instance.bindDefaultEventHandlers();
		options.marker.init(group);
		return instance;
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

	getAbsolutePosition(): XY {
		return this.group.getAbsolutePosition();
	}

	update(options: MarkerUpdateOptions): void {
		if (options.editable !== undefined) {
			this.group.draggable(options.editable);
		}
		this.marker.update(options);
	}

	dispose(): void {
		this.marker.dispose();
		this.group.destroyChildren();
		this.group.destroy();
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
}
