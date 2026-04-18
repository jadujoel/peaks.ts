import type Sinon from "sinon";

declare global {
	type DoneCallback = (error?: unknown) => void;

	var context: typeof describe;
	var sinon: typeof Sinon;

	function beforeEach(
		fn: (done: DoneCallback) => void | Promise<void>,
		timeout?: number,
	): void;
	function beforeAll(
		fn: (done: DoneCallback) => void | Promise<void>,
		timeout?: number,
	): void;
	function afterEach(
		fn: (done: DoneCallback) => void | Promise<void>,
		timeout?: number,
	): void;
	function afterAll(
		fn: (done: DoneCallback) => void | Promise<void>,
		timeout?: number,
	): void;
	function it(
		name: string,
		fn: (done: DoneCallback) => void | Promise<void>,
		timeout?: number,
	): void;
	function test(
		name: string,
		fn: (done: DoneCallback) => void | Promise<void>,
		timeout?: number,
	): void;

	interface Document {
		getElementById(elementId: "overview-container"): HTMLDivElement;
		getElementById(elementId: "zoomview-container"): HTMLDivElement;
		getElementById(elementId: "scrollbar-container"): HTMLDivElement;
		getElementById(elementId: "media"): HTMLAudioElement;
	}

	interface Window {
		mozAudioContext?: typeof AudioContext;
		webkitAudioContext?: typeof AudioContext;
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
