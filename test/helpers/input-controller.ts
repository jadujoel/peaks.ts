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
}

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
	private target: HTMLCanvasElement;
	private top: number;
	private left: number;

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

		this.target = target;
		this.top = rect.top;
		this.left = rect.left;
	}

	public mouseDown(pos: MousePosition): void {
		this.dispatchMouseEvent("mousedown", pos);
	}

	public mouseMove(pos: MousePosition): void {
		this.dispatchMouseEvent("mousemove", pos);
	}

	public mouseUp(pos: MousePosition): void {
		this.dispatchMouseEvent("mouseup", pos);
	}

	public keyDown(key: SupportedKey, shift: boolean): void {
		this.dispatchKeyboardEvent("keydown", key, shift);
	}

	public keyUp(key: SupportedKey, shift: boolean): void {
		this.dispatchKeyboardEvent("keyup", key, shift);
	}

	private dispatchMouseEvent(type: MouseEventType, pos: MousePosition): void {
		const event = new MouseEvent(type, {
			bubbles: true,
			clientX: this.left + pos.x,
			clientY: this.top + pos.y,
		});

		Object.defineProperties(event, {
			offsetX: { configurable: true, value: pos.x },
			offsetY: { configurable: true, value: pos.y },
		});

		this.target.dispatchEvent(event);
	}

	private dispatchKeyboardEvent(
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

		this.target.dispatchEvent(event);
	}
}
