import CustomPointMarker from "./custom-point-marker";
import CustomSegmentMarker from "./custom-segment-marker";
import SimplePointMarker from "./simple-point-marker";

export function createPointMarker(options) {
	if (options.view === "zoomview") {
		return new CustomPointMarker(options);
	} else {
		return new SimplePointMarker(options);
	}
}

export function createSegmentMarker(options) {
	if (options.view === "zoomview") {
		return new CustomSegmentMarker(options);
	}

	return null;
}
