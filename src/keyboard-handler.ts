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

	static from(options: KeyboardHandlerFromOptions): KeyboardHandler {
		return new KeyboardHandler(options.eventEmitter);
	}

	private constructor(eventEmitter: PeaksInstance) {
		this.eventEmitter = eventEmitter;

		document.addEventListener("keydown", this.handleKeyEvent);
		document.addEventListener("keypress", this.handleKeyEvent);
		document.addEventListener("keyup", this.handleKeyEvent);
	}

	private handleKeyEvent = (event: KeyboardEvent): void => {
		const target = event.target as HTMLElement;

		if (!nodes.includes(target.nodeName)) {
			if ([SPACE, TAB, LEFT_ARROW, RIGHT_ARROW].includes(event.keyCode)) {
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
	};

	destroy(): void {
		document.removeEventListener("keydown", this.handleKeyEvent);
		document.removeEventListener("keypress", this.handleKeyEvent);
		document.removeEventListener("keyup", this.handleKeyEvent);
	}
}
