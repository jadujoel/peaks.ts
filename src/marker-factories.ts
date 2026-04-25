import { DefaultPointMarker } from "./default-point-marker";
import { DefaultSegmentMarker } from "./default-segment-marker";
import { PeaksNode } from "./peaks-node";
import type {
	CreatePointMarkerOptions,
	CreateSegmentLabelOptions,
	CreateSegmentMarkerOptions,
	Marker,
} from "./types";

/**
 * Creates a left or right side segment marker handle.
 */

export function createSegmentMarker(
	options: CreateSegmentMarkerOptions,
): Marker | undefined {
	if (options.view === "zoomview") {
		return DefaultSegmentMarker.from({ options });
	}

	return undefined;
}

/**
 * Creates a node that renders information about a segment, such as
 * its label text.
 */

export function createSegmentLabel(
	options: CreateSegmentLabelOptions,
): PeaksNode {
	const node = options.layer.getDriver().createText({
		fill: options.color ?? "#000",
		fontFamily: options.fontFamily ?? "sans-serif",
		fontSize: options.fontSize ?? 12,
		fontStyle: options.fontStyle ?? "normal",
		text: options.segment?.labelText ?? "",
		textAlign: "center",
		x: 12,
		y: 12,
	});
	return PeaksNode.from(node);
}

/**
 * Creates a point marker handle.
 */

export function createPointMarker(options: CreatePointMarkerOptions): Marker {
	return DefaultPointMarker.from({ options });
}
