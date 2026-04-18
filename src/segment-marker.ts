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

export class SegmentMarker {
	private _segment: Segment;
	private _marker: Marker;
	private _editable: boolean;
	private _startMarker: boolean;
	private _onClick: (marker: SegmentMarkerAPI, event: KonvaMouseEvent) => void;
	private _onDragStart: (
		marker: SegmentMarkerAPI,
		event: KonvaMouseEvent,
	) => void;
	private _onDragMove: (
		marker: SegmentMarkerAPI,
		event: KonvaMouseEvent,
	) => void;
	private _onDragEnd: (
		marker: SegmentMarkerAPI,
		event: KonvaMouseEvent,
	) => void;
	private _group: Group;

	constructor(options: SegmentMarkerOptions) {
		this._segment = options.segment;
		this._marker = options.marker;
		this._editable = options.editable;
		this._startMarker = options.startMarker;

		this._onClick = options.onClick;
		this._onDragStart = options.onDragStart;
		this._onDragMove = options.onDragMove;
		this._onDragEnd = options.onDragEnd;

		this._group = new Konva.Group({
			name: "segment-marker",
			segment: this._segment,
			draggable: this._editable,
			visible: this._editable,
			dragBoundFunc: (pos: { x: number; y: number }) =>
				options.dragBoundFunc(this, pos),
		});

		this._bindDefaultEventHandlers();

		this._marker.init(this._group);
	}

	private _bindDefaultEventHandlers(): void {
		this._group.on("click", (event: KonvaEventObject<MouseEvent>) => {
			this._onClick(this, event);
		});

		this._group.on("dragstart", (event: KonvaEventObject<MouseEvent>) => {
			this._onDragStart(this, event);
		});

		this._group.on("dragmove", (event: KonvaEventObject<MouseEvent>) => {
			this._onDragMove(this, event);
		});

		this._group.on("dragend", (event: KonvaEventObject<MouseEvent>) => {
			this._onDragEnd(this, event);
		});
	}

	addToLayer(layer: Layer): void {
		layer.add(this._group);
	}

	moveToTop(): void {
		this._group.moveToTop();
	}

	fitToView(): void {
		this._marker.fitToView();
	}

	getSegment(): Segment {
		return this._segment;
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

	isStartMarker(): boolean {
		return this._startMarker;
	}

	update(options: Record<string, unknown>): void {
		if (options.editable !== undefined) {
			this._group.visible(options.editable as boolean);
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

	startDrag(): void {
		this._group.startDrag();
	}

	stopDrag(): void {
		this._group.stopDrag();
	}
}
