import type { PeaksGroup } from "./peaks-group";
import type { PeaksNode } from "./peaks-node";
import type { CreatePointMarkerOptions, PointUpdateOptions } from "./types";

export const DefaultOptions = {
	color: "#000",
	draggable: false,
	editable: false,
	fontFamily: "sans-serif",
	fontSize: 10,
	fontStyle: "normal",
} as const satisfies Omit<CreatePointMarkerOptions, "point">;

export interface DefaultPointMarkerFromOptions {
	readonly options: CreatePointMarkerOptions;
}

export class DefaultPointMarker {
	private constructor(
		private readonly options: CreatePointMarkerOptions,
		private label: PeaksNode | undefined,
		private handle: PeaksNode | undefined,
		private line: PeaksNode | undefined,
		private time: PeaksNode | undefined,
		private draggable: boolean,
	) {}

	static DefaultOptions = DefaultOptions;
	static from(opts: DefaultPointMarkerFromOptions): DefaultPointMarker {
		const options = {
			...DefaultOptions,
			...opts.options,
		};
		return new DefaultPointMarker(
			options,
			undefined,
			undefined,
			undefined,
			undefined,
			options.editable ?? false,
		);
	}

	init(group: PeaksGroup): void {
		const handleWidth = 10 as const;
		const handleHeight = 20 as const;
		const handleX = -(handleWidth / 2) + 0.5;

		this.handle = group.addRect({
			fill: this.options.color ?? DefaultOptions.color,
			height: handleHeight,
			visible: this.options.draggable ?? false,
			width: handleWidth,
			x: handleX,
			y: 0,
		});

		this.line = group.addLine({
			stroke: this.options.color ?? DefaultOptions.color,
			strokeWidth: 1,
			x: 0,
			y: 0,
		});

		this.label = group.addText({
			fill: "#000",
			fontFamily: this.options.fontFamily ?? DefaultOptions.fontFamily,
			fontSize: this.options.fontSize ?? DefaultOptions.fontSize,
			fontStyle: this.options.fontStyle ?? DefaultOptions.fontStyle,
			text: this.options.point?.labelText ?? "",
			textAlign: "left",
			x: 2,
			y: 0,
		});

		this.time = group.addText({
			fill: "#000",
			fontFamily: this.options.fontFamily ?? DefaultOptions.fontFamily,
			fontSize: this.options.fontSize ?? DefaultOptions.fontSize,
			fontStyle: this.options.fontStyle ?? DefaultOptions.fontStyle,
			text: this.options.layer?.formatTime(this.options.point.time) ?? "",
			textAlign: "center",
			x: -24,
			y: 0,
		});
		this.time.hide();

		this.fitToView();
		this.bindEventHandlers(group);
	}

	dispose(): void {
		// Shapes are destroyed by group.destroyChildren() in PointMarker.dispose()
	}

	bindEventHandlers(group: PeaksGroup): void {
		if (!this.handle || !this.time) {
			return;
		}

		const handle = this.handle;
		const time = this.time;

		handle.on("mouseover touchstart", () => {
			if (this.draggable) {
				// Position text to the left of the marker
				time.x(-24 - time.getWidth());
				time.show();
			}
		});

		handle.on("mouseout touchend", () => {
			if (this.draggable) {
				time.hide();
			}
		});

		group.on("dragstart", () => {
			time.x(-24 - time.getWidth());
			time.show();
		});

		group.on("dragend", () => {
			time.hide();
		});
	}

	fitToView(): void {
		const height = this.options.layer?.getHeight() ?? 0;
		this.line?.points([0.5, 0, 0.5, height]);

		if (this.label) {
			this.label.y(12);
		}

		if (this.handle) {
			this.handle.y(height / 2 - 10.5);
		}

		if (this.time) {
			this.time.y(height / 2 - 5);
		}
	}

	update(options: PointUpdateOptions): void {
		if (!this.handle || !this.line || !this.time || !this.label) {
			return;
		}

		if (options.time !== undefined) {
			this.time.setText(this.options.layer?.formatTime(options.time) ?? "");
		}
		if (options.labelText !== undefined) {
			this.label.text(options.labelText);
		}
		if (options.color !== undefined) {
			if (this.handle) {
				this.handle.fill(options.color);
			}
			this.line.stroke(options.color);
		}

		if (options.editable !== undefined) {
			this.draggable = options.editable;
			this.handle.visible(this.draggable);
		}
	}
}
