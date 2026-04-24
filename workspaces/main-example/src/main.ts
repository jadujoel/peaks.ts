import {
	ClipNodeAudioDriver,
	Peaks,
	PixiCanvasDriver,
} from "@jadujoel/peaks.ts";
import { Controls } from "./controls";
import { byId, div } from "./dom";
import { LoopController } from "./loop-controller";

const AUDIO_URL = "/sample.mp3";
const ZOOM_LEVELS: readonly number[] = [128, 256, 512, 1024, 2048, 4096];

interface AppState {
	audioContext: AudioContext;
	buffer: AudioBuffer;
	multiChannel: boolean;
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

async function fetchBuffer(
	url: string,
	context: AudioContext,
): Promise<AudioBuffer> {
	const response = await fetch(url);
	const arrayBuffer = await response.arrayBuffer();
	return context.decodeAudioData(arrayBuffer);
}

async function initPeaks(state: AppState): Promise<Peaks> {
	const audioDriver = ClipNodeAudioDriver.from({
		buffer: state.buffer,
		context: state.audioContext,
	});
	const driver = await PixiCanvasDriver.create();

	const result = await Peaks.from({
		audio: audioDriver,
		driver,
		emitCueEvents: true,
		keyboard: true,
		overview: { container: div("overview-container") },
		pointMarkerColor: "#006eb0",
		scrollbar: { container: div("scrollbar-container") },
		showPlayheadTime: true,
		webAudio: {
			buffer: state.buffer,
			multiChannel: state.multiChannel,
			scale: 128,
		},
		zoomLevels: ZOOM_LEVELS,
		zoomview: {
			container: div("zoomview-container"),
			showPlayheadTime: true,
		},
	});

	if (result.isErr()) {
		throw result.error;
	}
	return result.value;
}

async function main(): Promise<void> {
	const audioContext = new AudioContext();
	const buffer = await fetchBuffer(AUDIO_URL, audioContext);
	const state: AppState = { audioContext, buffer, multiChannel: false };

	const peaks = await initPeaks(state);
	(globalThis as unknown as { peaksInstance: Peaks }).peaksInstance = peaks;

	const status = byId("status", HTMLParagraphElement);
	status.textContent = "Ready";

	const loopController = LoopController.from({
		onChange: setLoopStatus,
		peaks,
	});

	const channelSwitcher = async (mode: "mono" | "stereo"): Promise<void> => {
		state.multiChannel = mode === "stereo";
		// `setSource` returns via callback in the public API.
		await new Promise<void>((resolveSwap, rejectSwap) => {
			peaks.setSource(
				{
					webAudio: {
						buffer: state.buffer,
						multiChannel: state.multiChannel,
						scale: 128,
					},
					zoomLevels: ZOOM_LEVELS,
				},
				(err) => {
					if (err) rejectSwap(err);
					else resolveSwap();
				},
			);
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
