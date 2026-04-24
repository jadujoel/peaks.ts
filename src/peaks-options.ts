import { err, ok, type Result } from "neverthrow";
import { KonvaCanvasDriver } from "./driver/konva/driver";
import {
	createPointMarker,
	createSegmentLabel,
	createSegmentMarker,
} from "./marker-factories";
import type {
	OverviewOptions,
	PeaksConfiguration,
	PeaksOptions,
	ScrollbarDisplayOptions,
	SegmentDisplayOptions,
	WebAudioOptions,
	ZoomviewOptions,
} from "./types";
import {
	extend,
	isFunction,
	isHTMLElement,
	isInAscendingOrder,
	isObject,
	objectHasProperty,
	type Writable,
} from "./utils";

export const defaultViewOptions = {
	axisBottomMarkerHeight: 10,
	axisGridlineColor: "#cccccc",
	axisLabelColor: "#aaaaaa",
	axisTopMarkerHeight: 10,
	enablePoints: true,
	enableSegments: true,
	fontFamily: "sans-serif",
	fontSize: 11,
	fontStyle: "normal",
	playheadBackgroundColor: "transparent",
	playheadColor: "#111111",
	playheadPadding: 2,
	playheadTextColor: "#aaaaaa",
	playheadWidth: 1,
	showAxisLabels: true,
	timeLabelPrecision: 2,
} as const;

export const defaultZoomviewOptions = {
	autoScroll: true,
	autoScrollOffset: 100,
	enableEditing: true,
	playheadClickTolerance: 3,
	waveformColor: "rgba(0, 225, 128, 1)",
	wheelMode: "none",
} as const;

const defaultOverviewOptions = {
	enableEditing: false,
	highlightColor: "#aaaaaa",
	highlightCornerRadius: 2,
	highlightOffset: 11,
	highlightOpacity: 0.3,
	highlightStrokeColor: "transparent",
	waveformColor: "rgba(0, 0, 0, 0.2)",
} as const;

const defaultSegmentOptions = {
	endMarkerColor: "#aaaaaa",
	markers: true,
	overlay: false,
	overlayBorderColor: "#ff0000",
	overlayBorderWidth: 2,
	overlayColor: "#ff0000",
	overlayCornerRadius: 5,
	overlayFontFamily: "sans-serif",
	overlayFontSize: 12,
	overlayFontStyle: "normal",
	overlayLabelAlign: "left",
	overlayLabelColor: "#000000",
	overlayLabelPadding: 8,
	overlayLabelVerticalAlign: "top",
	overlayOffset: 25,
	overlayOpacity: 0.3,
	startMarkerColor: "#aaaaaa",
	waveformColor: "#0074d9",
} as const;

const defaultScrollbarOptions = {
	color: "#888888",
	minWidth: 50,
} as const;

function createDefaultOptions(): PeaksOptions {
	return {
		audio: undefined,
		createPointMarker: createPointMarker,
		createSegmentLabel: createSegmentLabel,
		createSegmentMarker: createSegmentMarker,
		dataUri: undefined,
		driver: KonvaCanvasDriver.default(),
		logger: (...args: unknown[]) => {
			console.error(...args);
		},
		mediaElement: undefined,
		mediaUrl: undefined,
		nudgeIncrement: 1.0,
		pointMarkerColor: "#39cccc",
		waveformCache: true,
		waveformData: undefined,
		webAudio: undefined,
		withCredentials: false,
		zoomLevels: [512, 1024, 2048, 4096],
	} as unknown as PeaksOptions;
}

export function getOverviewOptions(
	options: PeaksConfiguration,
): OverviewOptions {
	const overviewOptions: Record<string, unknown> = {};

	if (options.overview?.showPlayheadTime) {
		overviewOptions.showPlayheadTime = options.overview.showPlayheadTime;
	}

	const optNames = [
		"container",
		"waveformColor",
		"playedWaveformColor",
		"playheadColor",
		"playheadTextColor",
		"playheadBackgroundColor",
		"playheadPadding",
		"playheadWidth",
		"formatPlayheadTime",
		"timeLabelPrecision",
		"axisGridlineColor",
		"showAxisLabels",
		"axisTopMarkerHeight",
		"axisBottomMarkerHeight",
		"axisLabelColor",
		"formatAxisTime",
		"fontFamily",
		"fontSize",
		"fontStyle",
		"highlightColor",
		"highlightStrokeColor",
		"highlightOpacity",
		"highlightCornerRadius",
		"highlightOffset",
		"enablePoints",
		"enableSegments",
		"enableEditing",
	] as const;

	const overviewDefaults = defaultOverviewOptions as Record<string, unknown>;
	const viewDefaults = defaultViewOptions as Record<string, unknown>;
	const userOverview = options.overview as Record<string, unknown> | undefined;
	const userOpts = options as unknown as Record<string, unknown>;

	for (const optName of optNames) {
		if (userOverview && objectHasProperty(userOverview, optName)) {
			overviewOptions[optName] = userOverview[optName];
		} else if (objectHasProperty(userOpts, optName)) {
			overviewOptions[optName] = userOpts[optName];
		} else if (!objectHasProperty(overviewOptions, optName)) {
			if (objectHasProperty(overviewDefaults, optName)) {
				overviewOptions[optName] = overviewDefaults[optName];
			} else if (objectHasProperty(viewDefaults, optName)) {
				overviewOptions[optName] = viewDefaults[optName];
			}
		}
	}

	return overviewOptions as unknown as OverviewOptions;
}

