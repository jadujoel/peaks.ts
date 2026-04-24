import type {
	Peaks,
	Point,
	Segment,
	WaveformOverviewAPI,
	WaveformZoomviewAPI,
} from "@jadujoel/peaks.ts";
import { div, input, output, select } from "./dom";
import type { LoopController } from "./loop-controller";

export type ChannelSwitcher = (mode: "mono" | "stereo") => Promise<void>;

export interface ControlsFromOptions {
	readonly peaks: Peaks;
	readonly loopController: LoopController;
	readonly channelSwitcher: ChannelSwitcher;
	readonly zoomLevels: readonly number[];
}

export class Controls {
	private constructor(
		private readonly peaks: Peaks,
		private readonly loopController: LoopController,
		private readonly channelSwitcher: ChannelSwitcher,
		private readonly zoomLevels: readonly number[],
	) {}

	static from(options: ControlsFromOptions): Controls {
		const controls = new Controls(
			options.peaks,
			options.loopController,
			options.channelSwitcher,
			options.zoomLevels,
		);
		controls.wirePlayback();
		controls.wireLoops();
		controls.wireZoom();
		controls.wireDisplay();
		controls.wireColors();
		controls.wireAmplitude();
		controls.wireChannels();
		controls.wireSize();
		controls.wireSegments();
		controls.wirePoints();
		controls.subscribeToPeaks();
		return controls;
	}

	private zoomView(): WaveformZoomviewAPI {
		const view = this.peaks.views.getZoomview();
		if (!view) {
			throw new Error("zoomview not available");
		}
		return view;
	}

	private overviewView(): WaveformOverviewAPI | undefined {
		return this.peaks.views.getOverview();
	}

	private wirePlayback = (): void => {
		// Action buttons are handled via the document-level click delegation
		// installed in subscribeToPeaks().
	};

	private subscribeToPeaks = (): void => {
		const playheadTime = output("playhead-time");
		this.peaks.events.addEventListener("player.timeupdate", (event) => {
			playheadTime.value = event.time.toFixed(2);
		});
		this.peaks.events.addEventListener("player.seeked", (event) => {
			playheadTime.value = event.time.toFixed(2);
		});
		this.peaks.events.addEventListener("segments.add", this.renderSegments);
		this.peaks.events.addEventListener("segments.remove", this.renderSegments);
		this.peaks.events.addEventListener("segments.dragend", this.renderSegments);
		this.peaks.events.addEventListener("points.add", this.renderPoints);
		this.peaks.events.addEventListener("points.remove", this.renderPoints);

		document.body.addEventListener("click", this.onActionClick);
	};

	private onActionClick = (event: MouseEvent): void => {
		const target = event.target;
		if (!(target instanceof Element)) return;
		const element = target.closest("[data-action]");
		if (!element) return;
		const action = element.getAttribute("data-action");
		const id = element.getAttribute("data-id");
		this.handleAction(action, id);
	};

	private handleAction = (action: string | null, id: string | null): void => {
		switch (action) {
			case "play":
				this.peaks.player.play().catch((error: unknown) => {
					console.warn("play failed", error);
				});
				return;
			case "pause":
				this.peaks.player.pause();
				return;
			case "stop":
				this.peaks.player.pause();
				this.peaks.player.seek(0);
				return;
			case "loop-file":
				this.loopController.loopFile().catch((error: unknown) => {
					console.warn("loop-file failed", error);
				});
				return;
			case "stop-loop":
				this.loopController.stop();
				return;
			case "zoom-in":
				this.peaks.zoom.zoomIn();
				this.syncZoomSelect();
				return;
			case "zoom-out":
				this.peaks.zoom.zoomOut();
				this.syncZoomSelect();
				return;
			case "add-segment":
				this.addSegmentAtPlayhead();
				return;
			case "loop-segment":
				if (id) this.loopSegmentById(id);
				return;
			case "remove-segment":
				if (id) {
					if (this.loopController.currentSegmentId() === id) {
						this.loopController.stop();
					}
					this.peaks.segments.removeById(id);
				}
				return;
			case "add-point":
				this.peaks.points.add({
					editable: true,
					labelText: "Point",
					time: this.peaks.player.getCurrentTime(),
				});
				return;
			case "jump-point":
				if (id) {
					const point = this.peaks.points.getPoint(id);
					if (point) this.peaks.player.seek(point.time);
				}
				return;
			case "remove-point":
				if (id) this.peaks.points.removeById(id);
				return;
			default:
				return;
		}
	};

