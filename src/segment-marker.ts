import type {
	CanvasDriver,
	DriverGroup,
	DriverLayer,
	PeaksPointerEvent,
} from "./driver/types";
import { PeaksGroup } from "./peaks-group";
import type { Segment } from "./segment";
import type {
	Marker,
	MarkerUpdateOptions,
	SegmentMarkerAPI,
	SegmentMarkerOptions,
	XY,
} from "./types";

export interface SegmentMarkerHandlers {
	// TODO: make more DRY
	readonly onClick: (
		marker: SegmentMarkerAPI,
		event: PeaksPointerEvent<MouseEvent>,
	) => void;
	readonly onDragStart: (
		marker: SegmentMarkerAPI,
		event: PeaksPointerEvent<MouseEvent>,
	) => void;
	readonly onDragMove: (
		marker: SegmentMarkerAPI,
		event: PeaksPointerEvent<MouseEvent>,
	) => void;
	readonly onDragEnd: (
		marker: SegmentMarkerAPI,
		event: PeaksPointerEvent<MouseEvent>,
	) => void;
}

export type SegmentMarkerDragBoundFunc = (marker: SegmentMarker, pos: XY) => XY;

export interface SegmentMarkerFromOptions extends SegmentMarkerOptions {
	readonly driver: CanvasDriver;
}

export class SegmentMarker {
	private constructor(
		private readonly segment: Segment,
		private readonly marker: Marker,
		private readonly startMarker: boolean,
		private readonly handlers: SegmentMarkerHandlers,
		private readonly group: DriverGroup,
	) {}

	static from(options: SegmentMarkerFromOptions): SegmentMarker {
		let instance: SegmentMarker;
		const group = options.driver.createGroup({
			dragBoundFunc: (pos: XY) => {
				return options.dragBoundFunc(instance, pos);
			},
			draggable: options.editable,
			name: "segment-marker",
			segment: options.segment,
			visible: options.editable,
		});
		instance = new SegmentMarker(
			options.segment,
			options.marker,
			options.startMarker,
			{
				onClick: options.onClick,
				onDragEnd: options.onDragEnd,
				onDragMove: options.onDragMove,
				onDragStart: options.onDragStart,
			},
			group,
		);
		instance.bindDefaultEventHandlers();
		options.marker.init(PeaksGroup.fromGroup(group, options.driver));
		return instance;
	}

	addToLayer(layer: DriverLayer): void {
		layer.add(this.group);
	}

	moveToTop(): void {
		this.group.moveToTop();
	}

	fitToView(): void {
		this.marker.fitToView();
	}

	getSegment(): Segment {
		return this.segment;
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

	isStartMarker(): boolean {
		return this.startMarker;
	}

	update(options: MarkerUpdateOptions): void {
		if (options.editable !== undefined) {
			this.group.visible(options.editable);
			this.group.draggable(options.editable);
		}

		this.marker.update(options);
	}

	dispose(): void {
		this.marker.dispose();
		this.group.destroyChildren();
		this.group.destroy();
	}

	startDrag(): void {
		this.group.startDrag();
	}

	stopDrag(): void {
		this.group.stopDrag();
	}

	private bindDefaultEventHandlers(): void {
		// TODO: unsubscribe these handlers in dispose()
		this.group.on("click", (event: PeaksPointerEvent<MouseEvent>) => {
			this.handlers.onClick(this, event);
		});

		this.group.on("dragstart", (event: PeaksPointerEvent<MouseEvent>) => {
			this.handlers.onDragStart(this, event);
		});

		this.group.on("dragmove", (event: PeaksPointerEvent<MouseEvent>) => {
			this.handlers.onDragMove(this, event);
		});

		this.group.on("dragend", (event: PeaksPointerEvent<MouseEvent>) => {
			this.handlers.onDragEnd(this, event);
		});
	}
}
