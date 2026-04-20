import type { PeaksInstance } from "./types";

export const nodes = ["OBJECT", "TEXTAREA", "INPUT", "SELECT", "OPTION"];

export const SPACE = 32;
export const TAB = 9;
export const LEFT_ARROW = 37;
export const RIGHT_ARROW = 39;

export interface KeyboardHandlerFromOptions {
	readonly eventEmitter: PeaksInstance;
}

export class KeyboardHandler {
	private readonly eventEmitter: PeaksInstance;
	private readonly _handleKeyEvent: (event: KeyboardEvent) => void;

	static from(options: KeyboardHandlerFromOptions): KeyboardHandler {
		return new KeyboardHandler(options.eventEmitter);
	}

	private constructor(eventEmitter: PeaksInstance) {
		this.eventEmitter = eventEmitter;

		this._handleKeyEvent = this._onKeyEvent.bind(this);

		document.addEventListener("keydown", this._handleKeyEvent);
		document.addEventListener("keypress", this._handleKeyEvent);
		document.addEventListener("keyup", this._handleKeyEvent);
	}

	private _onKeyEvent(event: KeyboardEvent): void {
		const target = event.target as HTMLElement;

		if (nodes.indexOf(target.nodeName) === -1) {
			if ([SPACE, TAB, LEFT_ARROW, RIGHT_ARROW].indexOf(event.keyCode) > -1) {
				event.preventDefault();
			}

			if (event.type === "keydown" || event.type === "keypress") {
				switch (event.keyCode) {
					case SPACE:
						this.eventEmitter.emit("keyboard.space");
						break;
					case TAB:
						this.eventEmitter.emit("keyboard.tab");
						break;
				}
			} else if (event.type === "keyup") {
				switch (event.keyCode) {
					case LEFT_ARROW:
						if (event.shiftKey) {
							this.eventEmitter.emit("keyboard.shift_left");
						} else {
							this.eventEmitter.emit("keyboard.left");
						}
						break;
					case RIGHT_ARROW:
						if (event.shiftKey) {
							this.eventEmitter.emit("keyboard.shift_right");
						} else {
							this.eventEmitter.emit("keyboard.right");
						}
						break;
				}
			}
		}
	}

	destroy(): void {
		document.removeEventListener("keydown", this._handleKeyEvent);
		document.removeEventListener("keypress", this._handleKeyEvent);
		document.removeEventListener("keyup", this._handleKeyEvent);
	}
}
