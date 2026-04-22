import type { PeaksGroup } from "./peaks-group";
import type { PeaksNode } from "./peaks-node";
import type { CreateSegmentMarkerOptions, SegmentUpdateOptions } from "./types";

export const SegmentMarkerDefaults = {
	color: "#000",
	fontFamily: "sans-serif",
	fontSize: 10,
	fontStyle: "normal",
	handleHeight: 20,
	handleWidth: 10,
} as const;

export interface DefaultSegmentMarkerFromOptions {
	readonly options: CreateSegmentMarkerOptions;
}

export class DefaultSegmentMarker {
	private constructor(
		private readonly options: CreateSegmentMarkerOptions,
		private label: PeaksNode | undefined,
		private handle: PeaksNode | undefined,
		private line: PeaksNode | undefined,
		private readonly labelX: number,
		private editable: boolean,
	) {}

	static from(opts: DefaultSegmentMarkerFromOptions): DefaultSegmentMarker {
		const { options } = opts;
		const editable = options.editable ?? false;
		const labelXPosition = options.startMarker ? -24 : 24;

		return new DefaultSegmentMarker(
			options,
			undefined,
			undefined,
			undefined,
			labelXPosition,
			editable,
		);
	}

	init(group: PeaksGroup): void {
		const handleX = -(SegmentMarkerDefaults.handleWidth / 2) + 0.5;
		const time =
			(this.options.startMarker
				? this.options.segment?.startTime
				: this.options.segment?.endTime) ?? 0;

		this.label = group.addText({
			fill: "#000",
			fontFamily: this.options.fontFamily ?? SegmentMarkerDefaults.fontFamily,
			fontSize: this.options.fontSize ?? SegmentMarkerDefaults.fontSize,
			fontStyle: this.options.fontStyle ?? SegmentMarkerDefaults.fontStyle,
			text: this.options.layer?.formatTime(time) ?? "",
			textAlign: "center",
			visible: this.editable,
			x: this.labelX,
			y: 0,
		});
		this.label.hide();

		this.line = group.addLine({
			stroke: this.options.color ?? SegmentMarkerDefaults.color,
			strokeWidth: 1,
			visible: this.editable,
			x: 0,
			y: 0,
		});

		this.handle = group.addRect({
			fill: this.options.color ?? SegmentMarkerDefaults.color,
			height: SegmentMarkerDefaults.handleHeight,
			stroke: this.options.color ?? SegmentMarkerDefaults.color,
			strokeWidth: 1,
			visible: this.editable,
			width: SegmentMarkerDefaults.handleWidth,
			x: handleX,
			y: 0,
		});

		this.fitToView();
		this.bindEventHandlers(group);
	}

	fitToView(): void {
		const height = this.options.layer?.getHeight() ?? 0;
		if (!this.label || !this.handle || !this.line) {
			return;
		}

		this.label.y(height / 2 - 5);
		this.handle.y(height / 2 - 10.5);
		this.line.points([0.5, 0, 0.5, height]);
	}

	update(options: SegmentUpdateOptions): void {
		if (!this.label || !this.handle || !this.line) {
			return;
		}

		if (options.startTime !== undefined && this.options.startMarker) {
			this.label.text(this.options.layer?.formatTime(options.startTime) ?? "");
		}

		if (options.endTime !== undefined && !this.options.startMarker) {
			this.label.text(this.options.layer?.formatTime(options.endTime) ?? "");
		}

		if (options.editable !== undefined) {
			this.editable = options.editable;

			this.label.visible(this.editable);
			this.handle.visible(this.editable);
			this.line.visible(this.editable);
		}
	}

	dispose(): void {
		// Shapes are destroyed by group.destroyChildren() in SegmentMarker.dispose()
	}

	private bindEventHandlers(group: PeaksGroup): void {
		if (!this.label || !this.handle) {
			return;
		}

		const label = this.label;
		const handle = this.handle;

		group.on("dragstart", () => {
			if (this.options.startMarker) {
				label.x(this.labelX - label.getWidth());
			}

			label.show();
		});

		group.on("dragend", () => {
			label.hide();
		});

		handle.on("mouseover touchstart", () => {
			if (this.options.startMarker) {
				label.x(this.labelX - label.getWidth());
			}

			label.show();
		});

		handle.on("mouseout touchend", () => {
			label.hide();
		});
	}
}
