import Konva from "konva/lib/Core";

class PointMarker {
	private _point: any;
	private _marker: any;
	private _draggable: boolean;
	private _onDragStart: any;
	private _onDragMove: any;
	private _onDragEnd: any;
	private _dragBoundFunc: any;
	private _onMouseEnter: any;
	private _onMouseLeave: any;
	private _group: any;

	constructor(options: any) {
		this._point = options.point;
		this._marker = options.marker;
		this._draggable = options.draggable;

		this._onDragStart = options.onDragStart;
		this._onDragMove = options.onDragMove;
		this._onDragEnd = options.onDragEnd;
		this._dragBoundFunc = options.dragBoundFunc;
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
		this._group.on("dragstart", (event: any) => {
			this._onDragStart(event, this._point);
		});

		this._group.on("dragmove", (event: any) => {
			this._onDragMove(event, this._point);
		});

		this._group.on("dragend", (event: any) => {
			this._onDragEnd(event, this._point);
		});

		this._group.on("mouseenter", (event: any) => {
			this._onMouseEnter(event, this._point);
		});

		this._group.on("mouseleave", (event: any) => {
			this._onMouseLeave(event, this._point);
		});
	}

	addToLayer(layer: any): void {
		layer.add(this._group);
	}

	fitToView(): void {
		this._marker.fitToView();
	}

	getPoint(): any {
		return this._point;
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

	update(options: any): void {
		if (options.editable !== undefined) {
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
}

export default PointMarker;
