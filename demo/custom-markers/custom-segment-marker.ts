interface MarkerGroup {
	addLine(attrs: Record<string, unknown>): MarkerNode;
	addRect(attrs: Record<string, unknown>): MarkerNode;
	addText(attrs: Record<string, unknown>): MarkerNode;
	on(eventName: string, handler: () => void): void;
	y(value: number): void;
}

interface MarkerNode {
	fill?(value: string): void;
	points?(values: number[]): void;
	setText?(value: string): void;
	stroke?(value: string): void;
}

interface MarkerLayer {
	getHeight(): number;
}

interface SegmentMarkerOptions {
	color: string;
	segment: {
		labelText: string;
	};
	startMarker: boolean;
	layer: MarkerLayer;
}

interface MarkerUpdateOptions {
	labelText?: string;
	color?: string;
}

export class CustomSegmentMarker {
	private readonly _options: SegmentMarkerOptions;
	private _group: MarkerGroup | null = null;
	private _rect: MarkerNode | null = null;
	private _text: MarkerNode | null = null;
	private _line: MarkerNode | null = null;

	constructor(options: SegmentMarkerOptions) {
		this._options = options;
	}

	init(group: MarkerGroup): void {
		this._group = group;

		const color = this._options.color;

		this._rect = group.addRect({
			fill: color,
			height: 24,
			stroke: color,
			strokeWidth: 1,
			width: 96,
			x: -48,
			y: -24,
		});

		let labelText = this._options.segment.labelText;

		if (labelText) {
			labelText += " ";
		}

		labelText += this._options.startMarker ? "Start" : "End";

		this._text = group.addText({
			fill: "white",
			fontFamily: "Calibri",
			fontSize: 14,
			text: labelText,
			x: -41,
			y: -18,
		});

		this._line = group.addLine({
			stroke: color,
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
