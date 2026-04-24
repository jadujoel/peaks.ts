import type { Peaks, Segment } from "@jadujoel/peaks.ts";

/**
 * Coordinates loop state for the example. Supports:
 *   • whole-file loop — delegates to `peaks.player.playLooped()`.
 *   • single-segment loop — exposes a `loopSegment(segment)` method.
 *   • clearing the loop — `stop()` pauses playback and resets state.
 */
export interface LoopControllerFromOptions {
	readonly peaks: Peaks;
	readonly onChange: (label: string) => void;
}

export class LoopController {
	private constructor(
		private readonly peaks: Peaks,
		private readonly onChange: (label: string) => void,
		private state:
			| { kind: "none" }
			| { kind: "file" }
			| { kind: "segment"; id: string },
	) {}

	static from(options: LoopControllerFromOptions): LoopController {
		return new LoopController(options.peaks, options.onChange, {
			kind: "none",
		});
	}

	loopFile = (): Promise<void> => {
		const duration = this.peaks.player.getDuration();
		if (!Number.isFinite(duration) || duration <= 0) {
			return Promise.resolve();
		}
		this.state = { kind: "file" };
		this.onChange("entire file");
		return this.peaks.player.playLooped();
	};

	loopSegment = (segment: Segment): Promise<void> => {
		this.state = { id: segment.id, kind: "segment" };
		this.onChange(this.formatSegmentLabel(segment));
		return this.peaks.player.playSegment(segment, true);
	};

	stop = (): void => {
		this.state = { kind: "none" };
		this.peaks.player.pause();
		this.onChange("(none)");
	};

	currentSegmentId(): string | undefined {
		return this.state.kind === "segment" ? this.state.id : undefined;
	}

	private formatSegmentLabel(segment: Segment): string {
		const label = segment.labelText.length > 0 ? segment.labelText : segment.id;
		return `${label} (${segment.startTime.toFixed(2)}s – ${segment.endTime.toFixed(2)}s)`;
	}
}
