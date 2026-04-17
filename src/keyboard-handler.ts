const nodes = ["OBJECT", "TEXTAREA", "INPUT", "SELECT", "OPTION"];

const SPACE = 32;
const TAB = 9;
const LEFT_ARROW = 37;
const RIGHT_ARROW = 39;

// biome-ignore lint/suspicious/noExplicitAny: event emitter
export default class KeyboardHandler {
	private eventEmitter: any;
	private _handleKeyEvent: (event: KeyboardEvent) => void;

	constructor(eventEmitter: any) {
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
