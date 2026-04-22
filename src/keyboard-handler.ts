import type { PeaksEvents } from "./events";

export const NODE_TYPES = [
	"OBJECT",
	"TEXTAREA",
	"INPUT",
	"SELECT",
	"OPTION",
] as const;

const SPACE_KEY = " ";
const TAB_KEY = "Tab";
const LEFT_ARROW_KEY = "ArrowLeft";
const RIGHT_ARROW_KEY = "ArrowRight";
const HANDLED_KEYS: readonly string[] = [
	SPACE_KEY,
	TAB_KEY,
	LEFT_ARROW_KEY,
	RIGHT_ARROW_KEY,
];

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
			if (HANDLED_KEYS.includes(event.key)) {
				event.preventDefault();
			}

			if (event.type === "keydown" || event.type === "keypress") {
				switch (event.key) {
					case SPACE_KEY:
						this.events.dispatch("keyboard.space", {});
						break;
					case TAB_KEY:
						this.events.dispatch("keyboard.tab", {});
						break;
				}
			} else if (event.type === "keyup") {
				switch (event.key) {
					case LEFT_ARROW_KEY:
						if (event.shiftKey) {
							this.events.dispatch("keyboard.shift_left", {});
						} else {
							this.events.dispatch("keyboard.left", {});
						}
						break;
					case RIGHT_ARROW_KEY:
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
