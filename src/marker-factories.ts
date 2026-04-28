import { DefaultPointMarker } from "./default-point-marker";
import { PeaksNode } from "./peaks-node";
import type {
	CreatePointMarkerOptions,
	CreateSegmentLabelOptions,
	Marker,
} from "./types";

/**
 * Creates a node that renders information about a segment, such as
 * its label text.
 */

export function createSegmentLabel(
	options: CreateSegmentLabelOptions,
): PeaksNode {
	const node = options.layer.getDriver().createText({
		fill: options.color ?? "#ffffff",
		fontFamily: options.fontFamily ?? "sans-serif",
		fontSize: options.fontSize ?? 12,
		fontStyle: options.fontStyle ?? "normal",
		text: options.segment?.labelText ?? "",
		textAlign: "center",
		// SegmentShape positions the label horizontally to track the
		// segment's start offset; we keep a small vertical padding here.
		x: 0,
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
