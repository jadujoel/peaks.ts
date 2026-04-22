import type {
	CanvasDriver,
	DriverGroup,
	DriverLayer,
	PeaksPointerEvent,
} from "./driver/types";
import { PeaksGroup } from "./peaks-group";
import type { Point } from "./point";
import type {
	Marker,
	MarkerUpdateOptions,
	PointMarkerOptions,
	XY,
} from "./types";

export interface PointMarkerFromOptions extends PointMarkerOptions {
	readonly driver: CanvasDriver;
}

export class PointMarker {
	private constructor(
		private readonly point: Point,
		private readonly marker: Marker,
		private readonly onDragStart: (
			event: PeaksPointerEvent<MouseEvent>,
			point: Point,
		) => void,
		private readonly onDragMove: (
			event: PeaksPointerEvent<MouseEvent>,
			point: Point,
		) => void,
		private readonly onDragEnd: (
			event: PeaksPointerEvent<MouseEvent>,
			point: Point,
		) => void,
		private readonly onMouseEnter: (
			event: PeaksPointerEvent<MouseEvent>,
			point: Point,
		) => void,
		private readonly onMouseLeave: (
			event: PeaksPointerEvent<MouseEvent>,
			point: Point,
		) => void,
		private readonly group: DriverGroup,
	) {}

	static from(options: PointMarkerFromOptions): PointMarker {
		const group = options.driver.createGroup({
			dragBoundFunc: options.dragBoundFunc,
			draggable: options.draggable ?? false,
			name: "point-marker",
			point: options.point,
		});
		const instance = new PointMarker(
			options.point,
			options.marker,
			options.onDragStart,
			options.onDragMove,
			options.onDragEnd,
			options.onMouseEnter,
			options.onMouseLeave,
			group,
		);
		instance.bindDefaultEventHandlers();
		options.marker.init(PeaksGroup.fromGroup(group, options.driver));
		return instance;
	}

	addToLayer(layer: DriverLayer): void {
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
		this.group.on("dragstart", (event: PeaksPointerEvent<MouseEvent>) => {
			this.onDragStart(event, this.point);
		});

		this.group.on("dragmove", (event: PeaksPointerEvent<MouseEvent>) => {
			this.onDragMove(event, this.point);
		});

		this.group.on("dragend", (event: PeaksPointerEvent<MouseEvent>) => {
			this.onDragEnd(event, this.point);
		});

		this.group.on("mouseenter", (event: PeaksPointerEvent<MouseEvent>) => {
			this.onMouseEnter(event, this.point);
		});

		this.group.on("mouseleave", (event: PeaksPointerEvent<MouseEvent>) => {
			this.onMouseLeave(event, this.point);
		});
	}
}