	private addSegmentAtPlayhead = (): void => {
		const start = this.peaks.player.getCurrentTime();
		const duration = this.peaks.player.getDuration();
		const end = Math.min(
			start + 5,
			Number.isFinite(duration) && duration > 0 ? duration : start + 5,
		);
		this.peaks.segments.add({
			editable: true,
			endTime: end,
			labelText: "Segment",
			startTime: start,
		});
	};

	private loopSegmentById = (id: string): void => {
		const segment = this.peaks.segments.getSegment(id);
		if (!segment) return;
		this.loopController.loopSegment(segment).catch((error: unknown) => {
			console.warn("playSegment failed", error);
		});
	};

	private wireLoops = (): void => {
		// Status output is updated via LoopController.onChange; nothing to bind here.
	};

	private wireZoom = (): void => {
		const zoomSelect = select("zoom-level");
		zoomSelect.replaceChildren();
		this.zoomLevels.forEach((level, index) => {
			const opt = document.createElement("option");
			opt.value = String(index);
			opt.textContent = `${index} — scale ${level}`;
			zoomSelect.append(opt);
		});
		this.syncZoomSelect();
		zoomSelect.addEventListener("change", () => {
			const index = Number(zoomSelect.value);
			if (Number.isFinite(index)) {
				this.peaks.zoom.setIndex(index, true);
			}
		});
	};

	private syncZoomSelect = (): void => {
		const zoomSelect = select("zoom-level");
		zoomSelect.value = String(this.peaks.zoom.getIndex());
	};

	private wireDisplay = (): void => {
		const autoScroll = input("auto-scroll");
		autoScroll.addEventListener("change", () => {
			this.zoomView().enableAutoScroll(autoScroll.checked);
		});

		const showScrollbar = input("show-scrollbar");
		showScrollbar.addEventListener("change", () => {
			div("scrollbar-container").classList.toggle(
				"hide",
				!showScrollbar.checked,
			);
		});

		const showOverview = input("show-overview");
		showOverview.addEventListener("change", () => {
			const container = div("overview-container");
			if (showOverview.checked) {
				container.classList.remove("hide");
				this.peaks.views.createOverview(container).catch((error: unknown) => {
					console.warn("createOverview failed", error);
				});
			} else {
				this.peaks.views.destroyOverview();
				container.classList.add("hide");
			}
		});

		const dragMode = select("waveform-drag-mode");
		dragMode.addEventListener("change", () => {
			this.zoomView().setWaveformDragMode(dragMode.value);
		});

		const segmentDrag = select("segment-drag-mode");
		segmentDrag.addEventListener("change", () => {
			this.zoomView().setSegmentDragMode(segmentDrag.value);
		});
	};

	private wireColors = (): void => {
		const apply = (
			key: "waveform" | "played" | "label" | "grid",
			color: string,
		): void => {
			const zoom = this.zoomView();
			const overview = this.overviewView();
			switch (key) {
				case "waveform":
					zoom.setWaveformColor(color);
					overview?.setWaveformColor(color);
					return;
				case "played":
					zoom.setPlayedWaveformColor(color);
					overview?.setPlayedWaveformColor(color);
					return;
				case "label":
					zoom.setAxisLabelColor(color);
					overview?.setAxisLabelColor(color);
					return;
				case "grid":
					zoom.setAxisGridlineColor(color);
					overview?.setAxisGridlineColor(color);
					return;
			}
		};

		const wave = input("waveform-color");
		wave.addEventListener("input", () => apply("waveform", wave.value));
		const played = input("played-color");
		played.addEventListener("input", () => apply("played", played.value));
		const label = input("axis-label-color");
		label.addEventListener("input", () => apply("label", label.value));
		const grid = input("axis-grid-color");
		grid.addEventListener("input", () => apply("grid", grid.value));
	};

