export {};

declare global {
	type DoneCallback = (error?: unknown) => void;

	var context: typeof describe;

	function beforeAll(
		fn: (done: DoneCallback) => void | Promise<void>,
		timeout?: number,
	): void;
	function afterAll(
		fn: (done: DoneCallback) => void | Promise<void>,
		timeout?: number,
	): void;

	interface Document {
		getElementById(elementId: "overview-container"): HTMLDivElement;
		getElementById(elementId: "zoomview-container"): HTMLDivElement;
		getElementById(elementId: "scrollbar-container"): HTMLDivElement;
		getElementById(elementId: "media"): HTMLAudioElement;
	}

	interface ImportMeta {
		glob(
			pattern: string | readonly string[],
		): Record<string, () => Promise<unknown>>;
	}

	namespace Chai {
		interface Assertion {
			calledWithExactly(...args: unknown[]): Assertion;
			calledOnceWithExactly(...args: unknown[]): Assertion;
		}
	}
}
