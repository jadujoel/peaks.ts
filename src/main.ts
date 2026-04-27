import { errAsync, okAsync, ResultAsync } from "neverthrow";
import type WaveformData from "waveform-data";
import { CueEmitter } from "./cue-emitter";
import { createPeaksEvents, type PeaksEvents } from "./events";
import { KeyboardHandler } from "./keyboard-handler";
import { resolveAudioDriver } from "./peaks-audio";
import { PeaksCore } from "./peaks-core";
import { PeaksGroup } from "./peaks-group";
import { PeaksNode } from "./peaks-node";
import {
	checkContainerElements,
	resolvePeaksOptions,
	validateScrollbarContainer,
} from "./peaks-options";
import { Player } from "./player";
import type {
	Logger,
	PeaksConfiguration,
	PeaksInstance,
	PeaksOptions,
	SetSourceOptions,
} from "./types";
import type { Writable } from "./utils";
import { ViewController } from "./view-controller";
import { WaveformBuilder } from "./waveform/builder";
import { WaveformPoints } from "./waveform/points";
import { WaveformSegments } from "./waveform/segments";
import { ZoomController } from "./zoom-controller";

export { ClipNodeAudioDriver } from "./driver/audio/clip-node/driver";
export { KonvaCanvasDriver } from "./driver/konva/driver";
export { PixiCanvasDriver } from "./driver/pixi/loader";
export type { PeaksEvents } from "./events";
export {
	addSegmentOptions,
	checkContainerElements,
	defaultViewOptions,
	defaultZoomviewOptions,
	extendOptions,
	getOverviewOptions,
	getZoomviewOptions,
	resolvePeaksOptions,
	validateScrollbarContainer,
} from "./peaks-options";
export { Point } from "./point";
export { Segment } from "./segment";
export type { GridStep, TempoSection, TimeSignature } from "./tempo-map";
export { TempoMap } from "./tempo-map";
export type { SnapEvent, SnapKind } from "./tempo-map-context";
export { TempoMapContext } from "./tempo-map-context";
export type {
	PeaksConfiguration,
	PeaksOptions,
	PointOptions,
	SegmentOptions,
	SetSourceOptions,
	WaveformOverviewAPI,
	WaveformViewLike,
	WaveformZoomviewAPI,
} from "./types";
export { PeaksGroup, PeaksNode };

export interface WaveformDataSlot {
	value: WaveformData | undefined;
}

export class Peaks {
	private constructor(
		readonly options: PeaksOptions,
		readonly events: PeaksEvents,
		readonly logger: Logger,
		readonly player: Player,
		readonly segments: WaveformSegments,
		readonly points: WaveformPoints,
		readonly zoom: ZoomController,
		readonly views: ViewController,
		private readonly keyboardHandler: KeyboardHandler | undefined,
		readonly cueEmitter: CueEmitter | undefined,
		// Shared with PeaksCore via closure so that children observe the
		// up-to-date value after `setSource`.
		private readonly waveformDataSlot: WaveformDataSlot,
		// Mutable: rebuilt by `setSource`, cleared once each build resolves.
		private waveformBuilder: WaveformBuilder | undefined,
	) {}

	/**
	 * Initializes a Peaks instance and asynchronously builds its waveform
	 * views. Resolves to the ready instance or rejects with the initialization
	 * error. Use {@link Peaks.tryFrom} if you prefer a `ResultAsync`.
	 */
	static async from(config: PeaksConfiguration): Promise<Peaks> {
		return Peaks.tryFrom(config).match(
			(peaks) => peaks,
			(error) => {
				throw error;
			},
		);
	}

