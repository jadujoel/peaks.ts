import Konva from "konva/lib/Core";
import type { Group } from "konva/lib/Group";
import type { Layer } from "konva/lib/Layer";
import type { KonvaEventObject } from "konva/lib/Node";
import type { Segment } from "./segment";
import type {
	KonvaMouseEvent,
	Marker,
	MarkerUpdateOptions,
	SegmentMarkerAPI,
	SegmentMarkerOptions,
	XY,
} from "./types";

export interface SegmentMarkerHandlers {
	readonly onClick: (marker: SegmentMarkerAPI, event: KonvaMouseEvent) => void;
	readonly onDragStart: (
		marker: SegmentMarkerAPI,
		event: KonvaMouseEvent,
	) => void;
	readonly onDragMove: (
		marker: SegmentMarkerAPI,
		event: KonvaMouseEvent,
	) => void;
	readonly onDragEnd: (
		marker: SegmentMarkerAPI,
		event: KonvaMouseEvent,
	) => void;
}

export type SegmentMarkerDragBoundFunc = (marker: SegmentMarker, pos: XY) => XY;

export interface SegmentMarkerFromOptions extends SegmentMarkerOptions {}

export class SegmentMarker {
	private constructor(
		private readonly segment: Segment,
		private readonly marker: Marker,
		private readonly editable: boolean,
		private readonly startMarker: boolean,
		private readonly handlers: SegmentMarkerHandlers,
		private readonly group: Group,
	) {}

	static from(options: SegmentMarkerFromOptions): SegmentMarker {
		let instance: SegmentMarker;
		const group = new Konva.Group({
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
			options.editable,
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
		options.marker.init(group);
		return instance;
	}

	addToLayer(layer: Layer): void {
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

	getAbsolutePosition(): { x: number; y: number } {
		return this.group.getAbsolutePosition();
	}

	isStartMarker(): boolean {
		return this.startMarker;
	}

	update(options: MarkerUpdateOptions): void {
		if (options.editable !== undefined) {
			this.group.visible(options.editable as boolean);
			this.group.draggable(options.editable as boolean);
		}

		if (this.marker.update) {
			this.marker.update(options);
		}
	}

	dispose(): void {
		if (this.marker.dispose) {
			this.marker.dispose();
		}

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
		this.group.on("click", (event: KonvaEventObject<MouseEvent>) => {
			this.handlers.onClick(this, event);
		});

		this.group.on("dragstart", (event: KonvaEventObject<MouseEvent>) => {
			this.handlers.onDragStart(this, event);
		});

		this.group.on("dragmove", (event: KonvaEventObject<MouseEvent>) => {
			this.handlers.onDragMove(this, event);
		});

		this.group.on("dragend", (event: KonvaEventObject<MouseEvent>) => {
			this.handlers.onDragEnd(this, event);
		});
	}
}
