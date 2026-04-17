import CustomPointMarker from "./custom-point-marker";
import CustomSegmentMarker from "./custom-segment-marker";
import SimplePointMarker from "./simple-point-marker";

interface MarkerLayer {
	getHeight(): number;
}

interface PointMarkerFactoryOptions {
	view: string;
	color: string;
	point: {
		labelText: string;
	};
	layer: MarkerLayer;
}

interface SegmentMarkerFactoryOptions {
	view: string;
	color: string;
	segment: {
		labelText: string;
	};
	startMarker: boolean;
	layer: MarkerLayer;
}

export function createPointMarker(
	options: PointMarkerFactoryOptions,
): CustomPointMarker | SimplePointMarker {
	if (options.view === "zoomview") {
		return new CustomPointMarker(options);
	}

	return new SimplePointMarker(options);
}

export function createSegmentMarker(
	options: SegmentMarkerFactoryOptions,
): CustomSegmentMarker | null {
	if (options.view === "zoomview") {
		return new CustomSegmentMarker(options);
	}

	return null;
}
