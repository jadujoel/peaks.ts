import type {
	GridStep,
	LoopController,
	Peaks,
	SnapKind,
	TimeSignature,
} from "@jadujoel/peaks.ts";
import { TempoMap } from "@jadujoel/peaks.ts";
import { div, input, output, select } from "./dom";

export type ChannelSwitcher = (mode: "mono" | "stereo") => Promise<void>;

export interface ControlsFromOptions {
	readonly peaks: Peaks;
	readonly loopController: LoopController;
	readonly channelSwitcher: ChannelSwitcher;
	readonly zoomLevels: readonly number[];
}

interface MenuItem {
	readonly label: string;
	readonly run: () => void;
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
		controls.wireZoom();
		controls.wireDisplay();
		controls.wireColors();
		controls.wireAmplitude();
		controls.wireChannels();
		controls.wireSize();
		controls.wirePlaybackRate();
		controls.wireWaveformContextMenu();
		controls.wireTempoGrid();
		controls.subscribeToPeaks();
		controls.renderSegments();
		controls.renderPoints();
		return controls;
	}

	private zoomView() {
		return this.peaks.views.getZoomview();
	}

	private overviewView() {
		return this.peaks.views.getOverview();
	}

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
		this.peaks.events.addEventListener("segments.update", this.renderSegments);
		this.peaks.events.addEventListener("points.add", this.renderPoints);
		this.peaks.events.addEventListener("points.remove", this.renderPoints);
		this.peaks.events.addEventListener("points.update", this.renderPoints);

		document.body.addEventListener("click", this.onActionClick);
		document.body.addEventListener("click", this.onDocumentClickDismiss, true);
		document.addEventListener("keydown", this.onDocumentKeydown);
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
				this.peaks.segments.addAtPlayhead();
				return;
			case "jump-segment":
				if (id) {
					const segment = this.peaks.segments.getSegment(id);
					if (segment) this.peaks.player.seek(segment.startTime);
				}
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
				this.peaks.points.addAtPlayhead();
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
			case "apply-tempo":
				this.applyTempo();
				return;
			default:
				return;
		}
	};

	private loopSegmentById = (id: string): void => {
		const segment = this.peaks.segments.getSegment(id);
		if (!segment) return;
		this.loopController.loopSegment(segment).catch((error: unknown) => {
			console.warn("playSegment failed", error);
		});
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
			this.zoomView()?.enableAutoScroll(autoScroll.checked);
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

		const showZoomview = input("show-zoomview");
		showZoomview.addEventListener("change", () => {
			const container = div("zoomview-container");
			if (showZoomview.checked) {
				container.classList.remove("hide");
				this.peaks.views.createZoomview(container).catch((error: unknown) => {
					console.warn("createZoomview failed", error);
				});
			} else {
				this.peaks.views.destroyZoomview();
				container.classList.add("hide");
			}
		});

		const dragMode = select("waveform-drag-mode");
		dragMode.addEventListener("change", () => {
			this.zoomView()?.setWaveformDragMode(dragMode.value);
		});

		const segmentDrag = select("segment-drag-mode");
		segmentDrag.addEventListener("change", () => {
			this.zoomView()?.setSegmentDragMode(segmentDrag.value);
		});
	};

	private wireColors = (): void => {
		const views = this.peaks.views;

		const wave = input("waveform-color");
		wave.addEventListener("input", () => views.setWaveformColor(wave.value));
		const played = input("played-color");
		played.addEventListener("input", () =>
			views.setPlayedWaveformColor(played.value),
		);
		views.setPlayedWaveformColor(played.value);
		const label = input("axis-label-color");
		label.addEventListener("input", () => views.setAxisLabelColor(label.value));
		const grid = input("axis-grid-color");
		grid.addEventListener("input", () =>
			views.setAxisGridlineColor(grid.value),
		);

		const playhead = input("playhead-color");
		playhead.addEventListener("input", () =>
			views.setPlayheadColor(playhead.value),
		);

		const overviewWave = input("overview-waveform-color");
		overviewWave.addEventListener("input", () => {
			this.overviewView()?.setWaveformColor(overviewWave.value);
		});

		const overviewHighlight = input("overview-highlight-color");
		overviewHighlight.addEventListener("input", () =>
			views.setHighlightColor(overviewHighlight.value),
		);

		const startMarker = input("segment-start-marker-color");
		startMarker.addEventListener("input", () =>
			views.setSegmentStartMarkerColor(startMarker.value),
		);

		const endMarker = input("segment-end-marker-color");
		endMarker.addEventListener("input", () =>
			views.setSegmentEndMarkerColor(endMarker.value),
		);

		const segWave = input("segment-waveform-color");
		segWave.addEventListener("input", () => {
			this.peaks.segments.updateAll({ color: segWave.value });
		});

		const zoomBg = input("zoomview-bg-color");
		const overviewBg = input("overview-bg-color");
		const applyZoomBg = (): void => {
			div("zoomview-container").style.backgroundColor = zoomBg.value;
		};
		const applyOverviewBg = (): void => {
			div("overview-container").style.backgroundColor = overviewBg.value;
		};
		zoomBg.addEventListener("input", applyZoomBg);
		overviewBg.addEventListener("input", applyOverviewBg);
		applyZoomBg();
		applyOverviewBg();
	};

	private wireAmplitude = (): void => {
		const slider = input("amplitude-scale");
		const value = output("amplitude-scale-value");
		slider.addEventListener("input", () => {
			const scale = Number(slider.value);
			value.value = scale.toFixed(1);
			try {
				this.peaks.views.setAmplitudeScale(scale);
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
		const applyFit = (): void => {
			this.peaks.views.fitToContainer();
		};
		const height = input("height");
		const heightOut = output("height-value");
		height.addEventListener("input", () => {
			heightOut.value = height.value;
			root.style.setProperty("--zoomview-height", `${height.value}px`);
			applyFit();
		});
	};

	private wirePlaybackRate = (): void => {
		const slider = input("playback-rate");
		const value = output("playback-rate-value");
		const apply = (): void => {
			const rate = Number(slider.value);
			value.value = rate.toFixed(2);
			this.peaks.player.setPlaybackRate(rate);
		};
		slider.addEventListener("input", apply);
		apply();
	};

	private wireTempoGrid = (): void => {
		this.applyTempo();
		const visible = input("grid-visible");
		visible.addEventListener("change", () => {
			this.zoomView()?.setGridVisible(visible.checked);
		});
		const snapKinds: readonly SnapKind[] = [
			"segments",
			"segmentMarkers",
			"points",
			"insertSegment",
			"playhead",
		];
		const snapToggle = input("snap-enabled");
		snapToggle.addEventListener("change", () => {
			const view = this.zoomView();
			if (!view) return;
			for (const kind of snapKinds) {
				view.setSnapEnabled(kind, snapToggle.checked);
			}
		});
	};

	private applyTempo = (): void => {
		const bpmEl = input("tempo-bpm");
		const bpm = Number.parseFloat(bpmEl.value);
		if (!Number.isFinite(bpm) || bpm <= 0) return;
		const sigEl = select("tempo-signature");
		const signature = parseTimeSignature(sigEl.value);
		const stepEl = select("tempo-step");
		const step = stepEl.value as GridStep;
		const map = TempoMap.constant({ bpm, signature });
		const view = this.zoomView();
		if (!view) return;
		view.setTempoMap(map);
		view.setGridStep(step);
	};

	// ─── Right-click context menu on the waveform views ────────────────

	private wireWaveformContextMenu = (): void => {
		const containers = [div("zoomview-container"), div("overview-container")];
		for (const container of containers) {
			container.addEventListener("contextmenu", (event) => {
				this.openWaveformMenu(container, event);
			});
		}
	};

	private openWaveformMenu = (
		container: HTMLDivElement,
		event: MouseEvent,
	): void => {
		event.preventDefault();
		const rect = container.getBoundingClientRect();
		const x = event.clientX - rect.left;
		const time = this.timeFromContainerX(container, x, rect.width);
		if (!Number.isFinite(time)) return;
		this.openContextMenu(event.clientX, event.clientY, [
			{
				label: `Add segment here (${time.toFixed(2)}s)`,
				run: () => {
					const duration = this.peaks.player.getDuration();
					const end =
						Number.isFinite(duration) && duration > 0
							? Math.min(time + 5, duration)
							: time + 5;
					this.peaks.segments.add({
						editable: true,
						endTime: end,
						labelText: "Segment",
						startTime: time,
					});
				},
			},
			{
				label: `Add point here (${time.toFixed(2)}s)`,
				run: () => {
					this.peaks.points.add({
						editable: true,
						labelText: "Point",
						time,
					});
				},
			},
		]);
	};

	private timeFromContainerX(
		container: HTMLDivElement,
		x: number,
		width: number,
	): number {
		// Prefer the view's own pixel→time mapping when available.
		const isOverview = container.id === "overview-container";
		const view = isOverview ? this.overviewView() : this.zoomView();
		if (view) {
			return view.pixelOffsetToTime(x);
		}
		const duration = this.peaks.player.getDuration();
		if (!Number.isFinite(duration) || duration <= 0 || width <= 0) return 0;
		return (x / width) * duration;
	}

	// ─── Compact list rendering & per-entry context menu ───────────────

	private renderSegments = (): void => {
		const list = document.getElementById("segments-compact");
		if (!(list instanceof HTMLUListElement)) return;
		const segments = this.peaks.segments.getSegments();
		const items = segments.map((segment) => {
			const id = this.escape(segment.id);
			const labelText =
				segment.labelText.length > 0 ? this.escape(segment.labelText) : id;
			return (
				`<li class="compact-list__item" data-segment-id="${id}">` +
				`<button type="button" class="compact-list__btn" data-action="jump-segment" data-id="${id}">` +
				`<span class="compact-list__label">${labelText}</span>` +
				`<span class="compact-list__time mono">${segment.startTime.toFixed(2)}–${segment.endTime.toFixed(2)}</span>` +
				`</button></li>`
			);
		});
		list.innerHTML = items.join("");
		for (const item of list.querySelectorAll<HTMLLIElement>(
			"li[data-segment-id]",
		)) {
			const segId = item.dataset.segmentId;
			if (!segId) continue;
			item.addEventListener("contextmenu", (event) => {
				this.openSegmentMenu(segId, event);
			});
		}
	};

	private renderPoints = (): void => {
		const list = document.getElementById("points-compact");
		if (!(list instanceof HTMLUListElement)) return;
		const points = this.peaks.points.getPoints();
		const items = points.map((point) => {
			const id = this.escape(point.id);
			const labelText =
				point.labelText.length > 0 ? this.escape(point.labelText) : id;
			return (
				`<li class="compact-list__item" data-point-id="${id}">` +
				`<button type="button" class="compact-list__btn" data-action="jump-point" data-id="${id}">` +
				`<span class="compact-list__label">${labelText}</span>` +
				`<span class="compact-list__time mono">${point.time.toFixed(2)}</span>` +
				`</button></li>`
			);
		});
		list.innerHTML = items.join("");
		for (const item of list.querySelectorAll<HTMLLIElement>(
			"li[data-point-id]",
		)) {
			const pid = item.dataset.pointId;
			if (!pid) continue;
			item.addEventListener("contextmenu", (event) => {
				this.openPointMenu(pid, event);
			});
		}
	};

	private openSegmentMenu = (id: string, event: MouseEvent): void => {
		event.preventDefault();
		const segment = this.peaks.segments.getSegment(id);
		if (!segment) return;
		this.openContextMenu(event.clientX, event.clientY, [
			{ label: "Edit…", run: () => this.openSegmentEditor(id, event) },
			{
				label: "Jump to start",
				run: () => this.peaks.player.seek(segment.startTime),
			},
			{ label: "Loop", run: () => this.loopSegmentById(id) },
			{
				label: "Remove",
				run: () => {
					if (this.loopController.currentSegmentId() === id) {
						this.loopController.stop();
					}
					this.peaks.segments.removeById(id);
				},
			},
		]);
	};

	private openPointMenu = (id: string, event: MouseEvent): void => {
		event.preventDefault();
		const point = this.peaks.points.getPoint(id);
		if (!point) return;
		this.openContextMenu(event.clientX, event.clientY, [
			{ label: "Edit…", run: () => this.openPointEditor(id, event) },
			{ label: "Jump", run: () => this.peaks.player.seek(point.time) },
			{ label: "Remove", run: () => this.peaks.points.removeById(id) },
		]);
	};

	// ─── Context-menu and edit-popover plumbing ────────────────────────

	private openContextMenu = (
		clientX: number,
		clientY: number,
		items: readonly MenuItem[],
	): void => {
		const menu = document.getElementById("context-menu");
		if (!(menu instanceof HTMLDivElement)) return;
		menu.replaceChildren();
		for (const item of items) {
			const button = document.createElement("button");
			button.type = "button";
			button.className = "context-menu__item";
			button.textContent = item.label;
			button.addEventListener("click", () => {
				// Dismiss the menu first so an item that opens the popover
				// (e.g. "Edit…") doesn't have its popover immediately closed
				// by a wholesale dismissOverlays() call.
				const menuEl = document.getElementById("context-menu");
				if (menuEl) {
					menuEl.classList.add("hide");
					menuEl.setAttribute("aria-hidden", "true");
				}
				item.run();
			});
			menu.append(button);
		}
		menu.classList.remove("hide");
		menu.setAttribute("aria-hidden", "false");
		this.positionFloating(menu, clientX, clientY);
	};

	private openSegmentEditor = (id: string, event: MouseEvent): void => {
		const segment = this.peaks.segments.getSegment(id);
		if (!segment) return;
		const popover = this.popoverElement();
		if (!popover) return;
		popover.replaceChildren();

		const labelInput = createTextInput(segment.labelText);
		labelInput.dataset.editField = "labelText";
		const startInput = createNumberInput(segment.startTime);
		startInput.dataset.editField = "startTime";
		const endInput = createNumberInput(segment.endTime);
		endInput.dataset.editField = "endTime";
		const colorInput = createColorInput(segment.color ?? "#5fa8d3");
		colorInput.dataset.editField = "color";

		popover.append(
			wrapField("Label", labelInput),
			row(wrapField("Start (s)", startInput), wrapField("End (s)", endInput)),
			wrapField("Color", colorInput),
			actions([
				{
					action: "apply-edit",
					label: "Apply",
					primary: true,
					run: () => {
						const start = Number(startInput.value);
						const end = Number(endInput.value);
						if (
							!Number.isFinite(start) ||
							!Number.isFinite(end) ||
							end < start
						) {
							return;
						}
						segment.update({
							color: colorInput.value,
							endTime: end,
							labelText: labelInput.value,
							startTime: Math.max(0, start),
						});
						this.dismissOverlays();
					},
				},
				{ label: "Cancel", run: () => this.dismissOverlays() },
			]),
		);

		popover.classList.remove("hide");
		popover.setAttribute("aria-hidden", "false");
		this.positionFloating(popover, event.clientX, event.clientY);
		labelInput.focus();
	};

	private openPointEditor = (id: string, event: MouseEvent): void => {
		const point = this.peaks.points.getPoint(id);
		if (!point) return;
		const popover = this.popoverElement();
		if (!popover) return;
		popover.replaceChildren();

		const labelInput = createTextInput(point.labelText);
		labelInput.dataset.editField = "labelText";
		const timeInput = createNumberInput(point.time);
		timeInput.dataset.editField = "time";
		const colorInput = createColorInput(point.color ?? "#5fa8d3");
		colorInput.dataset.editField = "color";

		popover.append(
			wrapField("Label", labelInput),
			wrapField("Time (s)", timeInput),
			wrapField("Color", colorInput),
			actions([
				{
					action: "apply-edit",
					label: "Apply",
					primary: true,
					run: () => {
						const time = Number(timeInput.value);
						if (!Number.isFinite(time) || time < 0) return;
						point.update({
							color: colorInput.value,
							labelText: labelInput.value,
							time,
						});
						this.dismissOverlays();
					},
				},
				{ label: "Cancel", run: () => this.dismissOverlays() },
			]),
		);

		popover.classList.remove("hide");
		popover.setAttribute("aria-hidden", "false");
		this.positionFloating(popover, event.clientX, event.clientY);
		labelInput.focus();
	};

	private popoverElement(): HTMLDivElement | undefined {
		const el = document.getElementById("edit-popover");
		return el instanceof HTMLDivElement ? el : undefined;
	}

	private positionFloating(
		element: HTMLElement,
		clientX: number,
		clientY: number,
	): void {
		// Render once to measure.
		element.style.left = `${clientX}px`;
		element.style.top = `${clientY}px`;
		const rect = element.getBoundingClientRect();
		const maxX = window.innerWidth - rect.width - 8;
		const maxY = window.innerHeight - rect.height - 8;
		element.style.left = `${Math.max(8, Math.min(clientX, maxX))}px`;
		element.style.top = `${Math.max(8, Math.min(clientY, maxY))}px`;
	}

	private dismissOverlays = (): void => {
		for (const id of ["context-menu", "edit-popover"]) {
			const el = document.getElementById(id);
			if (el) {
				el.classList.add("hide");
				el.setAttribute("aria-hidden", "true");
			}
		}
	};

	private onDocumentClickDismiss = (event: MouseEvent): void => {
		const target = event.target;
		if (!(target instanceof Node)) return;
		const menu = document.getElementById("context-menu");
		const popover = document.getElementById("edit-popover");
		const inMenu =
			menu && !menu.classList.contains("hide") && menu.contains(target);
		const inPopover =
			popover &&
			!popover.classList.contains("hide") &&
			popover.contains(target);
		if (inMenu || inPopover) return;
		// Close on any outside click; the listener is registered with
		// `capture: true` so it fires before action handlers.
		this.dismissOverlays();
	};

	private onDocumentKeydown = (event: KeyboardEvent): void => {
		if (event.key === "Escape") {
			this.dismissOverlays();
		}
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

function parseTimeSignature(value: string): TimeSignature {
	const parts = value.split("/");
	const num = Number.parseInt(parts[0] ?? "", 10);
	const den = Number.parseInt(parts[1] ?? "", 10);
	if (!Number.isFinite(num) || !Number.isFinite(den) || num <= 0 || den <= 0) {
		return { denominator: 4, numerator: 4 };
	}
	return { denominator: den, numerator: num };
}

function createTextInput(value: string): HTMLInputElement {
	const el = document.createElement("input");
	el.type = "text";
	el.value = value;
	return el;
}

function createNumberInput(value: number): HTMLInputElement {
	const el = document.createElement("input");
	el.type = "number";
	el.step = "0.01";
	el.min = "0";
	el.value = value.toFixed(2);
	return el;
}

function createColorInput(value: string): HTMLInputElement {
	const el = document.createElement("input");
	el.type = "color";
	el.value = value;
	return el;
}

function wrapField(label: string, control: HTMLElement): HTMLLabelElement {
	const lab = document.createElement("label");
	const span = document.createElement("span");
	span.textContent = label;
	lab.append(span, control);
	return lab;
}

function row(...children: readonly HTMLElement[]): HTMLDivElement {
	const r = document.createElement("div");
	r.className = "edit-popover__row";
	r.append(...children);
	return r;
}

interface ActionSpec {
	readonly label: string;
	readonly primary?: boolean;
	readonly action?: string;
	readonly run: () => void;
}

function actions(specs: readonly ActionSpec[]): HTMLDivElement {
	const container = document.createElement("div");
	container.className = "edit-popover__actions";
	for (const spec of specs) {
		const button = document.createElement("button");
		button.type = "button";
		button.className = spec.primary ? "btn btn--primary" : "btn";
		button.textContent = spec.label;
		if (spec.action !== undefined) button.dataset.action = spec.action;
		button.addEventListener("click", spec.run);
		container.append(button);
	}
	return container;
}
