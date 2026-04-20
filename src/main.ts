import EventEmitter from "eventemitter3";
import type WaveformData from "waveform-data";
import { ClipNodePlayer, type ClipNodePlayerOptions } from "./clip-node-player";
import { CueEmitter } from "./cue-emitter";
import { KeyboardHandler } from "./keyboard-handler";
import {
	createPointMarker,
	createSegmentLabel,
	createSegmentMarker,
} from "./marker-factories";
import { MediaElementPlayer } from "./mediaelement-player";
import { Player } from "./player";
import type {
	Logger,
	OverviewOptions,
	PeaksInitOptions,
	PeaksInstance,
	PeaksOptions,
	PlayerAdapter,
	ScrollbarDisplayOptions,
	SegmentDisplayOptions,
	SetSourceOptions,
	WebAudioOptions,
	ZoomviewOptions,
} from "./types";
import type { Writable } from "./utils";
import {
	extend,
	isFunction,
	isHTMLElement,
	isInAscendingOrder,
	isObject,
	objectHasProperty,
} from "./utils";
import { ViewController } from "./view-controller";
import { WaveformBuilder } from "./waveform-builder";
import { WaveformPoints } from "./waveform-points";
import { WaveformSegments } from "./waveform-segments";
import { ZoomController } from "./zoom-controller";

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
	// showPlayheadTime:    true,
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
	// showPlayheadTime:    false,
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

export function getOverviewOptions(options: PeaksInitOptions): OverviewOptions {
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
	];

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

