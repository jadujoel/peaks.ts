import { Text } from "konva/lib/shapes/Text";
import { PeaksNode } from "../peaks.esm.js";

interface SegmentLabelOptions {
	view: string;
	segment: {
		labelText: string;
	};
}

export function createSegmentLabel(
	options: SegmentLabelOptions,
): PeaksNode | null {
	if (options.view === "overview") {
		return null;
	}

	return PeaksNode.from(
		new Text({
			fill: "white",
			fontFamily: "Calibri",
			fontSize: 14,
			padding: 8,
			text: options.segment.labelText,
			x: 12,
			y: 16,
		}) as unknown as Record<string, unknown>,
	);
}
