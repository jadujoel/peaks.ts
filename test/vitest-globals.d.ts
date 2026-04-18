import type sinonType from "sinon";
import type { describe } from "vitest";

type DoneCallback = (error?: unknown) => void;
type DoneCompatibleHook = (
	fn: (() => unknown) | ((done: DoneCallback) => void),
	timeout?: number,
) => unknown;
type DoneCompatibleTest = {
	(
		name: string,
		fn?: (() => unknown) | ((done: DoneCallback) => void),
		timeout?: number,
	): unknown;
	only?: (
		name: string,
		fn?: (() => unknown) | ((done: DoneCallback) => void),
		timeout?: number,
	) => unknown;
	skip?: (...args: unknown[]) => unknown;
	todo?: (...args: unknown[]) => unknown;
};

declare global {
	var sinon: typeof sinonType;
	var afterAll: DoneCompatibleHook;
	var afterEach: DoneCompatibleHook;
	var beforeAll: DoneCompatibleHook;
	var beforeEach: DoneCompatibleHook;
	var context: typeof describe;
	var it: DoneCompatibleTest;
	var test: DoneCompatibleTest;
}