export function getZoomviewOptions(opts: PeaksConfiguration): ZoomviewOptions {
	const zoomviewOptions: Record<string, unknown> = {};

	if (opts.showPlayheadTime) {
		zoomviewOptions.showPlayheadTime = opts.showPlayheadTime;
	} else if (opts.zoomview?.showPlayheadTime) {
		zoomviewOptions.showPlayheadTime = opts.zoomview.showPlayheadTime;
	}

	const optNames = [
		"container",
		"waveformColor",
		"playedWaveformColor",
		"playheadColor",
		"playheadTextColor",
		"playheadBackgroundColor",
		"playheadPadding",
		"playheadWidth",
		"formatPlayheadTime",
		"playheadClickTolerance",
		"timeLabelPrecision",
		"axisGridlineColor",
		"showAxisLabels",
		"axisTopMarkerHeight",
		"axisBottomMarkerHeight",
		"axisLabelColor",
		"formatAxisTime",
		"fontFamily",
		"fontSize",
		"fontStyle",
		"wheelMode",
		"autoScroll",
		"autoScrollOffset",
		"enablePoints",
		"enableSegments",
		"enableEditing",
	] as const;

	const zoomviewDefaults = defaultZoomviewOptions as Record<string, unknown>;
	const viewDefaults = defaultViewOptions as Record<string, unknown>;
	const userZoomview = opts.zoomview as Record<string, unknown> | undefined;
	const userOpts = opts as unknown as Record<string, unknown>;

	for (const optName of optNames) {
		if (userZoomview && objectHasProperty(userZoomview, optName)) {
			zoomviewOptions[optName] = userZoomview[optName];
		} else if (objectHasProperty(userOpts, optName)) {
			zoomviewOptions[optName] = userOpts[optName];
		} else if (!objectHasProperty(zoomviewOptions, optName)) {
			if (objectHasProperty(zoomviewDefaults, optName)) {
				zoomviewOptions[optName] = zoomviewDefaults[optName];
			} else if (objectHasProperty(viewDefaults, optName)) {
				zoomviewOptions[optName] = viewDefaults[optName];
			}
		}
	}

	return zoomviewOptions as unknown as ZoomviewOptions;
}

function getScrollbarOptions(
	opts: PeaksConfiguration,
): ScrollbarDisplayOptions | undefined {
	const scrollbar = opts.scrollbar;

	if (!scrollbar) {
		return undefined;
	}

	return {
		color: scrollbar.color ?? defaultScrollbarOptions.color,
		...(scrollbar.container ? { container: scrollbar.container } : {}),
		minWidth: scrollbar.minWidth ?? defaultScrollbarOptions.minWidth,
	} as ScrollbarDisplayOptions;
}

export function extendOptions(
	to: Record<string, unknown>,
	from: Record<string, unknown>,
) {
	for (const key in from) {
		if (objectHasProperty(from, key) && objectHasProperty(to, key)) {
			to[key] = from[key];
		}
	}

	return to;
}

export function addSegmentOptions(
	options: Writable<PeaksOptions>,
	opts: PeaksConfiguration,
) {
	options.segmentOptions = {} as SegmentDisplayOptions;

	extend(
		options.segmentOptions as unknown as Record<string, unknown>,
		defaultSegmentOptions as unknown as Record<string, unknown>,
	);

	if (opts.segmentOptions) {
		extendOptions(
			options.segmentOptions as unknown as Record<string, unknown>,
			opts.segmentOptions as unknown as Record<string, unknown>,
		);
	}

	const zoomview = options.zoomview as Writable<ZoomviewOptions>;
	zoomview.segmentOptions = {} as SegmentDisplayOptions;
	extend(
		zoomview.segmentOptions as unknown as Record<string, unknown>,
		options.segmentOptions as unknown as Record<string, unknown>,
	);

	if (opts.zoomview?.segmentOptions) {
		extendOptions(
			zoomview.segmentOptions as unknown as Record<string, unknown>,
			opts.zoomview.segmentOptions as unknown as Record<string, unknown>,
		);
	}

	const overview = options.overview as Writable<OverviewOptions>;
	overview.segmentOptions = {} as SegmentDisplayOptions;
	extend(
		overview.segmentOptions as unknown as Record<string, unknown>,
		options.segmentOptions as unknown as Record<string, unknown>,
	);

	if (opts.overview?.segmentOptions) {
		extendOptions(
			overview.segmentOptions as unknown as Record<string, unknown>,
			opts.overview.segmentOptions as unknown as Record<string, unknown>,
		);
	}
}