	/**
	 * Result-returning variant of {@link Peaks.from}. Resolves to a
	 * `Result<Peaks, Error>` instead of throwing.
	 */
	static tryFrom(config: PeaksConfiguration): ResultAsync<Peaks, Error> {
		const optionsResult = resolvePeaksOptions(config);
		if (optionsResult.isErr()) {
			return errAsync(optionsResult.error);
		}
		const options = optionsResult.value;

		const containerErr = checkContainerElements(options);
		if (containerErr) {
			return errAsync(containerErr);
		}

		const scrollbarResult = validateScrollbarContainer(options);
		if (scrollbarResult.isErr()) {
			return errAsync(scrollbarResult.error);
		}
		const scrollbarContainer = scrollbarResult.value;

		const driverResult = resolveAudioDriver(config);
		if (driverResult.isErr()) {
			return errAsync(driverResult.error);
		}
		const driver = driverResult.value;

		const events = createPeaksEvents();
		const logger = options.logger;

		// Wire snap → events bus.
		options.tempoMapContext?.addSnapListener((snap) => {
			events.dispatch("snap.apply", {
				kind: snap.kind,
				rawTime: snap.rawTime,
				snappedTime: snap.snappedTime,
			});
		});

		const core = PeaksCore.from({ events, logger, options });
		const peaksRef = core as unknown as PeaksInstance;

		const waveformDataSlot: WaveformDataSlot = { value: undefined };

		const player = Player.from({ driver, peaks: peaksRef });
		const segments = WaveformSegments.from({ peaks: peaksRef });
		const points = WaveformPoints.from({ peaks: peaksRef });
		const zoom = ZoomController.from({
			levels: options.zoomLevels,
			peaks: peaksRef,
		});
		const views = ViewController.from({
			driver: options.driver,
			peaks: peaksRef,
		});

		core.attach({
			getWaveformData: () => waveformDataSlot.value,
			player,
			points,
			segments,
			views,
			zoom,
		});

		const keyboardHandler = config.keyboard
			? KeyboardHandler.from({ events })
			: undefined;

		const playerInit = ResultAsync.fromPromise(
			player.init(),
			(error) => error as Error,
		);

		return playerInit
			.andThen(() => {
				const builder = WaveformBuilder.from({ peaks: peaksRef });
				return builder.init(options);
			})
			.andThen((waveformData) => {
				const postBuildContainerErr = checkContainerElements(options);
				if (postBuildContainerErr) {
					return errAsync<Peaks, Error>(postBuildContainerErr);
				}

				waveformDataSlot.value = waveformData;

				return ResultAsync.fromPromise(
					(async () => {
						const zoomviewContainer = options.zoomview.container as
							| HTMLDivElement
							| undefined;
						const overviewContainer = options.overview.container as
							| HTMLDivElement
							| undefined;

						if (zoomviewContainer) {
							await views.createZoomview(zoomviewContainer);
						}
						if (overviewContainer) {
							await views.createOverview(overviewContainer);
						}
						if (scrollbarContainer) {
							await views.createScrollbar(scrollbarContainer);
						}

						if (config.segments) {
							segments.add(config.segments);
						}
						if (config.points) {
							points.add(config.points);
						}

						const cueEmitter = config.emitCueEvents
							? CueEmitter.from({ peaks: peaksRef })
							: undefined;

						return new Peaks(
							options,
							events,
							logger,
							player,
							segments,
							points,
							zoom,
							views,
							keyboardHandler,
							cueEmitter,
							waveformDataSlot,
							undefined,
						);
					})(),
					(error) => error as Error,
				);
			})
			.andThen((peaks) => okAsync<Peaks, Error>(peaks));
	}

	/**
	 * Replaces the audio source and rebuilds waveform data. Resolves once
	 * the new waveform is rendered, rejects on any failure (driver error,
	 * waveform parse error, missing media, etc.).
	 */
	setSource(options: SetSourceOptions): Promise<void> {
		return new Promise<void>((resolve, reject) => {
			this.player
				.setSource(options)
				.then(() => {
					if (!options.zoomLevels) {
						(options as Writable<SetSourceOptions>).zoomLevels =
							this.options.zoomLevels;
					}

					// If the driver owns the buffer (e.g. ClipNodeAudioDriver),
					// auto-fill `data: { type: "webaudio" }` so the WaveformBuilder
					// doesn't require the caller to repeat what the driver already has.
					const driverSource = this.player.driver.getSource?.();
					const driverWebAudio = driverSource?.webAudio;
					if (driverWebAudio?.buffer) {
						const writable = options as Writable<SetSourceOptions>;
						const existing =
							options.data?.type === "webaudio" ? options.data : undefined;
						const buffer = existing?.buffer ?? driverWebAudio.buffer;
						const context = existing?.context ?? driverWebAudio.context;
						writable.data = {
							...(existing ?? { type: "webaudio" as const }),
							...(buffer !== undefined ? { buffer } : {}),
							...(context !== undefined ? { context } : {}),
						};
					}

					const builder = WaveformBuilder.from({
						peaks: this as unknown as PeaksInstance,
					});
					this.waveformBuilder = builder;

					builder.init(options).match(
						(data) => {
							this.waveformBuilder = undefined;
							this.waveformDataSlot.value = data;

							for (const viewName of ["overview", "zoomview"] as const) {
								const view = this.views.getView(viewName);

								if (view) {
									view.setWaveformData(data);
								}
							}

							if (options.zoomLevels) {
								this.zoom.setLevels(options.zoomLevels);
							}

							resolve();
						},
						(err) => {
							this.waveformBuilder = undefined;
							reject(err);
						},
					);
				})
				.catch((err: Error) => {
					reject(err);
				});
		});
	}

	getWaveformData(): WaveformData | undefined {
		return this.waveformDataSlot.value;
	}

	dispose() {
		if (this.waveformBuilder) {
			this.waveformBuilder.abort();
		}

		if (this.keyboardHandler) {
			this.keyboardHandler.dispose();
		}

		this.views.dispose();
		this.player.dispose();

		if (this.cueEmitter) {
			this.cueEmitter.dispose();
		}
	}
}
