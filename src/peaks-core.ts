import type WaveformData from "waveform-data";
import type { PeaksEvents } from "./events";
import type { Player } from "./player";
import type { Logger, PeaksOptions } from "./types";
import type { ViewController } from "./view-controller";
import type { WaveformPoints } from "./waveform/points";
import type { WaveformSegments } from "./waveform/segments";
import type { ZoomController } from "./zoom-controller";

export interface PeaksCoreFromOptions {
	readonly options: PeaksOptions;
	readonly events: PeaksEvents;
	readonly logger: Logger;
}

export interface PeaksCoreAttachOptions {
	readonly player: Player;
	readonly segments: WaveformSegments;
	readonly points: WaveformPoints;
	readonly zoom: ZoomController;
	readonly views: ViewController;
	readonly getWaveformData: () => WaveformData | undefined;
}

/**
 * Internal mutable composition root used during {@link Peaks.from}.
 *
 * Every Peaks subsystem (Player, ViewController, etc.) takes a back-reference
 * to a {@link PeaksInstance}. To keep the public {@link Peaks} class fully
 * readonly we hand the children a `PeaksCore` (which implements
 * `PeaksInstance` via a populate-then-use builder) and only later construct
 * the readonly `Peaks` shell from the same set of services.
 *
 * `PeaksCore` is intentionally not class.md-compliant: it has a two-phase
 * lifecycle (`from` → `attach`) so that mutually-dependent services can be
 * wired up before any of them are read.
 */
export class PeaksCore {
	// Populated by `attach()` before any child reads them.
	player!: Player;
	segments!: WaveformSegments;
	points!: WaveformPoints;
	zoom!: ZoomController;
	views!: ViewController;
	private getWaveformDataFn: (() => WaveformData | undefined) | undefined;

	private constructor(
		readonly options: PeaksOptions,
		readonly events: PeaksEvents,
		readonly logger: Logger,
	) {}

	static from(opts: PeaksCoreFromOptions): PeaksCore {
		return new PeaksCore(opts.options, opts.events, opts.logger);
	}

	attach(parts: PeaksCoreAttachOptions): void {
		this.player = parts.player;
		this.segments = parts.segments;
		this.points = parts.points;
		this.zoom = parts.zoom;
		this.views = parts.views;
		this.getWaveformDataFn = parts.getWaveformData;
	}

	getWaveformData(): WaveformData | undefined {
		return this.getWaveformDataFn?.();
	}
}
