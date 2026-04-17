import { Text } from "konva/lib/shapes/Text";
import DefaultPointMarker from "./default-point-marker";
import DefaultSegmentMarker from "./default-segment-marker";

/**
 * Creates a left or right side segment marker handle.
 *
 * @param {CreateSegmentMarkerOptions} options
 * @returns {Marker}
 */

export function createSegmentMarker(options: any): any {
	if (options.view === "zoomview") {
		return new DefaultSegmentMarker(options);
	}

	return null;
}

/**
 * Creates a Konva object that renders information about a segment, such as
 * its label text.
 *
 * @param {SegmentLabelOptions} options
 * @returns {Konva.Text}
 */

export function createSegmentLabel(options: any): Text {
	return new Text({
		x: 12,
		y: 12,
		text: options.segment.labelText,
		textAlign: "center",
		fontFamily: options.fontFamily || "sans-serif",
		fontSize: options.fontSize || 12,
		fontStyle: options.fontStyle || "normal",
		fill: "#000",
	});
}

/**
 * Creates a point marker handle.
 *
 * @param {CreatePointMarkerOptions} options
 * @returns {Marker}
 */

export function createPointMarker(options: any): any {
	return new DefaultPointMarker(options);
}
