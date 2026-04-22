import type {
	CanvasDriver,
	DriverLine,
	DriverNode,
	DriverRect,
	DriverShape,
	DriverText,
	EventHandler,
	PeaksPointerEvent,
	XY,
} from "./driver/types";

// Public marker-API node wrapper. Wraps an opaque `DriverNode` so user
// code never touches the underlying renderer (Konva or otherwise).
//
// Mutators that are only valid on certain node types (`text`, `points`,
// `fill`, `stroke`) cast the underlying node at the call site; this
// matches the previous Konva-flavoured behaviour where you call
// `text.text(...)` on a text node and `line.points(...)` on a line.

export class PeaksNode {
	protected constructor(protected readonly node: DriverNode) {}

	static from = (node: DriverNode): PeaksNode => {
		return new PeaksNode(node);
	};

	get rawNode(): DriverNode {
		return this.node;
	}

	on = <E extends Event = Event>(
		eventName: string,
		handler: EventHandler<E>,
	): void => {
		this.node.on(eventName, handler);
	};

	off = (
		eventName: string,
		handler?: (event: PeaksPointerEvent) => void,
	): void => {
		this.node.off(eventName, handler);
	};

	x = (value?: number): number => {
		return value === undefined ? this.node.x() : this.node.x(value);
	};

	y = (value?: number): number => {
		return value === undefined ? this.node.y() : this.node.y(value);
	};

	width = (value?: number): number => {
		return value === undefined ? this.node.width() : this.node.width(value);
	};

	height = (value?: number): number => {
		return value === undefined ? this.node.height() : this.node.height(value);
	};

	text = (value?: string): string => {
		const text = this.node as unknown as DriverText;
		return value === undefined ? text.text() : text.text(value);
	};

	setText = (value: string): void => {
		(this.node as unknown as DriverText).setText(value);
	};

	points = (value: readonly number[]): void => {
		(this.node as unknown as DriverLine).points(value);
	};

	fill = (value: string): void => {
		(this.node as unknown as DriverRect | DriverText | DriverShape).fill(value);
	};

	stroke = (value: string | undefined): void => {
		(this.node as unknown as DriverRect | DriverLine).stroke(value ?? null);
	};

	visible = (value?: boolean): boolean => {
		return value === undefined ? this.node.visible() : this.node.visible(value);
	};

	setAttrs = (attrs: Record<string, unknown>): void => {
		this.node.setAttrs(attrs);
	};

	show = (): void => {
		this.node.show();
	};

	hide = (): void => {
		this.node.hide();
	};

	remove = (): void => {
		this.node.remove();
	};

	destroy = (): void => {
		this.node.destroy();
	};

	moveToTop = (): void => {
		this.node.moveToTop();
	};

	getWidth = (): number => {
		return this.node.getWidth();
	};

	getAbsolutePosition = (): XY => {
		return this.node.getAbsolutePosition();
	};
}

// Re-export the driver type so factories can stash a driver alongside the
// wrapper without an extra import.
export type { CanvasDriver };
