/**
 * Typed DOM lookup helpers. Throw when the element is missing or the
 * runtime type does not match the requested constructor — this catches
 * HTML/JS drift early during development.
 */

export function byId<T extends HTMLElement>(
	id: string,
	ctor: { new (): T; readonly prototype: T },
): T {
	const element = document.getElementById(id);
	if (!element) {
		throw new Error(`element #${id} not found`);
	}
	if (!(element instanceof ctor)) {
		throw new Error(`element #${id} is not a ${ctor.name}`);
	}
	return element;
}

export function input(id: string): HTMLInputElement {
	return byId(id, HTMLInputElement);
}

export function select(id: string): HTMLSelectElement {
	return byId(id, HTMLSelectElement);
}

export function output(id: string): HTMLOutputElement {
	return byId(id, HTMLOutputElement);
}

export function div(id: string): HTMLDivElement {
	return byId(id, HTMLDivElement);
}

export function button(id: string): HTMLButtonElement {
	return byId(id, HTMLButtonElement);
}

export function table(id: string): HTMLTableElement {
	return byId(id, HTMLTableElement);
}
