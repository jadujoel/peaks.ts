import sinon from "sinon";
import sinonChai from "sinon-chai";
import {
	chai,
	describe,
	afterAll as registerAfterAll,
	afterEach as registerAfterEach,
	beforeAll as registerBeforeAll,
	beforeEach as registerBeforeEach,
	it as registerIt,
	test as registerTest,
} from "vitest";

chai.use(sinonChai);

function wrapDoneCallback(fn) {
	if (typeof fn !== "function" || fn.length === 0) {
		return fn;
	}

	return function wrappedDoneCallback() {
		return new Promise((resolve, reject) => {
			let finished = false;

			function done(error) {
				if (finished) {
					return;
				}

				finished = true;

				if (error) {
					reject(error);
				} else {
					resolve();
				}
			}

			try {
				fn.call(this, done);
			} catch (error) {
				reject(error);
			}
		});
	};
}

function wrapHookRegistrar(registrar) {
	return function registerHook(fn, timeout) {
		return registrar(wrapDoneCallback(fn), timeout);
	};
}

function wrapTestRegistrar(registrar) {
	const wrapped = function registerTest(name, fn, timeout) {
		return registrar(name, wrapDoneCallback(fn), timeout);
	};

	if (registrar.only) {
		wrapped.only = function registerOnlyTest(name, fn, timeout) {
			return registrar.only(name, wrapDoneCallback(fn), timeout);
		};
	}

	if (registrar.skip) {
		wrapped.skip = registrar.skip.bind(registrar);
	}

	if (registrar.todo) {
		wrapped.todo = registrar.todo.bind(registrar);
	}

	return wrapped;
}

globalThis.afterAll = wrapHookRegistrar(registerAfterAll);
globalThis.afterEach = wrapHookRegistrar(registerAfterEach);
globalThis.beforeAll = wrapHookRegistrar(registerBeforeAll);
globalThis.beforeEach = wrapHookRegistrar(registerBeforeEach);
globalThis.context = describe;
globalThis.sinon = sinon;
globalThis.it = wrapTestRegistrar(registerIt);
globalThis.test = wrapTestRegistrar(registerTest);

await import("./setup.js");

registerAfterEach(() => {
	sinon.restore();
});
