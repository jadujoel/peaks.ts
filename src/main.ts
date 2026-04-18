import EventEmitter from "eventemitter3";
import type WaveformData from "waveform-data";
import CueEmitter from "./cue-emitter";
import KeyboardHandler from "./keyboard-handler";
import {
	createPointMarker,
	createSegmentLabel,
	createSegmentMarker,
} from "./marker-factories";
import MediaElementPlayer from "./mediaelement-player";
import Player from "./player";
import type {
	Logger,
	PeaksInitOptions,
	PeaksInstance,
	PeaksOptions,
	PlayerAdapter,
	SegmentDisplayOptions,
	SetSourceOptions,
} from "./types";
import {
	extend,
	isFunction,
	isHTMLElement,
	isInAscendingOrder,
	isObject,
	objectHasProperty,
} from "./utils";
import ViewController from "./view-controller";
import WaveformBuilder from "./waveform-builder";
import WaveformPoints from "./waveform-points";
import WaveformSegments from "./waveform-segments";
import ZoomController from "./zoom-controller";

const defaultViewOptions: Record<string, unknown> = {
	playheadColor: "#111111",
	playheadTextColor: "#aaaaaa",
	playheadBackgroundColor: "transparent",
	playheadPadding: 2,
	playheadWidth: 1,
	axisGridlineColor: "#cccccc",
	showAxisLabels: true,
	axisTopMarkerHeight: 10,
	axisBottomMarkerHeight: 10,
	axisLabelColor: "#aaaaaa",
	fontFamily: "sans-serif",
	fontSize: 11,
	fontStyle: "normal",
	timeLabelPrecision: 2,
	enablePoints: true,
	enableSegments: true,
};

const defaultZoomviewOptions: Record<string, unknown> = {
	// showPlayheadTime:    true,
	playheadClickTolerance: 3,
	waveformColor: "rgba(0, 225, 128, 1)",
	wheelMode: "none",
	autoScroll: true,
	autoScrollOffset: 100,
	enableEditing: true,
};

const defaultOverviewOptions: Record<string, unknown> = {
	// showPlayheadTime:    false,
	waveformColor: "rgba(0, 0, 0, 0.2)",
	highlightColor: "#aaaaaa",
	highlightStrokeColor: "transparent",
	highlightOpacity: 0.3,
	highlightOffset: 11,
	highlightCornerRadius: 2,
	enableEditing: false,
};

const defaultSegmentOptions: Record<string, unknown> = {
	overlay: false,
	markers: true,
	startMarkerColor: "#aaaaaa",
	endMarkerColor: "#aaaaaa",
	waveformColor: "#0074d9",
	overlayColor: "#ff0000",
	overlayOpacity: 0.3,
	overlayBorderColor: "#ff0000",
	overlayBorderWidth: 2,
	overlayCornerRadius: 5,
	overlayOffset: 25,
	overlayLabelAlign: "left",
	overlayLabelVerticalAlign: "top",
	overlayLabelPadding: 8,
	overlayLabelColor: "#000000",
	overlayFontFamily: "sans-serif",
	overlayFontSize: 12,
	overlayFontStyle: "normal",
};

const defaultScrollbarOptions: Record<string, unknown> = {
	color: "#888888",
	minWidth: 50,
};

function getOverviewOptions(opts: PeaksInitOptions) {
	const overviewOptions: Record<string, unknown> = {};

	if (opts.overview?.showPlayheadTime) {
		overviewOptions.showPlayheadTime = opts.overview.showPlayheadTime;
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
	];

	optNames.forEach((optName) => {
		if (opts.overview && objectHasProperty(opts.overview, optName)) {
			overviewOptions[optName] = opts.overview[optName];
		} else if (objectHasProperty(opts, optName)) {
			overviewOptions[optName] = opts[optName];
		} else if (!objectHasProperty(overviewOptions, optName)) {
			if (objectHasProperty(defaultOverviewOptions, optName)) {
				overviewOptions[optName] = defaultOverviewOptions[optName];
			} else if (objectHasProperty(defaultViewOptions, optName)) {
				overviewOptions[optName] = defaultViewOptions[optName];
			}
		}
	});

	return overviewOptions;
}

