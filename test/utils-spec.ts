import {
	clamp,
	extend,
	formatTime,
	isFinite as isFiniteValue,
	isFunction,
	isInAscendingOrder,
	isLinearGradientColor,
	isNullOrUndefined,
	isObject,
	isString,
	isValidTime,
	roundUpToNearest,
} from "../src/utils";

describe("Utils", () => {
	describe("formatTime", () => {
		describe("with hundredths", () => {
			const tests = [
				{ input: 0, output: "00:00.00" },
				{ input: 1, output: "00:01.00" },
				{ input: 60, output: "01:00.00" },
				{ input: 60 * 60, output: "01:00:00.00" },
				{ input: 24 * 60 * 60, output: "24:00:00.00" },
				{ input: 10.5, output: "00:10.50" },
			];

			tests.forEach((test) => {
				describe(`given ${test.input}`, () => {
					it(`should output ${test.output}`, () => {
						expect(formatTime(test.input, 2)).to.equal(test.output);
					});
				});
			});
		});

		describe("with thousandths", () => {
			const tests = [
				{ input: 0, output: "00:00.000" },
				{ input: 1, output: "00:01.000" },
				{ input: 60, output: "01:00.000" },
				{ input: 60 * 60, output: "01:00:00.000" },
				{ input: 24 * 60 * 60, output: "24:00:00.000" },
				{ input: 10.5, output: "00:10.500" },
				{ input: 20.003, output: "00:20.003" },
				{ input: 25.07, output: "00:25.070" },
			];

			tests.forEach((test) => {
				describe(`given ${test.input}`, () => {
					it(`should output ${test.output}`, () => {
						expect(formatTime(test.input, 3)).to.equal(test.output);
					});
				});
			});
		});

		describe("without fraction seconds", () => {
			const tests = [
				{ input: 0, output: "00:00" },
				{ input: 1, output: "00:01" },
				{ input: 60, output: "01:00" },
				{ input: 60 * 60, output: "01:00:00" },
				{ input: 24 * 60 * 60, output: "24:00:00" },
				{ input: 10.5, output: "00:10" },
			];

			tests.forEach((test) => {
				describe(`given ${test.input}`, () => {
					it(`should output ${test.output}`, () => {
						expect(formatTime(test.input, 0)).to.equal(test.output);
					});
				});
			});
		});
	});

	describe("roundUpToNearest", () => {
		it("should return an integer", () => {
			expect(roundUpToNearest(0.1523809523809524, 1)).to.equal(1);
		});

		it("should round upwards", () => {
			expect(roundUpToNearest(5.5, 3)).to.equal(6);
			expect(roundUpToNearest(38.9, 5)).to.equal(40);
			expect(roundUpToNearest(141.0, 10)).to.equal(150);
		});

		it("should round negative values towards negative infinity", () => {
			expect(roundUpToNearest(-5.5, 3)).to.equal(-6);
		});

		it("should return 0 given a multiple of 0", () => {
			expect(roundUpToNearest(5.5, 0)).to.equal(0);
		});
	});

	describe("clamp", () => {
		it("should given value if in range", () => {
			expect(clamp(15, 10, 20)).to.equal(15);
			expect(clamp(-15, -20, -10)).to.equal(-15);
		});

		it("should return minimum if given value is lower", () => {
			expect(clamp(1, 10, 20)).to.equal(10);
			expect(clamp(-21, -20, -10)).to.equal(-20);
		});

		it("should return maximum if given value is higher", () => {
			expect(clamp(21, 10, 20)).to.equal(20);
			expect(clamp(-9, -20, -10)).to.equal(-10);
		});
	});

	describe("extend", () => {
		it("should add properties to an object", () => {
			const obj = { a: 1 };
			extend(obj, { b: 2 });
			expect(obj).to.deep.equal({ a: 1, b: 2 });
		});

		it("should replace an object's existing properties", () => {
			const obj = { a: 1, b: 2 };
			extend(obj, { b: 3 });
			expect(obj).to.deep.equal({ a: 1, b: 3 });
		});
	});

	describe("isInAscendingOrder", () => {
		it("should accept an empty array", () => {
			expect(isInAscendingOrder([])).to.equal(true);
		});

		it("should accept a sorted array", () => {
			expect(isInAscendingOrder([1, 2, 3, 4])).to.equal(true);
		});

		it("should reject an array with duplicate values", () => {
			expect(isInAscendingOrder([1, 1, 2, 3])).to.equal(false);
		});

		it("should reject an array in the wrong order", () => {
			expect(isInAscendingOrder([4, 3, 2, 1])).to.equal(false);
		});
	});

	describe("isValidTime", () => {
		it("should accept valid numbers", () => {
			expect(isValidTime(1.0)).to.equal(true);
			expect(isValidTime(-1.0)).to.equal(true);
		});

		it("should reject strings", () => {
			expect(isValidTime("1.0")).to.equal(false);
			expect(isValidTime("test")).to.equal(false);
		});

		it("should reject invalid numbers", () => {
			expect(isValidTime(Infinity)).to.equal(false);
			expect(isValidTime(-Infinity)).to.equal(false);
			expect(isValidTime(NaN)).to.equal(false);
		});

		it("should reject other non-numeric values", () => {
			expect(isValidTime(null)).to.equal(false);
			expect(isValidTime(undefined)).to.equal(false);
			expect(isValidTime({})).to.equal(false);
			expect(isValidTime([])).to.equal(false);
			expect(isValidTime(function foo() {})).to.equal(false);
		});
	});

	describe("isObject", () => {
		it("should accept objects", () => {
			expect(isObject({})).to.equal(true);
		});

		it("should reject functions", () => {
			expect(isObject(function foo() {})).to.equal(false);
		});

		it("should reject arrays", () => {
			expect(isObject([])).to.equal(false);
		});

		it("should reject other non-object values", () => {
			expect(isObject(null)).to.equal(false);
			expect(isObject(undefined)).to.equal(false);
			expect(isObject("test")).to.equal(false);
			expect(isObject(1.0)).to.equal(false);
		});
	});

	describe("isString", () => {
		it("should accept strings", () => {
			expect(isString("")).to.equal(true);
			expect(isString("test")).to.equal(true);
		});

		it("should reject numbers", () => {
			expect(isString(1.0)).to.equal(false);
			expect(isString(-1.0)).to.equal(false);
		});

		it("should reject non-string values", () => {
			expect(isString(null)).to.equal(false);
			expect(isString(undefined)).to.equal(false);
			expect(isString({})).to.equal(false);
			expect(isString([])).to.equal(false);
			expect(isString(function foo() {})).to.equal(false);
		});
	});

	describe("isNullOrUndefined", () => {
		it("should accept null or undefined", () => {
			expect(isNullOrUndefined(null)).to.equal(true);
			expect(isNullOrUndefined(undefined)).to.equal(true);
		});

		it("should reject other values", () => {
			expect(isNullOrUndefined("")).to.equal(false);
			expect(isNullOrUndefined(0)).to.equal(false);
			expect(isNullOrUndefined({})).to.equal(false);
			expect(isNullOrUndefined([])).to.equal(false);
			expect(isNullOrUndefined(function foo() {})).to.equal(false);
		});
	});

	describe("isFinite", () => {
		it("should accept finite numbers", () => {
			expect(isFiniteValue(1.0)).to.equal(true);
		});

		it("should reject non-finite numbers", () => {
			expect(isFiniteValue(Infinity)).to.equal(false);
			expect(isFiniteValue(-Infinity)).to.equal(false);
			expect(isFiniteValue(NaN)).to.equal(false);
		});

		it("should reject non-numbers", () => {
			expect(isFiniteValue("a")).to.equal(false);
			expect(isFiniteValue(null)).to.equal(false);
			expect(isFiniteValue(undefined)).to.equal(false);
		});
	});

	describe("isFunction", () => {
		it("should accept functions", () => {
			expect(isFunction(function foo() {})).to.equal(true);
		});

		it("should reject other values", () => {
			expect(isFunction(null)).to.equal(false);
			expect(isFunction(undefined)).to.equal(false);
			expect(isFunction("")).to.equal(false);
			expect(isFunction(0)).to.equal(false);
			expect(isFunction({})).to.equal(false);
			expect(isFunction([])).to.equal(false);
		});
	});

	describe("isLinearGradientColor", () => {
		it("should accept valid linear gradient object", () => {
			expect(
				isLinearGradientColor({
					linearGradientStart: 0,
					linearGradientEnd: 100,
					linearGradientColorStops: ["red", "blue"],
				}),
			).to.equal(true);
		});

		it("should reject invalid gradient values", () => {
			expect(
				isLinearGradientColor({
					linearGradientStart: 0,
					linearGradientEnd: 100,
					linearGradientColorStops: ["red"],
				}),
			).to.equal(false);

			expect(
				isLinearGradientColor({
					linearGradientStart: "0",
					linearGradientEnd: "100",
					linearGradientColorStops: ["red"],
				}),
			).to.equal(false);

			expect(
				isLinearGradientColor({
					linearGradientStart: 0,
					linearGradientColorStops: ["red", "blue"],
				}),
			).to.equal(false);

			expect(
				isLinearGradientColor({
					linearGradientEnd: 100,
					linearGradientColorStops: ["red", "blue"],
				}),
			).to.equal(false);
		});

		it("should reject other values", () => {
			expect(isLinearGradientColor("red")).to.equal(false);
			expect(isLinearGradientColor("#fff")).to.equal(false);
			expect(isLinearGradientColor(123)).to.equal(false);
			expect(isLinearGradientColor(["red", "blue"])).to.equal(false);
		});
	});
});
