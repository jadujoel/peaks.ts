import Konva from "konva/lib/Core";
import type { Node } from "konva/lib/Node";

export interface LinearGradientColor {
	linearGradientStart: number;
	linearGradientEnd: number;
	linearGradientColorStops: (string | number)[];
}

export type WaveformColor = string | LinearGradientColor;

export type Writable<T> = { -readonly [P in keyof T]: T[P] };

function zeroPad(number: number | string, precision: number): string {
	let str = number.toString();

	while (str.length < precision) {
		str = `0${str}`;
	}

	return str;
}

export function formatTime(time: number, precision: number): string {
	const parts: string[] = [];

	const fractionSeconds = Math.floor((time % 1) * 10 ** precision);
	const seconds = Math.floor(time);
	const minutes = Math.floor(seconds / 60);
	const hours = Math.floor(minutes / 60);

	if (hours > 0) {
		parts.push(zeroPad(hours, 2));
	}
	parts.push(zeroPad(minutes % 60, 2));
	parts.push(zeroPad(seconds % 60, 2));

	let result = parts.join(":");

	if (precision > 0) {
		result += `.${zeroPad(fractionSeconds, precision)}`;
	}

	return result;
}

export function roundUpToNearest(value: number, multiple: number): number {
	if (multiple === 0) {
		return 0;
	}

	let multiplier = 1;
	let v = value;

	if (v < 0.0) {
		multiplier = -1;
		v = -v;
	}

	const roundedUp = Math.ceil(v);

	return multiplier * (((roundedUp + multiple - 1) / multiple) | 0) * multiple;
}

export function clamp(value: number, min: number, max: number): number {
	if (value < min) {
		return min;
	} else if (value > max) {
		return max;
	} else {
		return value;
	}
}

export function objectHasProperty(object: object, field: PropertyKey): boolean {
	return Object.hasOwn(object, field);
}

export function extend<T extends Record<string, unknown>>(
	to: T,
	from: Record<string, unknown>,
): T {
	for (const key in from) {
		if (objectHasProperty(from, key)) {
			(to as Record<string, unknown>)[key] = from[key];
		}
	}

	return to;
}

export function isInAscendingOrder(array: number[]): boolean {
	if (array.length === 0) {
		return true;
	}

	let value = array[0] as number;

	for (let i = 1; i < array.length; i++) {
		const current = array[i] as number;

		if (value >= current) {
			return false;
		}

		value = current;
	}

	return true;
}

export function isNumber(value: unknown): value is number {
	return typeof value === "number";
}

export function isFinite(value: unknown): value is number {
	if (typeof value !== "number") {
		return false;
	}

	if (value !== value || value === Infinity || value === -Infinity) {
		return false;
	}

	return true;
}

export function isValidTime(value: unknown): value is number {
	return typeof value === "number" && Number.isFinite(value);
}

export function isObject(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function isString(value: unknown): value is string {
	return typeof value === "string";
}

export function isArrayBuffer(value: unknown): value is ArrayBuffer {
	return Object.prototype.toString.call(value).includes("ArrayBuffer");
}

export function isNullOrUndefined(value: unknown): value is null | undefined {
	return value === undefined || value === null;
}

export function isFunction(
	value: unknown,
): value is (...args: unknown[]) => unknown {
	return typeof value === "function";
}

export function isBoolean(value: unknown): value is boolean {
	return value === true || value === false;
}

export function isHTMLElement(value: unknown): value is HTMLElement {
	return value instanceof HTMLElement;
}

export function isArray(value: unknown): value is unknown[] {
	return Array.isArray(value);
}

export function isLinearGradientColor(
	value: unknown,
): value is LinearGradientColor {
	return (
		isObject(value) &&
		objectHasProperty(value, "linearGradientStart") &&
		objectHasProperty(value, "linearGradientEnd") &&
		objectHasProperty(value, "linearGradientColorStops") &&
		isNumber(value.linearGradientStart) &&
		isNumber(value.linearGradientEnd) &&
		isArray(value.linearGradientColorStops) &&
		value.linearGradientColorStops.length === 2
	);
}

export function getMarkerObject(obj: Node): Node | undefined {
	let current: Node | undefined = obj;

	while (current?.parent !== null && current?.parent !== undefined) {
		if (current.parent instanceof Konva.Layer) {
			return current;
		}

		current = current.parent;
	}

	return undefined;
}