function getZoomviewOptions(opts: PeaksInitOptions) {
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
	];

	optNames.forEach((optName) => {
		if (opts.zoomview && objectHasProperty(opts.zoomview, optName)) {
			zoomviewOptions[optName] = opts.zoomview[optName];
		} else if (objectHasProperty(opts, optName)) {
			zoomviewOptions[optName] = opts[optName];
		} else if (!objectHasProperty(zoomviewOptions, optName)) {
			if (objectHasProperty(defaultZoomviewOptions, optName)) {
				zoomviewOptions[optName] = defaultZoomviewOptions[optName];
			} else if (objectHasProperty(defaultViewOptions, optName)) {
				zoomviewOptions[optName] = defaultViewOptions[optName];
			}
		}
	});

	return zoomviewOptions;
}

function getScrollbarOptions(opts: PeaksInitOptions) {
	const scrollbar = opts.scrollbar;

	if (!scrollbar) {
		return null;
	}

	const scrollbarOptions: Record<string, unknown> = {};

	const optNames = ["container", "color", "minWidth"];

	optNames.forEach((optName) => {
		if (objectHasProperty(scrollbar, optName)) {
			scrollbarOptions[optName] = scrollbar[optName];
		} else {
			scrollbarOptions[optName] = defaultScrollbarOptions[optName];
		}
	});

	return scrollbarOptions;
}

