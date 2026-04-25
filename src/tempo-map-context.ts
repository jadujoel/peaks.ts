import { type GridStep, snapTime, type TempoMap } from "./tempo-map";

export type SnapKind =
	| "segments"
	| "segmentMarkers"
	| "points"
	| "insertSegment";

export interface SnapFlags {
	readonly segments: boolean;
	readonly segmentMarkers: boolean;
	readonly points: boolean;
	readonly insertSegment: boolean;
}

export interface TempoMapContextFromOptions {
	readonly tempoMap?: TempoMap;
	readonly gridStep?: GridStep;
	readonly snapStep?: GridStep;
	readonly snapFlags?: Partial<SnapFlags>;
	readonly onChange?: () => void;
	readonly onSnap?: (event: SnapEvent) => void;
}

export interface SnapEvent {
	readonly kind: SnapKind;
	readonly rawTime: number;
	readonly snappedTime: number;
}

export const DEFAULT_GRID_STEP: GridStep = "1/4";

const DEFAULT_FLAGS: SnapFlags = {
	insertSegment: false,
	points: false,
	segmentMarkers: false,
	segments: false,
};

/**
 * Mutable container shared by the grid layer and snap-aware drag bound
 * functions. Setters mutate fields in place so callers can keep a single
 * reference to the same instance across the view tree.
 */
export class TempoMapContext {
	private readonly changeListeners = new Set<() => void>();
	private readonly snapListeners = new Set<(event: SnapEvent) => void>();

	private constructor(
		private map: TempoMap | undefined,
		private gridStep: GridStep,
		private snapStep: GridStep | undefined,
		private snapFlags: SnapFlags,
	) {}

	static from(options: TempoMapContextFromOptions = {}): TempoMapContext {
		const flags: SnapFlags = {
			...DEFAULT_FLAGS,
			...(options.snapFlags ?? {}),
		};
		const ctx = new TempoMapContext(
			options.tempoMap,
			options.gridStep ?? DEFAULT_GRID_STEP,
			options.snapStep,
			flags,
		);
		if (options.onChange) ctx.addChangeListener(options.onChange);
		if (options.onSnap) ctx.addSnapListener(options.onSnap);
		return ctx;
	}

	getTempoMap(): TempoMap | undefined {
		return this.map;
	}

	setTempoMap(map: TempoMap | undefined): void {
		this.map = map;
		this.notifyChange();
	}

	getGridStep(): GridStep {
		return this.gridStep;
	}

	setGridStep(step: GridStep): void {
		this.gridStep = step;
		this.notifyChange();
	}

	getSnapStep(): GridStep {
		return this.snapStep ?? this.gridStep;
	}

	setSnapStep(step: GridStep | undefined): void {
		this.snapStep = step;
		this.notifyChange();
	}

	isSnapEnabled(kind: SnapKind): boolean {
		return this.snapFlags[kind];
	}

	setSnapEnabled(kind: SnapKind, enabled: boolean): void {
		this.snapFlags = { ...this.snapFlags, [kind]: enabled };
	}

	addChangeListener(handler: () => void): () => void {
		this.changeListeners.add(handler);
		return () => this.changeListeners.delete(handler);
	}

	addSnapListener(handler: (event: SnapEvent) => void): () => void {
		this.snapListeners.add(handler);
		return () => this.snapListeners.delete(handler);
	}

	/**
	 * Resolve the snapped time for a drag event. `override` is the
	 * per-entity `snap` flag; when defined it wins over the context flag.
	 * Returns `rawTime` unchanged when snap is disabled or no map is set.
	 */
	snapTimeFor(kind: SnapKind, rawTime: number, override?: boolean): number {
		const enabled = override ?? this.snapFlags[kind];
		if (!enabled || !this.map) {
			return rawTime;
		}
		const snapped = snapTime(this.map, this.getSnapStep(), rawTime);
		if (snapped !== rawTime) {
			for (const listener of this.snapListeners) {
				listener({ kind, rawTime, snappedTime: snapped });
			}
		}
		return snapped;
	}

	private notifyChange(): void {
		for (const listener of this.changeListeners) {
			listener();
		}
	}
}
