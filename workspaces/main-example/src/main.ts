import type { CanvasDriver, CanvasDriverKind } from "@jadujoel/peaks.ts";
import {
	createCanvasDriver,
	LoopController,
	Peaks,
	TempoMap,
} from "@jadujoel/peaks.ts";
import { Controls } from "./controls";
import { byId, div, input, select } from "./dom";

const ANGSTEN_OPUS_URL = "./angsten.opus";
const ANGSTEN_MP3_URL = "./angsten.mp3";
const DEFAULT_WAVEFORM_DAT = "./angsten.dat";
const ZOOM_LEVELS: readonly number[] = [128, 256, 512, 1024, 2048, 4096];

function pickDefaultAudioUrl(): { url: string; name: string; codec: string } {
	const probe = document.createElement("audio");
	const canOpus = probe.canPlayType('audio/ogg; codecs="opus"');
	if (canOpus === "probably" || canOpus === "maybe") {
		return { codec: "opus", name: "angsten.opus", url: ANGSTEN_OPUS_URL };
	}
	return { codec: "mp3", name: "angsten.mp3", url: ANGSTEN_MP3_URL };
}

async function probeOpusDecodable(context: AudioContext): Promise<boolean> {
	try {
		const response = await fetch(ANGSTEN_OPUS_URL);
		if (!response.ok) return false;
		const buffer = await response.arrayBuffer();
		await context.decodeAudioData(buffer.slice(0));
		return true;
	} catch {
		return false;
	}
}
const DRIVER_STORAGE_KEY = "peaks-example-driver";

type DriverChoice = CanvasDriverKind;

interface AppState {
	audioContext: AudioContext;
	stereo: boolean;
	audioUrl: string;
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

function setLoadedFileName(name: string): void {
	const el = document.querySelector(".file-chip__name");
	if (el) el.textContent = name;
}

function wireFileUpload(state: AppState, peaks: Peaks): void {
	const fileInput = input("audio-file");
	let lastObjectUrl: string | undefined;

	fileInput.addEventListener("change", () => {
		const file = fileInput.files?.[0];
		if (!file) return;
		void loadUserAudio(file);
	});

	async function loadUserAudio(file: File): Promise<void> {
		setStatusChip("loading…", false);
		try {
			const arrayBuffer = await file.arrayBuffer();
			// Decode against a copy so the buffer isn't transferred and the
			// underlying data stays available for re-decoding by other code.
			const buffer = await state.audioContext.decodeAudioData(
				arrayBuffer.slice(0),
			);
			if (lastObjectUrl) URL.revokeObjectURL(lastObjectUrl);
			lastObjectUrl = URL.createObjectURL(file);
			await peaks.setSource({
				data: {
					buffer,
					context: state.audioContext,
					scale: 128,
					stereo: state.stereo,
					type: "webaudio",
				},
				mediaUrl: lastObjectUrl,
				webAudio: { buffer, context: state.audioContext },
			});
			setLoadedFileName(file.name);
			setStatusChip("ready", true);
		} catch (error) {
			console.error("upload load failed", error);
			setStatusChip("error", false);
		}
	}
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
			arraybuffer: DEFAULT_WAVEFORM_DAT,
			type: "uri",
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
		url: state.audioUrl,
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
	const initialAudio = pickDefaultAudioUrl();
	let defaultAudio = initialAudio;
	// canPlayType may report "maybe" for opus on browsers that nevertheless
	// can't decode it through Web Audio (notably Safari/WebKit). Verify by
	// actually decoding a small chunk before committing to opus.
	if (initialAudio.codec === "opus") {
		const opusOk = await probeOpusDecodable(audioContext);
		if (!opusOk) {
			defaultAudio = {
				codec: "mp3",
				name: "angsten.mp3",
				url: ANGSTEN_MP3_URL,
			};
		}
	}
	const state: AppState = {
		audioContext,
		audioUrl: defaultAudio.url,
		stereo: false,
	};
	setLoadedFileName(defaultAudio.name);

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

	wireFileUpload(state, peaks);

	// Seed the demo with example segments and one point so the UI
	// has interactive content immediately. Times correspond to the
	// pre-computed `angsten.opus` waveform shipped with the demo.
	peaks.segments.add([
		{
			color: "#22c55e",
			editable: true,
			endTime: 3.93,
			id: "segment-intro",
			labelText: "Intro",
			startTime: 0,
		},
		{
			color: "#facc15",
			editable: true,
			endTime: 19.97,
			id: "segment-verse-1",
			labelText: "Verse",
			startTime: 3.93,
		},
		{
			color: "#7dd3fc",
			editable: true,
			endTime: 35.93,
			id: "segment-prechorus",
			labelText: "PreChorus",
			startTime: 19.97,
		},
		{
			color: "#f472b6",
			editable: true,
			endTime: 51.97,
			id: "segment-chorus",
			labelText: "Chorus",
			startTime: 35.93,
		},
		{
			color: "#a78bfa",
			editable: true,
			endTime: 67.84,
			id: "segment-bridge",
			labelText: "Bridge",
			startTime: 51.97,
		},
		{
			color: "#ef4444",
			editable: true,
			endTime: 83.97,
			id: "segment-solo",
			labelText: "Solo",
			startTime: 67.84,
		},
		{
			color: "#facc15",
			editable: true,
			endTime: 91.99,
			id: "segment-verse-2",
			labelText: "Verse",
			startTime: 84.15,
		},
		{
			color: "#3b82f6",
			editable: true,
			endTime: 118.95,
			id: "segment-outro",
			labelText: "Outro",
			startTime: 91.99,
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
