import type { CanvasDriver, CanvasDriverKind } from "@jadujoel/peaks.ts";
import {
	createCanvasDriver,
	LoopController,
	Peaks,
	TempoMap,
} from "@jadujoel/peaks.ts";
import { Controls } from "./controls";
import { byId, div, select } from "./dom";

const AUDIO_URL = "./sample.mp3";
const ZOOM_LEVELS: readonly number[] = [128, 256, 512, 1024, 2048, 4096];
const DRIVER_STORAGE_KEY = "peaks-example-driver";

type DriverChoice = CanvasDriverKind;

interface AppState {
	audioContext: AudioContext;
	stereo: boolean;
}

function isDriverChoice(value: string | null): value is DriverChoice {
	return value === "konva" || value === "pixi";
}

function getInitialDriver(): DriverChoice {
	const params = new URLSearchParams(globalThis.location.search);
	const fromQuery = params.get("driver");
	if (isDriverChoice(fromQuery)) return fromQuery;
	const fromStorage = globalThis.localStorage?.getItem(DRIVER_STORAGE_KEY);
	if (isDriverChoice(fromStorage)) return fromStorage;
	return "konva";
}

function createDriver(choice: DriverChoice): Promise<CanvasDriver> {
	return createCanvasDriver({ kind: choice });
}

function setupDriverSelector(current: DriverChoice): void {
	const selectEl = select("driver");
	selectEl.value = current;
	selectEl.addEventListener("change", () => {
		const next = selectEl.value;
		if (!isDriverChoice(next) || next === current) return;
		globalThis.localStorage?.setItem(DRIVER_STORAGE_KEY, next);
		const url = new URL(globalThis.location.href);
		url.searchParams.set("driver", next);
		globalThis.location.assign(url.toString());
	});
}

function setStatusChip(text: string, live = false): void {
	const chip = document.getElementById("status-chip");
	const label = document.getElementById("status-chip-text");
	if (label) label.textContent = text;
	if (chip) chip.classList.toggle("chip--live", live);
}

function showError(message: string): void {
	const status = byId("status", HTMLParagraphElement);
	status.textContent = "Failed to initialise";
	setStatusChip("error", false);
	const errorPre = byId("error", HTMLPreElement);
	errorPre.textContent = `Initialization error: ${message}`;
	errorPre.classList.remove("hide");
	console.error(message);
}

function setLoopStatus(text: string): void {
	const out = byId("loop-status", HTMLOutputElement);
	out.value = text;
}

async function initPeaks(
	state: AppState,
	driverChoice: DriverChoice,
): Promise<Peaks> {
	const driver = await createDriver(driverChoice);

	const peaks = await Peaks.fromUrl({
		audioContext: state.audioContext,
		axisGridlineColor: "#3a4150",
		axisLabelColor: "#9aa3b2",
		data: {
			scale: 128,
			stereo: state.stereo,
			type: "webaudio",
		},
		driver,
		emitCueEvents: true,
		keyboard: true,
		overview: {
			container: div("overview-container"),
			highlightColor: "#5eead4",
			highlightOpacity: 0.18,
			segmentOptions: {
				overlayOffset: 0,
				overlayOpacity: 0.22,
			},
			waveformColor: "#5eead4",
		},
		playheadColor: "#fafafa",
		pointMarkerColor: "#fbbf24",
		scrollbar: { container: div("scrollbar-container") },
		segmentOptions: {
			endMarkerColor: "#5eead4",
			overlay: true,
			overlayBorderWidth: 0,
			overlayCornerRadius: 4,
			overlayFontSize: 11,
			overlayLabelAlign: "left",
			overlayLabelColor: "#e2e8f0",
			overlayLabelPadding: 6,
			overlayLabelVerticalAlign: "top",
			overlayOffset: 0,
			overlayOpacity: 0.18,
			overlayShowWaveform: true,
			startMarkerColor: "#5eead4",
			waveformColor: "#5eead4",
		},
		showPlayheadTime: true,
		url: AUDIO_URL,
		zoomLevels: ZOOM_LEVELS,
		zoomview: {
			container: div("zoomview-container"),
			playedWaveformColor: "#0d9488",
			segmentOptions: {
				overlayOffset: 0,
			},
			showPlayheadTime: true,
			waveformColor: "#5eead4",
		},
	});

	return peaks;
}

async function main(): Promise<void> {
	const driverChoice = getInitialDriver();
	setupDriverSelector(driverChoice);

	const audioContext = new AudioContext();
	const state: AppState = { audioContext, stereo: false };

	const peaks = await initPeaks(state, driverChoice);
	(globalThis as unknown as { peaksInstance: Peaks }).peaksInstance = peaks;
	(
		globalThis as unknown as { PeaksTest: { TempoMap: typeof TempoMap } }
	).PeaksTest = { TempoMap };

	const status = byId("status", HTMLParagraphElement);
	status.textContent = "Ready";
	setStatusChip("ready", true);
	peaks.events.addEventListener("player.playing", () =>
		setStatusChip("playing", true),
	);
	peaks.events.addEventListener("player.pause", () =>
		setStatusChip("paused", false),
	);
	peaks.events.addEventListener("player.ended", () =>
		setStatusChip("ended", false),
	);

	const loopController = LoopController.from({
		onChange: setLoopStatus,
		peaks,
	});
	(
		globalThis as unknown as { __loopController: LoopController }
	).__loopController = loopController;

	const channelSwitcher = async (mode: "mono" | "stereo"): Promise<void> => {
		state.stereo = mode === "stereo";
		await peaks.setSource({
			data: {
				scale: 128,
				stereo: state.stereo,
				type: "webaudio",
			},
		});
	};

	Controls.from({
		channelSwitcher,
		loopController,
		peaks,
		zoomLevels: ZOOM_LEVELS,
	});

	// Seed the demo with two example segments and one point so the UI
	// has interactive content immediately.
	peaks.segments.add([
		{
			color: "#5eead4",
			editable: true,
			endTime: 12,
			id: "segment-1",
			labelText: "Loop A",
			startTime: 5,
		},
		{
			color: "#a78bfa",
			editable: true,
			endTime: 22,
			id: "segment-verse",
			labelText: "Verse",
			startTime: 13,
		},
		{
			color: "#7dd3fc",
			editable: true,
			endTime: 27,
			id: "segment-2",
			labelText: "Loop B",
			startTime: 22,
		},
		{
			color: "#f472b6",
			editable: true,
			endTime: 32,
			id: "segment-drop",
			labelText: "Drop",
			startTime: 27,
		},
	]);
	peaks.points.add([
		{
			color: "#fbbf24",
			editable: true,
			id: "point-1",
			labelText: "Marker",
			time: 20,
		},
		{
			color: "#f97316",
			editable: true,
			id: "point-hit",
			labelText: "Hit",
			time: 28,
		},
	]);

	// Re-create LoopController if the Peaks instance is ever swapped (not
	// triggered today, but reserved for future "Recreate" button).
	void loopController;
}

main().catch((error: unknown) => {
	const message = error instanceof Error ? error.message : String(error);
	showError(message);
});