export function getZoomviewOptions(opts: PeaksInitOptions): ZoomviewOptions {
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
	opts: PeaksInitOptions,
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
	opts: PeaksInitOptions,
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

export function checkContainerElements(options: PeaksOptions) {
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

export class Peaks extends EventEmitter {
	options: PeaksOptions;
	player!: Player;
	segments!: WaveformSegments;
	points!: WaveformPoints;
	zoom!: ZoomController;
	views!: ViewController;
	declare logger: Logger;
	private keyboardHandler: KeyboardHandler | undefined;
	private waveformBuilder: WaveformBuilder | undefined;
	private waveformData: WaveformData | undefined;
	declare cueEmitter: CueEmitter | undefined;

	constructor() {
		super();

		// Set default options - overview/zoomview are populated in setOptions()
		this.options = {
			createPointMarker: createPointMarker,
			createSegmentLabel: createSegmentLabel,
			createSegmentMarker: createSegmentMarker,

			dataUri: undefined,

			// eslint-disable-next-line no-console
			logger: console.error.bind(console),

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

	/**
	 * Initializes a Peaks instance and asynchronously builds its waveform views.
	 *
	 * @throws {Error} If the callback is missing.
	 * @throws {TypeError} If initialization reaches a player adapter that does not implement the required methods.
	 * @throws {Error} If invalid point or segment definitions are supplied and they fail validation during setup.
	 */
	static init(
		opts: PeaksInitOptions,
		callback: (err?: Error, instance?: Peaks) => void,
	): undefined | never {
		if (!callback) {
			throw new Error("Peaks.init(): Missing callback function");
		}

		const instance = new Peaks();

		let err = instance.setOptions(opts);

		if (!err) {
			err = checkContainerElements(instance.options);
		}

		if (err) {
			callback(err);
			return;
		}

		let scrollbarContainer: HTMLDivElement | undefined;

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
			instance.keyboardHandler = KeyboardHandler.from({
				eventEmitter: instance as unknown as PeaksInstance,
			});
		}

		let player: PlayerAdapter;

		if (opts.player) {
			player = opts.player;
		} else if (instance.options.mediaElement) {
			player = MediaElementPlayer.from({
				mediaElement: instance.options.mediaElement,
			});
		} else {
			const audioContext =
				opts.audioContext ?? instance.options.webAudio?.audioContext;
			const audioBuffer = instance.options.webAudio?.audioBuffer;
			const url =
				typeof instance.options.mediaUrl === "string"
					? instance.options.mediaUrl
					: undefined;

			if (audioContext && (audioBuffer || url)) {
				const clipOptions: ClipNodePlayerOptions = audioBuffer
					? { audioBuffer, audioContext }
					: { audioContext, url: url as string };
				player = ClipNodePlayer.from({ options: clipOptions });
			} else {
				callback(
					new TypeError(
						"Peaks.init(): Provide one of: mediaElement, player, or audioContext with audioBuffer/mediaUrl",
					),
				);
				return;
			}
		}

		instance.player = Player.from({
			adapter: player,
			peaks: instance as unknown as PeaksInstance,
		});
		instance.segments = WaveformSegments.from({
			peaks: instance as unknown as PeaksInstance,
		});
		instance.points = WaveformPoints.from({
			peaks: instance as unknown as PeaksInstance,
		});
		instance.zoom = ZoomController.from({
			peaks: instance as unknown as PeaksInstance,
			zoomLevels: instance.options.zoomLevels,
		});
		instance.views = ViewController.from({
			peaks: instance as unknown as PeaksInstance,
		});

		// Setup the UI components
		instance.waveformBuilder = WaveformBuilder.from({
			peaks: instance as unknown as PeaksInstance,
		});

		instance.player
			.init()
			.then(() => {
				instance.waveformBuilder?.init(
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

						instance.waveformBuilder = undefined;
						instance.waveformData = waveformData;

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
							instance.cueEmitter = CueEmitter.from({
								peaks: instance as unknown as PeaksInstance,
							});
						}

						callback(undefined, instance);
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

	private setOptions(opts: PeaksInitOptions) {
		if (!isObject(opts)) {
			return new TypeError(
				"Peaks.init(): The options parameter should be an object",
			);
		}

		if (!opts.player) {
			const webAudio = opts.webAudio as WebAudioOptions | undefined;
			const hasAudioContextSource =
				(opts.audioContext ?? webAudio?.audioContext) !== undefined &&
				(webAudio?.audioBuffer !== undefined ||
					typeof opts.mediaUrl === "string");

			if (!opts.mediaElement && !hasAudioContextSource) {
				return new Error(
					"Peaks.init(): Provide one of: mediaElement, player, or audioContext with audioBuffer/mediaUrl",
				);
			}

			if (
				opts.mediaElement &&
				!(opts.mediaElement instanceof HTMLMediaElement)
			) {
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

		const writableOptions = this.options as Writable<PeaksOptions>;
		writableOptions.overview = getOverviewOptions(opts);
		writableOptions.zoomview = getZoomviewOptions(opts);

		const scrollbarOptions = getScrollbarOptions(opts);
		if (scrollbarOptions) {
			writableOptions.scrollbar = scrollbarOptions;
		}

		addSegmentOptions(writableOptions, opts);

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

		this.logger = this.options.logger;
	}

	setSource(options: SetSourceOptions, callback: (err?: Error) => void) {
		this.player
			.setSource(options)
			.then(() => {
				if (!options.zoomLevels) {
					(options as Writable<SetSourceOptions>).zoomLevels =
						this.options.zoomLevels;
				}

				this.waveformBuilder = WaveformBuilder.from({
					peaks: this as unknown as PeaksInstance,
				});

				this.waveformBuilder?.init(options, (err, data) => {
					if (err) {
						callback(err);
						return;
					}

					this.waveformBuilder = undefined;
					this.waveformData = data;

					for (const viewName of ["overview", "zoomview"] as const) {
						const view = this.views.getView(viewName);

						if (view && data) {
							view.setWaveformData(data);
						}
					}

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

	getWaveformData(): WaveformData | undefined {
		return this.waveformData;
	}

	destroy() {
		if (this.waveformBuilder) {
			this.waveformBuilder.abort();
		}

		if (this.keyboardHandler) {
			this.keyboardHandler.destroy();
		}

		if (this.views) {
			this.views.destroy();
		}

		if (this.player) {
			this.player.destroy();
		}

		if (this.cueEmitter) {
			this.cueEmitter.dispose();
		}
	}
}
