import type { PeaksEvents } from "./events";

export const NODE_TYPES = [
	"OBJECT",
	"TEXTAREA",
	"INPUT",
	"SELECT",
	"OPTION",
] as const;

export const SPACE = 32 as const;
export const TAB = 9 as const;
export const LEFT_ARROW = 37 as const;
export const RIGHT_ARROW = 39 as const;
const HANDLED_KEYS: readonly number[] = [SPACE, TAB, LEFT_ARROW, RIGHT_ARROW];

function isExcludedNodeName(
	nodeName: string,
): nodeName is (typeof NODE_TYPES)[number] {
	return NODE_TYPES.includes(nodeName as (typeof NODE_TYPES)[number]);
}

export type KeyboardEvents = Pick<PeaksEvents, "dispatch">;

export interface KeyboardHandlerFromOptions {
	readonly events: KeyboardEvents;
}

export class KeyboardHandler {
	private constructor(private readonly events: KeyboardEvents) {}

	static from(options: KeyboardHandlerFromOptions): KeyboardHandler {
		const instance = new KeyboardHandler(options.events);
		document.addEventListener("keydown", instance.handleKeyEvent);
		document.addEventListener("keypress", instance.handleKeyEvent);
		document.addEventListener("keyup", instance.handleKeyEvent);
		return instance;
	}

	dispose(): void {
		document.removeEventListener("keydown", this.handleKeyEvent);
		document.removeEventListener("keypress", this.handleKeyEvent);
		document.removeEventListener("keyup", this.handleKeyEvent);
	}

	private handleKeyEvent = (event: KeyboardEvent): void => {
		const target = event.target as HTMLElement;

		if (!isExcludedNodeName(target.nodeName)) {
			// TODO: refactor to not use deprecated keyCode property.
			if (HANDLED_KEYS.includes(event.keyCode)) {
				event.preventDefault();
			}

			if (event.type === "keydown" || event.type === "keypress") {
				// TODO: refactor to not use deprecated keyCode property.
				switch (event.keyCode) {
					case SPACE:
						this.events.dispatch("keyboard.space", {});
						break;
					case TAB:
						this.events.dispatch("keyboard.tab", {});
						break;
				}
			} else if (event.type === "keyup") {
				switch (event.keyCode) {
					case LEFT_ARROW:
						if (event.shiftKey) {
							this.events.dispatch("keyboard.shift_left", {});
						} else {
							this.events.dispatch("keyboard.left", {});
						}
						break;
					case RIGHT_ARROW:
						if (event.shiftKey) {
							this.events.dispatch("keyboard.shift_right", {});
						} else {
							this.events.dispatch("keyboard.right", {});
						}
						break;
				}
			}
		}
	};
}
