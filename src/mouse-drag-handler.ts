import type { Group } from "konva/lib/Group";
import type { KonvaEventObject } from "konva/lib/Node";
import type { Stage } from "konva/lib/Stage";
import type { MouseDragHandlers } from "./types";
import { getMarkerObject } from "./utils";

/**
 * Creates a handler for mouse events to allow interaction with the waveform
 * views by clicking and dragging the mouse.
 */

export interface MouseDragHandlerFromOptions {
	readonly stage: Stage;
	readonly handlers: MouseDragHandlers;
}

export class MouseDragHandler {
	private readonly stage: Stage;
	private readonly handlers: MouseDragHandlers;
	private dragging: boolean;
	private lastMouseClientX: number | undefined;

	static from(options: MouseDragHandlerFromOptions): MouseDragHandler {
		return new MouseDragHandler(options.stage, options.handlers);
	}

	private constructor(stage: Stage, handlers: MouseDragHandlers) {
		this.stage = stage;
		this.handlers = handlers;
		this.dragging = false;
		this.lastMouseClientX = undefined;

		this.stage.on("mousedown", this.mouseDown);
		this.stage.on("touchstart", this.mouseDown);
	}

	private mouseDown = (
		event: KonvaEventObject<MouseEvent | TouchEvent>,
	): void => {
		let segment: Group | undefined;

		if (event.type === "mousedown" && (event.evt as MouseEvent).button !== 0) {
			return;
		}

		const marker = getMarkerObject(event.target);

		if (marker) {
			if (
				marker.attrs.name === "point-marker" ||
				marker.attrs.name === "segment-marker"
			) {
				return;
			}

			if (marker.attrs.name === "segment-overlay") {
				segment = marker as unknown as Group;
			}
		}

		this.lastMouseClientX = Math.floor(
			event.type === "touchstart"
				? ((event.evt as TouchEvent).touches[0]?.clientX ?? 0)
				: (event.evt as MouseEvent).clientX,
		);

		if (this.handlers.onMouseDown) {
			const mouseDownPosX = this.getMousePosX(this.lastMouseClientX);

			this.handlers.onMouseDown(mouseDownPosX, segment);
		}

		window.addEventListener("mousemove", this.mouseMove, {
			capture: false,
			passive: true,
		});
		window.addEventListener("touchmove", this.mouseMove, {
			capture: false,
			passive: true,
		});
		window.addEventListener("mouseup", this.mouseUp, {
			capture: false,
			passive: true,
		});
		window.addEventListener("touchend", this.mouseUp, {
			capture: false,
		});
		window.addEventListener("blur", this.mouseUp, {
			capture: false,
			passive: true,
		});
	};

	private mouseMove = (event: MouseEvent | TouchEvent): void => {
		const clientX = Math.floor(
			event.type === "touchmove"
				? ((event as TouchEvent).changedTouches[0]?.clientX ?? 0)
				: (event as MouseEvent).clientX,
		);

		if (clientX === this.lastMouseClientX) {
			return;
		}

		this.lastMouseClientX = clientX;

		this.dragging = true;

		if (this.handlers.onMouseMove) {
			const mousePosX = this.getMousePosX(clientX);

			this.handlers.onMouseMove(mousePosX);
		}
	};

	private mouseUp = (event: MouseEvent | TouchEvent | FocusEvent): void => {
		let clientX: number;

		if (event.type === "touchend") {
			clientX = Math.floor(
				(event as TouchEvent).changedTouches[0]?.clientX ?? 0,
			);

			if (event.cancelable) {
				event.preventDefault();
			}
		} else {
			clientX = Math.floor((event as MouseEvent).clientX);
		}

		if (this.handlers.onMouseUp) {
			const mousePosX = this.getMousePosX(clientX);

			this.handlers.onMouseUp(mousePosX);
		}

		window.removeEventListener("mousemove", this.mouseMove, {
			capture: false,
		});
		window.removeEventListener("touchmove", this.mouseMove, {
			capture: false,
		});
		window.removeEventListener("mouseup", this.mouseUp, { capture: false });
		window.removeEventListener("touchend", this.mouseUp, { capture: false });
		window.removeEventListener("blur", this.mouseUp, { capture: false });

		this.dragging = false;
	};

	private getMousePosX(clientX: number): number {
		const containerPos = this.stage.container().getBoundingClientRect();

		return Math.floor(clientX - containerPos.left);
	}

	isDragging(): boolean {
		return this.dragging;
	}

	destroy(): void {
		this.stage.off("mousedown", this.mouseDown);
		this.stage.off("touchstart", this.mouseDown);
	}
}
