export interface MarkerGroup {
	addLine(attrs: Record<string, unknown>): MarkerNode;
	addRect(attrs: Record<string, unknown>): MarkerNode;
	addText(attrs: Record<string, unknown>): MarkerNode;
	on(eventName: string, handler: () => void): void;
	y(value: number): void;
}

export interface MarkerNode {
	fill?(value: string): void;
	points?(values: number[]): void;
	setText?(value: string): void;
	stroke?(value: string): void;
	text?(value: string): void;
}

export interface MarkerLayer {
	getHeight(): number;
}

export interface PointMarkerOptions {
	color: string;
	point: {
		labelText: string;
	};
	layer: MarkerLayer;
}

export interface MarkerUpdateOptions {
	labelText?: string;
	color?: string;
}

export class CustomPointMarker {
	private readonly _options: PointMarkerOptions;
	private _group: MarkerGroup | null = null;
	private _rect: MarkerNode | null = null;
	private _text: MarkerNode | null = null;
	private _line: MarkerNode | null = null;

	constructor(options: PointMarkerOptions) {
		this._options = options;
	}

	init(group: MarkerGroup): void {
		this._group = group;

		this._rect = group.addRect({
			fill: this._options.color,
			height: 24,
			stroke: this._options.color,
			strokeWidth: 1,
			width: 90,
			x: -45,
			y: -24,
		});

		this._text = group.addText({
			fill: "white",
			fontFamily: "Calibri",
			fontSize: 14,
			text: this._options.point.labelText,
			x: -38,
			y: -18,
		});

		this._line = group.addLine({
			stroke: this._options.color,
			strokeWidth: 1,
			x: 0,
			y: 0,
		});

		this.fitToView();
		this.bindEventHandlers();
	}

	private bindEventHandlers(): void {
		this._group?.on("mouseenter", () => {
			document.body.style.cursor = "move";
		});

		this._group?.on("mouseleave", () => {
			document.body.style.cursor = "default";
		});
	}

	fitToView(): void {
		if (!this._group || !this._text || !this._line) {
			return;
		}

		const height = this._options.layer.getHeight();
		const labelHeight = 24;
		const offsetTop = 14;
		const offsetBottom = 26;

		this._group.y(offsetTop + labelHeight + 0.5);
		this._line.points?.([
			0.5,
			0,
			0.5,
			height - labelHeight - offsetTop - offsetBottom,
		]);
	}

	update(options: MarkerUpdateOptions): void {
		if (options.labelText !== undefined) {
			this._text?.setText?.(options.labelText);
		}

		if (options.color !== undefined) {
			this._rect?.fill?.(options.color);
			this._rect?.stroke?.(options.color);
			this._line?.stroke?.(options.color);
		}
	}

	dispose(): void {
		// Nothing to release in demo marker implementation.
	}
}
