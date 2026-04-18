/**
 * @file
 *
 * Defines the {@link InputController} class.
 *
 * @module input-controller
 */

export interface MousePosition {
	readonly x: number;
	readonly y: number;
};

export const keyCodes = {
	Tab: 9,
	Space: 32,
	ArrowLeft: 37,
	ArrowRight: 39,
} as const;

export type SupportedKey = keyof typeof keyCodes;
export type MouseEventType = "mousedown" | "mousemove" | "mouseup";
export type KeyboardEventType = "keydown" | "keyup";

export class InputController {
	private _target: HTMLCanvasElement;
	private _top: number;
	private _left: number;

	public constructor(containerId: string) {
		const element = document.getElementById(containerId);

		if (!(element instanceof HTMLElement)) {
			throw new Error(`Container "${containerId}" not found`);
		}

		const canvases = element.getElementsByTagName("canvas");
		const target =
			canvases.length > 1 ? (canvases[4] ?? canvases[0]) : canvases[0];

		if (!(target instanceof HTMLCanvasElement)) {
			throw new Error(`No canvas found in "${containerId}"`);
		}

		const rect = element.getBoundingClientRect();

		this._target = target;
		this._top = rect.top;
		this._left = rect.left;
	}

	public mouseDown(pos: MousePosition): void {
		this._dispatchMouseEvent("mousedown", pos);
	}

	public mouseMove(pos: MousePosition): void {
		this._dispatchMouseEvent("mousemove", pos);
	}

	public mouseUp(pos: MousePosition): void {
		this._dispatchMouseEvent("mouseup", pos);
	}

	public keyDown(key: SupportedKey, shift: boolean): void {
		this._dispatchKeyboardEvent("keydown", key, shift);
	}

	public keyUp(key: SupportedKey, shift: boolean): void {
		this._dispatchKeyboardEvent("keyup", key, shift);
	}

	private _dispatchMouseEvent(type: MouseEventType, pos: MousePosition): void {
		const event = new MouseEvent(type, {
			bubbles: true,
			clientX: this._left + pos.x,
			clientY: this._top + pos.y,
		});

		Object.defineProperties(event, {
			offsetX: { configurable: true, value: pos.x },
			offsetY: { configurable: true, value: pos.y },
		});

		this._target.dispatchEvent(event);
	}

	private _dispatchKeyboardEvent(
		type: KeyboardEventType,
		key: SupportedKey,
		shift: boolean,
	): void {
		const keyCode = keyCodes[key];
		const event = new KeyboardEvent(type, {
			bubbles: true,
			code: key,
			key,
			shiftKey: shift,
		});

		Object.defineProperties(event, {
			keyCode: { configurable: true, value: keyCode },
			which: { configurable: true, value: keyCode },
		});

		this._target.dispatchEvent(event);
	}
}
