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

function showError(message: string): void {
	const status = byId("status", HTMLParagraphElement);
	status.textContent = "Failed to initialise";
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
			highlightColor: "#5fa8d3",
			highlightOpacity: 0.25,
			waveformColor: "rgba(95, 168, 211, 0.5)",
		},
		playheadColor: "#ffffff",
		pointMarkerColor: "#006eb0",
		scrollbar: { container: div("scrollbar-container") },
		segmentOptions: {
			endMarkerColor: "#ffffff",
			startMarkerColor: "#ffffff",
			waveformColor: "#5fa8d3",
		},
		showPlayheadTime: true,
		url: AUDIO_URL,
		zoomLevels: ZOOM_LEVELS,
		zoomview: {
			container: div("zoomview-container"),
			showPlayheadTime: true,
			waveformColor: "rgba(95, 168, 211, 0.5)",
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

	const loopController = LoopController.from({
		onChange: setLoopStatus,
		peaks,
	});

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
			editable: true,
			endTime: 12,
			id: "segment-1",
			labelText: "Loop A",
			startTime: 5,
		},
		{
			editable: true,
			endTime: 38,
			id: "segment-2",
			labelText: "Loop B",
			startTime: 30,
		},
	]);
	peaks.points.add({
		editable: true,
		id: "point-1",
		labelText: "Marker",
		time: 20,
	});

	// Re-create LoopController if the Peaks instance is ever swapped (not
	// triggered today, but reserved for future "Recreate" button).
	void loopController;
}

main().catch((error: unknown) => {
	const message = error instanceof Error ? error.message : String(error);
	showError(message);
});
