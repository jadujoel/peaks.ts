import type {
	CanvasDriver,
	DriverGroup,
	LineAttrs,
	RectAttrs,
	TextAttrs,
} from "./driver/types";
import { PeaksNode } from "./peaks-node";

// Public marker-API group wrapper. Custom marker factories receive a
// `PeaksGroup` and add primitives via `addRect` / `addLine` / `addText`.
// All node construction is delegated to the active `CanvasDriver`, so no
// renderer-specific types leak through this surface.

export class PeaksGroup extends PeaksNode {
	private constructor(
		group: DriverGroup,
		private readonly driver: CanvasDriver,
	) {
		super(group);
	}

	static fromGroup = (group: DriverGroup, driver: CanvasDriver): PeaksGroup => {
		return new PeaksGroup(group, driver);
	};

	private get group(): DriverGroup {
		return this.node as DriverGroup;
	}

	get attrs(): Record<string, unknown> {
		return (this.group.attrs ?? {}) as Record<string, unknown>;
	}

	add = (child: PeaksNode): void => {
		this.group.add(child.rawNode);
	};

	addRect = (attrs: RectAttrs): PeaksNode => {
		const rect = this.driver.createRect(attrs);
		this.group.add(rect);
		return PeaksNode.from(rect);
	};

	addLine = (attrs: LineAttrs): PeaksNode => {
		const line = this.driver.createLine(attrs);
		this.group.add(line);
		return PeaksNode.from(line);
	};

	addText = (attrs: TextAttrs): PeaksNode => {
		const text = this.driver.createText(attrs);
		this.group.add(text);
		return PeaksNode.from(text);
	};

	draggable = (value?: boolean): boolean => {
		return value === undefined
			? this.group.draggable()
			: this.group.draggable(value);
	};

	startDrag = (): void => {
		this.group.startDrag();
	};

	stopDrag = (): void => {
		this.group.stopDrag();
	};

	destroyChildren = (): void => {
		this.group.destroyChildren();
	};

	clipWidth = (width: number): void => {
		this.group.clipWidth(width);
	};
}
