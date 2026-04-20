import Konva from "konva/lib/Core";
import type { Group } from "konva/lib/Group";
import type { Layer } from "konva/lib/Layer";
import type { KonvaEventObject } from "konva/lib/Node";
import type { Segment } from "./segment";
import type {
	KonvaMouseEvent,
	Marker,
	SegmentMarkerAPI,
	SegmentMarkerOptions,
} from "./types";

export interface SegmentMarkerFromOptions {
	readonly options: SegmentMarkerOptions;
}

export class SegmentMarker {
	private readonly segment: Segment;
	private readonly marker: Marker;
	private readonly editable: boolean;
	private readonly startMarker: boolean;
	private readonly onClick: (
		marker: SegmentMarkerAPI,
		event: KonvaMouseEvent,
	) => void;
	private readonly onDragStart: (
		marker: SegmentMarkerAPI,
		event: KonvaMouseEvent,
	) => void;
	private readonly onDragMove: (
		marker: SegmentMarkerAPI,
		event: KonvaMouseEvent,
	) => void;
	private readonly onDragEnd: (
		marker: SegmentMarkerAPI,
		event: KonvaMouseEvent,
	) => void;
	private readonly group: Group;

	static from(options: SegmentMarkerFromOptions): SegmentMarker {
		return new SegmentMarker(options.options);
	}

	private constructor(options: SegmentMarkerOptions) {
		this.segment = options.segment;
		this.marker = options.marker;
		this.editable = options.editable;
		this.startMarker = options.startMarker;

		this.onClick = options.onClick;
		this.onDragStart = options.onDragStart;
		this.onDragMove = options.onDragMove;
		this.onDragEnd = options.onDragEnd;

		this.group = new Konva.Group({
			dragBoundFunc: (pos: { x: number; y: number }) =>
				options.dragBoundFunc(this, pos),
			draggable: this.editable,
			name: "segment-marker",
			segment: this.segment,
			visible: this.editable,
		});

		this.bindDefaultEventHandlers();

		this.marker.init(this.group);
	}

	private bindDefaultEventHandlers(): void {
		this.group.on("click", (event: KonvaEventObject<MouseEvent>) => {
			this.onClick(this, event);
		});

		this.group.on("dragstart", (event: KonvaEventObject<MouseEvent>) => {
			this.onDragStart(this, event);
		});

		this.group.on("dragmove", (event: KonvaEventObject<MouseEvent>) => {
			this.onDragMove(this, event);
		});

		this.group.on("dragend", (event: KonvaEventObject<MouseEvent>) => {
			this.onDragEnd(this, event);
		});
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

	update(options: Record<string, unknown>): void {
		if (options.editable !== undefined) {
			this.group.visible(options.editable as boolean);
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

	startDrag(): void {
		this.group.startDrag();
	}

	stopDrag(): void {
		this.group.stopDrag();
	}
}