export function checkContainerElements(
	options: PeaksOptions,
): Error | undefined {
	const zoomviewContainer = options.zoomview.container;
	const overviewContainer = options.overview.container;

	if (!isHTMLElement(zoomviewContainer) && !isHTMLElement(overviewContainer)) {
		return new TypeError(
			"The zoomview and/or overview container options must be valid HTML elements",
		);
	}

	if (
		zoomviewContainer &&
		(zoomviewContainer.clientWidth <= 0 || zoomviewContainer.clientHeight <= 0)
	) {
		return new Error(
			"The zoomview container must be visible and have non-zero width and height",
		);
	}

	if (
		overviewContainer &&
		(overviewContainer.clientWidth <= 0 || overviewContainer.clientHeight <= 0)
	) {
		return new Error(
			"The overview container must be visible and have non-zero width and height",
		);
	}

	return undefined;
}

export function validateScrollbarContainer(
	options: PeaksOptions,
): Result<HTMLDivElement | undefined, Error> {
	if (!options.scrollbar) {
		return ok(undefined);
	}

	const scrollbarContainer = options.scrollbar.container;

	if (!isHTMLElement(scrollbarContainer)) {
		return err(
			new TypeError(
				"The scrollbar container option must be a valid HTML element",
			),
		);
	}

	if (scrollbarContainer.clientWidth <= 0) {
		return err(
			new TypeError(
				"The scrollbar container must be visible and have non-zero width",
			),
		);
	}

	return ok(scrollbarContainer);
}

/**
 * Validates `config` and produces a fully-resolved {@link PeaksOptions}
 * with defaults applied. Returns an `err` for invalid inputs.
 */
export function resolvePeaksOptions(
	config: PeaksConfiguration,
): Result<PeaksOptions, Error> {
	if (!isObject(config)) {
		return err(new TypeError("The options parameter should be an object"));
	}

	if (!config.audio) {
		const webAudio = config.webAudio as WebAudioOptions | undefined;
		const hasAudioContextSource =
			(config.audioContext ?? webAudio?.context) !== undefined &&
			(webAudio?.buffer !== undefined || typeof config.mediaUrl === "string");

		if (!config.mediaElement && !hasAudioContextSource) {
			return err(
				new Error(
					"Provide one of: mediaElement, audio driver, or audioContext with audioBuffer/mediaUrl",
				),
			);
		}

		if (
			config.mediaElement &&
			!(config.mediaElement instanceof HTMLMediaElement)
		) {
			return err(
				new TypeError("The mediaElement option should be an HTMLMediaElement"),
			);
		}
	}

	if (config.logger && !isFunction(config.logger)) {
		return err(new TypeError("The logger option should be a function"));
	}

	if (config.segments && !Array.isArray(config.segments)) {
		return err(
			new TypeError("options.segments must be an array of segment objects"),
		);
	}

	if (config.points && !Array.isArray(config.points)) {
		return err(
			new TypeError("options.points must be an array of point objects"),
		);
	}

	const options = createDefaultOptions() as Writable<PeaksOptions>;

	extendOptions(
		options as unknown as Record<string, unknown>,
		config as unknown as Record<string, unknown>,
	);

	options.overview = getOverviewOptions(config);
	options.zoomview = getZoomviewOptions(config);

	const scrollbarOptions = getScrollbarOptions(config);
	if (scrollbarOptions) {
		options.scrollbar = scrollbarOptions;
	}

	addSegmentOptions(options, config);

	if (!Array.isArray(options.zoomLevels)) {
		return err(new TypeError("The zoomLevels option should be an array"));
	}
	if (options.zoomLevels.length === 0) {
		return err(new Error("The zoomLevels array must not be empty"));
	}
	if (!isInAscendingOrder(options.zoomLevels)) {
		return err(
			new Error("The zoomLevels array must be sorted in ascending order"),
		);
	}

	return ok(options as PeaksOptions);
}