	private wireAmplitude = (): void => {
		const slider = input("amplitude-scale");
		const value = output("amplitude-scale-value");
		slider.addEventListener("input", () => {
			const scale = Number(slider.value);
			value.value = scale.toFixed(1);
			try {
				this.zoomView().setAmplitudeScale(scale);
				this.overviewView()?.setAmplitudeScale(scale);
			} catch (error) {
				console.warn("setAmplitudeScale failed", error);
			}
		});
	};

	private wireChannels = (): void => {
		const sel = select("channel-mode");
		sel.addEventListener("change", () => {
			const mode = sel.value === "stereo" ? "stereo" : "mono";
			this.channelSwitcher(mode).catch((error: unknown) => {
				console.warn("channel switch failed", error);
			});
		});
	};

	private wireSize = (): void => {
		const root = document.documentElement;
		const width = input("width");
		const widthOut = output("width-value");
		width.addEventListener("input", () => {
			widthOut.value = width.value;
			root.style.setProperty("--zoomview-width", `${width.value}px`);
			window.dispatchEvent(new Event("resize"));
		});
		const height = input("height");
		const heightOut = output("height-value");
		height.addEventListener("input", () => {
			heightOut.value = height.value;
			root.style.setProperty("--zoomview-height", `${height.value}px`);
			window.dispatchEvent(new Event("resize"));
		});
	};

	private wireSegments = (): void => {
		this.renderSegments();
	};

	private wirePoints = (): void => {
		this.renderPoints();
	};

	private renderSegments = (): void => {
		const tbody = document.querySelector<HTMLTableSectionElement>(
			"#segments-table tbody",
		);
		if (!tbody) return;
		const segments = this.peaks.segments.getSegments();
		const rows = segments.map((segment: Segment) => {
			const label = segment.labelText.length > 0 ? segment.labelText : "";
			return (
				`<tr>` +
				`<td>${this.escape(segment.id)}</td>` +
				`<td>${this.escape(label)}</td>` +
				`<td>${segment.startTime.toFixed(2)}</td>` +
				`<td>${segment.endTime.toFixed(2)}</td>` +
				`<td><button type="button" data-action="loop-segment" data-id="${this.escape(segment.id)}">Loop</button></td>` +
				`<td><button type="button" data-action="remove-segment" data-id="${this.escape(segment.id)}">Remove</button></td>` +
				`</tr>`
			);
		});
		tbody.innerHTML = rows.join("");
	};

	private renderPoints = (): void => {
		const tbody = document.querySelector<HTMLTableSectionElement>(
			"#points-table tbody",
		);
		if (!tbody) return;
		const points = this.peaks.points.getPoints();
		const rows = points.map((point: Point) => {
			return (
				`<tr>` +
				`<td>${this.escape(point.id)}</td>` +
				`<td>${point.time.toFixed(2)}</td>` +
				`<td><button type="button" data-action="jump-point" data-id="${this.escape(point.id)}">Jump</button></td>` +
				`<td><button type="button" data-action="remove-point" data-id="${this.escape(point.id)}">Remove</button></td>` +
				`</tr>`
			);
		});
		tbody.innerHTML = rows.join("");
	};

	private escape(value: string): string {
		return value.replace(/[&<>"']/g, (ch) => {
			switch (ch) {
				case "&":
					return "&amp;";
				case "<":
					return "&lt;";
				case ">":
					return "&gt;";
				case '"':
					return "&quot;";
				case "'":
					return "&#39;";
				default:
					return ch;
			}
		});
	}
}
