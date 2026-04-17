import Konva from "konva/lib/Core";

class SegmentMarker {
	private _segment: any;
	private _marker: any;
	private _segmentShape: any;
	private _editable: boolean;
	private _startMarker: boolean;
	private _onClick: any;
	private _onDragStart: any;
	private _onDragMove: any;
	private _onDragEnd: any;
	private _group: any;

	constructor(options: any) {
		this._segment = options.segment;
		this._marker = options.marker;
		this._segmentShape = options.segmentShape;
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
			dragBoundFunc: (pos: any) => options.dragBoundFunc(this, pos),
		});

		this._bindDefaultEventHandlers();

		this._marker.init(this._group);
	}

	private _bindDefaultEventHandlers(): void {
		this._group.on("click", (event: any) => {
			this._onClick(this, event);
		});

		this._group.on("dragstart", (event: any) => {
			this._onDragStart(this, event);
		});

		this._group.on("dragmove", (event: any) => {
			this._onDragMove(this, event);
		});

		this._group.on("dragend", (event: any) => {
			this._onDragEnd(this, event);
		});
	}

	addToLayer(layer: any): void {
		layer.add(this._group);
	}

	moveToTop(): void {
		this._group.moveToTop();
	}

	fitToView(): void {
		this._marker.fitToView();
	}

	getSegment(): any {
		return this._segment;
	}

	getX(): number {
		return this._group.getX();
	}

	setX(x: number): void {
		this._group.setX(x);
	}

	getWidth(): number {
		return this._group.getWidth();
	}

	getAbsolutePosition(): any {
		return this._group.getAbsolutePosition();
	}

	isStartMarker(): boolean {
		return this._startMarker;
	}

	update(options: any): void {
		if (options.editable !== undefined) {
			this._group.visible(options.editable);
			this._group.draggable(options.editable);
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

export default SegmentMarker;