function extendOptions(
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

function addSegmentOptions(options: PeaksOptions, opts: PeaksInitOptions) {
	options.segmentOptions = {} as SegmentDisplayOptions;

	extend(options.segmentOptions, defaultSegmentOptions);

	if (opts.segmentOptions) {
		extendOptions(
			options.segmentOptions as unknown as Record<string, unknown>,
			opts.segmentOptions as unknown as Record<string, unknown>,
		);
	}

	options.zoomview.segmentOptions = {} as SegmentDisplayOptions;
	extend(options.zoomview.segmentOptions, options.segmentOptions);

	if (opts.zoomview?.segmentOptions) {
		extendOptions(
			options.zoomview.segmentOptions as unknown as Record<string, unknown>,
			opts.zoomview.segmentOptions as unknown as Record<string, unknown>,
		);
	}

	options.overview.segmentOptions = {} as SegmentDisplayOptions;
	extend(options.overview.segmentOptions, options.segmentOptions);

	if (opts.overview?.segmentOptions) {
		extendOptions(
			options.overview.segmentOptions as unknown as Record<string, unknown>,
			opts.overview.segmentOptions as unknown as Record<string, unknown>,
		);
	}
}

function checkContainerElements(options: PeaksOptions) {
	const zoomviewContainer = options.zoomview.container;
	const overviewContainer = options.overview.container;

	if (!isHTMLElement(zoomviewContainer) && !isHTMLElement(overviewContainer)) {
		return new TypeError(
			"Peaks.init(): The zoomview and/or overview container options must be valid HTML elements",
		);
	}

	if (
		zoomviewContainer &&
		(zoomviewContainer.clientWidth <= 0 || zoomviewContainer.clientHeight <= 0)
	) {
		return new Error(
			"Peaks.init(): The zoomview container must be visible and have non-zero width and height",
		);
	}

	if (
		overviewContainer &&
		(overviewContainer.clientWidth <= 0 || overviewContainer.clientHeight <= 0)
	) {
		return new Error(
			"Peaks.init(): The overview container must be visible and have non-zero width and height",
		);
	}
}

class Peaks extends EventEmitter {
	options: PeaksOptions;
	player!: Player;
	segments!: WaveformSegments;
	points!: WaveformPoints;
	zoom!: ZoomController;
	views!: ViewController;
	declare _logger: Logger;
	private _keyboardHandler: KeyboardHandler | null = null;
	private _waveformBuilder: WaveformBuilder | null = null;
	private _waveformData: WaveformData | null = null;
	declare _cueEmitter: CueEmitter | undefined;

	constructor() {
		super();

		// Set default options
		this.options = {
			zoomLevels: [512, 1024, 2048, 4096],
			waveformCache: true,

			mediaElement: null,
			mediaUrl: null,

			dataUri: null,
			withCredentials: false,

			waveformData: null,
			webAudio: null,

			nudgeIncrement: 1.0,

			pointMarkerColor: "#39cccc",

			createSegmentMarker: createSegmentMarker,
			createSegmentLabel: createSegmentLabel,
			createPointMarker: createPointMarker,

			// eslint-disable-next-line no-console
			logger: console.error.bind(console),
		} as PeaksOptions;
	}

	/**
	 * Initializes a Peaks instance and asynchronously builds its waveform views.
	 *
	 * @throws {Error} If the callback is missing.
	 * @throws {TypeError} If initialization reaches a player adapter that does not implement the required methods.
	 * @throws {Error} If invalid point or segment definitions are supplied and they fail validation during setup.
	 */
	static init(
		opts: PeaksInitOptions,
		callback: (err: Error | null, instance?: Peaks) => void,
	): undefined | never {
		if (!callback) {
			throw new Error("Peaks.init(): Missing callback function");
		}

		const instance = new Peaks();

		let err = instance._setOptions(opts);

		if (!err) {
			err = checkContainerElements(instance.options);
		}

		if (err) {
			callback(err);
			return;
		}

		let scrollbarContainer = null;

		if (instance.options.scrollbar) {
			scrollbarContainer = instance.options.scrollbar.container;

			if (!isHTMLElement(scrollbarContainer)) {
				callback(
					new TypeError(
						"Peaks.init(): The scrollbar container option must be a valid HTML element",
					),
				);
				return;
			}

			if (scrollbarContainer.clientWidth <= 0) {
				callback(
					new TypeError(
						"Peaks.init(): The scrollbar container must be visible and have non-zero width",
					),
				);
				return;
			}
		}

		if (opts.keyboard) {
			instance._keyboardHandler = new KeyboardHandler(
				instance as unknown as PeaksInstance,
			);
		}

		let player: PlayerAdapter;

		if (opts.player) {
			player = opts.player;
		} else if (instance.options.mediaElement) {
			player = new MediaElementPlayer(instance.options.mediaElement);
		} else {
			callback(new TypeError("Peaks.init(): Missing mediaElement option"));
			return;
		}

		instance.player = new Player(instance as unknown as PeaksInstance, player);
		instance.segments = new WaveformSegments(
			instance as unknown as PeaksInstance,
		);
		instance.points = new WaveformPoints(instance as unknown as PeaksInstance);
		instance.zoom = new ZoomController(
			instance as unknown as PeaksInstance,
			instance.options.zoomLevels,
		);
		instance.views = new ViewController(instance as unknown as PeaksInstance);

		// Setup the UI components
		instance._waveformBuilder = new WaveformBuilder(
			instance as unknown as PeaksInstance,
		);

		instance.player
			.init()
			.then(() => {
				instance._waveformBuilder?.init(
					instance.options,
					(err, waveformData) => {
						if (err) {
							callback(err);
							return;
						}

						const containerErr = checkContainerElements(instance.options);

						if (containerErr) {
							callback(containerErr);
							return;
						}

						instance._waveformBuilder = null;
						instance._waveformData = waveformData ?? null;

						const zoomviewContainer = instance.options.zoomview.container;
						const overviewContainer = instance.options.overview.container;

						if (zoomviewContainer) {
							instance.views.createZoomview(
								zoomviewContainer as HTMLDivElement,
							);
						}

						if (overviewContainer) {
							instance.views.createOverview(
								overviewContainer as HTMLDivElement,
							);
						}

						if (scrollbarContainer) {
							instance.views.createScrollbar(scrollbarContainer);
						}

						if (opts.segments) {
							instance.segments.add(opts.segments);
						}

						if (opts.points) {
							instance.points.add(opts.points);
						}

						if (opts.emitCueEvents) {
							instance._cueEmitter = new CueEmitter(
								instance as unknown as PeaksInstance,
							);
						}

						callback(null, instance);
					},
				);
			})
			.catch((err: Error) => {
				callback(err);
			});
	}

	/**
	 * Initializes a Peaks instance and resolves with it once the waveform views are ready.
	 */
	static fromOptionsAsync(opts: PeaksInitOptions): Promise<Peaks> {
		return new Promise((resolve, reject) => {
			try {
				Peaks.init(opts, (err, instance) => {
					if (err) {
						reject(err);
						return;
					}

					if (!instance) {
						reject(
							new Error(
								"Peaks.init(): Initialization completed without returning an instance",
							),
						);
						return;
					}

					resolve(instance);
				});
			} catch (error: unknown) {
				reject(error instanceof Error ? error : new Error(String(error)));
			}
		});
	}

	private _setOptions(opts: PeaksInitOptions) {
		if (!isObject(opts)) {
			return new TypeError(
				"Peaks.init(): The options parameter should be an object",
			);
		}

		if (!opts.player) {
			if (!opts.mediaElement) {
				return new Error("Peaks.init(): Missing mediaElement option");
			}

			if (!(opts.mediaElement instanceof HTMLMediaElement)) {
				return new TypeError(
					"Peaks.init(): The mediaElement option should be an HTMLMediaElement",
				);
			}
		}

		if (opts.logger && !isFunction(opts.logger)) {
			return new TypeError(
				"Peaks.init(): The logger option should be a function",
			);
		}

		if (opts.segments && !Array.isArray(opts.segments)) {
			return new TypeError(
				"Peaks.init(): options.segments must be an array of segment objects",
			);
		}

		if (opts.points && !Array.isArray(opts.points)) {
			return new TypeError(
				"Peaks.init(): options.points must be an array of point objects",
			);
		}

		extendOptions(
			this.options as unknown as Record<string, unknown>,
			opts as unknown as Record<string, unknown>,
		);

		this.options.overview = getOverviewOptions(
			opts,
		) as unknown as PeaksOptions["overview"];
		this.options.zoomview = getZoomviewOptions(
			opts,
		) as unknown as PeaksOptions["zoomview"];
		this.options.scrollbar = getScrollbarOptions(
			opts,
		) as PeaksOptions["scrollbar"];

		addSegmentOptions(this.options, opts);

		if (!Array.isArray(this.options.zoomLevels)) {
			return new TypeError(
				"Peaks.init(): The zoomLevels option should be an array",
			);
		} else if (this.options.zoomLevels.length === 0) {
			return new Error("Peaks.init(): The zoomLevels array must not be empty");
		} else {
			if (!isInAscendingOrder(this.options.zoomLevels)) {
				return new Error(
					"Peaks.init(): The zoomLevels array must be sorted in ascending order",
				);
			}
		}

		this._logger = this.options.logger;
	}

	setSource(options: SetSourceOptions, callback: (err?: Error | null) => void) {
		this.player
			._setSource(options)
			.then(() => {
				if (!options.zoomLevels) {
					options.zoomLevels = this.options.zoomLevels;
				}

				this._waveformBuilder = new WaveformBuilder(
					this as unknown as PeaksInstance,
				);

				this._waveformBuilder?.init(options, (err, data) => {
					if (err) {
						callback(err);
						return;
					}

					this._waveformBuilder = null;
					this._waveformData = data ?? null;

					(["overview", "zoomview"] as const).forEach((viewName) => {
						const view = this.views.getView(viewName);

						if (view && data) {
							view.setWaveformData(data);
						}
					});

					if (options.zoomLevels) {
						this.zoom.setZoomLevels(options.zoomLevels);
					}

					callback();
				});
			})
			.catch((err: Error) => {
				callback(err);
			});
	}

	getWaveformData(): WaveformData | null {
		return this._waveformData;
	}

	destroy() {
		if (this._waveformBuilder) {
			this._waveformBuilder.abort();
		}

		if (this._keyboardHandler) {
			this._keyboardHandler.destroy();
		}

		if (this.views) {
			this.views.destroy();
		}

		if (this.player) {
			this.player.destroy();
		}

		if (this._cueEmitter) {
			this._cueEmitter.destroy();
		}
	}
}

export default Peaks;
