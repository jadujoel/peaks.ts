import type { XY } from "./driver/types";
import type { SnapKind, TempoMapContext } from "./tempo-map-context";
import type { WaveformViewAPI } from "./types";

export interface SnappingDragBoundOptions {
	readonly view: WaveformViewAPI;
	readonly context: TempoMapContext | undefined;
	readonly kind: SnapKind;
	readonly inner: (pos: XY) => XY;
	readonly getOverride?: () => boolean | undefined;
}

/**
 * Wraps an existing pixel-space drag-bound function with snap-to-grid
 * behaviour. The wrapper invokes `inner` first (to apply existing
 * constraints) and then re-aligns the bounded `x` to the nearest grid
 * lattice point when snap is enabled.
 */
export function snappingDragBound(
	options: SnappingDragBoundOptions,
): (pos: XY) => XY {
	const { context, getOverride, inner, kind, view } = options;
	if (!context) {
		return inner;
	}
	return (pos: XY): XY => {
		const bounded = inner(pos);
		const override = getOverride?.();
		const rawTime = view.pixelOffsetToTime(bounded.x);
		const snapped = context.snapTimeFor(kind, rawTime, override);
		if (snapped === rawTime) {
			return bounded;
		}
		return { ...bounded, x: view.timeToPixelOffset(snapped) };
	};
}
