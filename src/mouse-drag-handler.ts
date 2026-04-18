import type { Group } from "konva/lib/Group";
import type { KonvaEventObject } from "konva/lib/Node";
import type { Stage } from "konva/lib/Stage";
import type { MouseDragHandlers } from "./types";
import { getMarkerObject } from "./utils";

/**
 * Creates a handler for mouse events to allow interaction with the waveform
 * views by clicking and dragging the mouse.
 */

class MouseDragHandler {
	private _stage: Stage;
	private _handlers: MouseDragHandlers;
	private _dragging: boolean;
	private _lastMouseClientX: number | null;

	constructor(stage: Stage, handlers: MouseDragHandlers) {
		this._stage = stage;
		this._handlers = handlers;
		this._dragging = false;
		this._lastMouseClientX = null;

		this._stage.on("mousedown", this._mouseDown);
		this._stage.on("touchstart", this._mouseDown);
	}

	/**
	 * Mouse down event handler.
	 */
	private _mouseDown = (
		event: KonvaEventObject<MouseEvent | TouchEvent>,
	): void => {
		let segment: Group | null = null;

		if (event.type === "mousedown" && (event.evt as MouseEvent).button !== 0) {
			// Mouse drag only applies to the primary mouse button.
			// The secondary button may be used to show a context menu
			// and we don't want to also treat this as a mouse drag operation.
			return;
		}

		const marker = getMarkerObject(event.target);

		if (marker) {
			// Avoid interfering with drag/drop of point and segment markers.
			if (
				marker.attrs.name === "point-marker" ||
				marker.attrs.name === "segment-marker"
			) {
				return;
			}

			// Check if we're dragging a segment.
			if (marker.attrs.name === "segment-overlay") {
				segment = marker as unknown as Group;
			}
		}

		this._lastMouseClientX = Math.floor(
			event.type === "touchstart"
				? ((event.evt as TouchEvent).touches[0]?.clientX ?? 0)
				: (event.evt as MouseEvent).clientX,
		);

		if (this._handlers.onMouseDown) {
			const mouseDownPosX = this._getMousePosX(this._lastMouseClientX);

			this._handlers.onMouseDown(mouseDownPosX, segment);
		}

		// Use the window mousemove and mouseup handlers instead of the
		// Konva.Stage ones so that we still receive events if the user moves the
		// mouse outside the stage.
		window.addEventListener("mousemove", this._mouseMove, {
			capture: false,
			passive: true,
		});
		window.addEventListener("touchmove", this._mouseMove, {
			capture: false,
			passive: true,
		});
		window.addEventListener("mouseup", this._mouseUp, {
			capture: false,
			passive: true,
		});
		window.addEventListener("touchend", this._mouseUp, {
			capture: false /* , passive: true */,
		});
		window.addEventListener("blur", this._mouseUp, {
			capture: false,
			passive: true,
		});
	};

	/**
	 * Mouse move event handler.
	 */
	private _mouseMove = (event: MouseEvent | TouchEvent): void => {
		const clientX = Math.floor(
			event.type === "touchmove"
				? ((event as TouchEvent).changedTouches[0]?.clientX ?? 0)
				: (event as MouseEvent).clientX,
		);

		// Don't update on vertical mouse movement.
		if (clientX === this._lastMouseClientX) {
			return;
		}

		this._lastMouseClientX = clientX;

		this._dragging = true;

		if (this._handlers.onMouseMove) {
			const mousePosX = this._getMousePosX(clientX);

			this._handlers.onMouseMove(mousePosX);
		}
	};

	/**
	 * Mouse up event handler.
	 */
	private _mouseUp = (event: MouseEvent | TouchEvent | FocusEvent): void => {
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

		if (this._handlers.onMouseUp) {
			const mousePosX = this._getMousePosX(clientX);

			this._handlers.onMouseUp(mousePosX);
		}

		window.removeEventListener("mousemove", this._mouseMove, {
			capture: false,
		});
		window.removeEventListener("touchmove", this._mouseMove, {
			capture: false,
		});
		window.removeEventListener("mouseup", this._mouseUp, { capture: false });
		window.removeEventListener("touchend", this._mouseUp, { capture: false });
		window.removeEventListener("blur", this._mouseUp, { capture: false });

		this._dragging = false;
	};

	/**
	 * @returns The mouse X position, relative to the container that
	 * received the mouse down event.
	 */
	private _getMousePosX(clientX: number): number {
		const containerPos = this._stage.container().getBoundingClientRect();

		return Math.floor(clientX - containerPos.left);
	}

	/**
	 * Returns true if the mouse is being dragged, i.e., moved with
	 * the mouse button held down.
	 */
	isDragging(): boolean {
		return this._dragging;
	}

	destroy(): void {
		this._stage.off("mousedown", this._mouseDown);
		this._stage.off("touchstart", this._mouseDown);
	}
}

export default MouseDragHandler;
