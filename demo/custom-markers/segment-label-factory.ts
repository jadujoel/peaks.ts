import { Label, Tag } from "konva/lib/shapes/Label";
import { Text } from "konva/lib/shapes/Text";

interface SegmentLabelOptions {
	view: string;
	segment: {
		labelText: string;
	};
}

export function createSegmentLabel(options: SegmentLabelOptions): Label | null {
	if (options.view === "overview") {
		return null;
	}

	const label = new Label({
		x: 12,
		y: 16,
	});

	label.add(
		new Tag({
			fill: "black",
			pointerDirection: "none",
			shadowBlur: 10,
			shadowColor: "black",
			shadowOffsetX: 3,
			shadowOffsetY: 3,
			shadowOpacity: 0.3,
		}),
	);

	label.add(
		new Text({
			fill: "white",
			fontFamily: "Calibri",
			fontSize: 14,
			padding: 8,
			text: options.segment.labelText,
		}),
	);

	return label;
}
