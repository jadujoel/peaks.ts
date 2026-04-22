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

export type SegmentMarkerEventHandler = (
	marker: SegmentMarkerAPI,
	event: PeaksPointerEvent<MouseEvent>,
) => void;

export interface SegmentMarkerHandlers {
	readonly onClick: SegmentMarkerEventHandler;
	readonly onDragStart: SegmentMarkerEventHandler;
	readonly onDragMove: SegmentMarkerEventHandler;
	readonly onDragEnd: SegmentMarkerEventHandler;
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
		this.unbindDefaultEventHandlers();
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

	private onClickHandler = (event: PeaksPointerEvent<MouseEvent>): void => {
		this.handlers.onClick(this, event);
	};

	private onDragStartHandler = (event: PeaksPointerEvent<MouseEvent>): void => {
		this.handlers.onDragStart(this, event);
	};

	private onDragMoveHandler = (event: PeaksPointerEvent<MouseEvent>): void => {
		this.handlers.onDragMove(this, event);
	};

	private onDragEndHandler = (event: PeaksPointerEvent<MouseEvent>): void => {
		this.handlers.onDragEnd(this, event);
	};

	private bindDefaultEventHandlers(): void {
		this.group.on("click", this.onClickHandler);
		this.group.on("dragstart", this.onDragStartHandler);
		this.group.on("dragmove", this.onDragMoveHandler);
		this.group.on("dragend", this.onDragEndHandler);
	}

	private unbindDefaultEventHandlers(): void {
		this.group.off("click", this.onClickHandler);
		this.group.off("dragstart", this.onDragStartHandler);
		this.group.off("dragmove", this.onDragMoveHandler);
		this.group.off("dragend", this.onDragEndHandler);
	}
}
