import { describe, expect, it, vi } from "vitest";
import { createPeaksEvents, type PeaksEvents } from "../src/events";
import { LoopController } from "../src/loop-controller";
import type { Segment } from "../src/segment";
import type { PeaksInstance } from "../src/types";

interface PlayerStub {
	getCurrentTime: () => number;
	getDuration: () => number;
	play: () => Promise<void>;
	pause: () => void;
	playLooped: () => Promise<void>;
	playSegment: (segment: Segment, loop: boolean) => Promise<void>;
	seek: (time: number) => void;
	setLoopBounds: (startTime: number, endTime: number) => void;
	isPlaying: () => boolean;
	isSeeking: () => boolean;
	init: () => Promise<void>;
	dispose: () => void;
	setSource: () => Promise<void>;
}

function makePeaks(
	player: PlayerStub,
	events: PeaksEvents = createPeaksEvents(),
): PeaksInstance {
	return { events, player } as unknown as PeaksInstance;
}

function makePlayer(overrides: Partial<PlayerStub> = {}): PlayerStub {
	return {
		dispose: () => {},
		getCurrentTime: () => 0,
		getDuration: () => 60,
		init: () => Promise.resolve(),
		isPlaying: () => false,
		isSeeking: () => false,
		pause: () => {},
		play: () => Promise.resolve(),
		playLooped: () => Promise.resolve(),
		playSegment: () => Promise.resolve(),
		seek: () => {},
		setLoopBounds: () => {},
		setSource: () => Promise.resolve(),
		...overrides,
	};
}

function makeSegment(
	id: string,
	startTime: number,
	endTime: number,
	labelText = "",
): Segment {
	return { endTime, id, labelText, startTime } as unknown as Segment;
}

describe("LoopController", () => {
	it("loopFile delegates to player.playLooped and reports state", async () => {
		const playLooped = vi.fn().mockResolvedValue(undefined);
		const player = makePlayer({ playLooped });
		const labels: string[] = [];
		const controller = LoopController.from({
			onChange: (label) => labels.push(label),
			peaks: makePeaks(player),
		});

		await controller.loopFile();

		expect(playLooped).toHaveBeenCalledOnce();
		expect(controller.state()).toEqual({ kind: "file" });
		expect(controller.currentSegmentId()).toBe(undefined);
		expect(labels).toEqual(["entire file"]);
	});

	it("loopFile is a no-op when duration is non-positive", async () => {
		const playLooped = vi.fn();
		const player = makePlayer({ getDuration: () => 0, playLooped });
		const controller = LoopController.from({ peaks: makePeaks(player) });

		await controller.loopFile();
		expect(playLooped).not.toHaveBeenCalled();
		expect(controller.state()).toEqual({ kind: "none" });
	});

	it("loopSegment tracks segment id and forwards loop=true", async () => {
		const playSegment = vi.fn().mockResolvedValue(undefined);
		const player = makePlayer({ playSegment });
		const labels: string[] = [];
		const controller = LoopController.from({
			onChange: (label) => labels.push(label),
			peaks: makePeaks(player),
		});

		const segment = makeSegment("seg-1", 5, 12, "Loop A");
		await controller.loopSegment(segment);

		expect(playSegment).toHaveBeenCalledWith(segment, true);
		expect(controller.state()).toEqual({ id: "seg-1", kind: "segment" });
		expect(controller.currentSegmentId()).toBe("seg-1");
		expect(labels[0]).toContain("Loop A");
		expect(labels[0]).toContain("5.00");
		expect(labels[0]).toContain("12.00");
	});

	it("stop pauses the player and clears state", async () => {
		const pause = vi.fn();
		const player = makePlayer({ isPlaying: () => true, pause });
		const labels: string[] = [];
		const controller = LoopController.from({
			onChange: (label) => labels.push(label),
			peaks: makePeaks(player),
		});
		await controller.loopFile();

		controller.stop();

		expect(pause).toHaveBeenCalledOnce();
		expect(controller.state()).toEqual({ kind: "none" });
		expect(controller.currentSegmentId()).toBe(undefined);
		expect(labels).toEqual(["entire file", "(none)"]);
	});

	it("falls back to segment id when label is empty", async () => {
		const labels: string[] = [];
		const controller = LoopController.from({
			onChange: (label) => labels.push(label),
			peaks: makePeaks(makePlayer()),
		});

		await controller.loopSegment(makeSegment("seg-x", 1, 2));
		expect(labels[0]?.startsWith("seg-x")).toBe(true);
	});

	it("re-arms the active loop when the segment fires segments.update", async () => {
		const setLoopBounds = vi.fn();
		const seek = vi.fn();
		const player = makePlayer({
			getCurrentTime: () => 10,
			seek,
			setLoopBounds,
		});
		const events = createPeaksEvents();
		const controller = LoopController.from({
			peaks: makePeaks(player, events),
		});

		const segment = makeSegment("seg-1", 5, 12);
		await controller.loopSegment(segment);

		// Simulate a programmatic update that pushes endTime later — playhead
		// is still inside the new range so no seek-back should occur.
		(segment as unknown as { endTime: number }).endTime = 15;
		events.dispatch("segments.update", { options: {}, segment });

		expect(setLoopBounds).toHaveBeenCalledWith(5, 15);
		expect(seek).not.toHaveBeenCalled();
	});

	it("re-arms and rewinds when the new endTime is past the playhead", async () => {
		const setLoopBounds = vi.fn();
		const seek = vi.fn();
		const player = makePlayer({
			getCurrentTime: () => 11,
			seek,
			setLoopBounds,
		});
		const events = createPeaksEvents();
		const controller = LoopController.from({
			peaks: makePeaks(player, events),
		});

		const segment = makeSegment("seg-1", 5, 12);
		await controller.loopSegment(segment);

		// Shrink the loop end below the current playhead
		(segment as unknown as { endTime: number }).endTime = 9;
		events.dispatch("segments.dragged", {
			evt: new MouseEvent("mousemove"),
			marker: true,
			segment,
			startMarker: false,
		});

		expect(setLoopBounds).toHaveBeenCalledWith(5, 9);
		expect(seek).toHaveBeenCalledWith(5);
	});

	it("ignores updates for segments that are not the active loop", async () => {
		const setLoopBounds = vi.fn();
		const player = makePlayer({ setLoopBounds });
		const events = createPeaksEvents();
		const controller = LoopController.from({
			peaks: makePeaks(player, events),
		});

		await controller.loopSegment(makeSegment("seg-1", 0, 10));

		const other = makeSegment("seg-2", 20, 30);
		events.dispatch("segments.update", { options: {}, segment: other });

		expect(setLoopBounds).not.toHaveBeenCalled();
	});

	it("dispose detaches from the event bus", async () => {
		const setLoopBounds = vi.fn();
		const player = makePlayer({ setLoopBounds });
		const events = createPeaksEvents();
		const controller = LoopController.from({
			peaks: makePeaks(player, events),
		});

		const segment = makeSegment("seg-1", 5, 12);
		await controller.loopSegment(segment);
		controller.dispose();

		(segment as unknown as { endTime: number }).endTime = 15;
		events.dispatch("segments.update", { options: {}, segment });

		expect(setLoopBounds).not.toHaveBeenCalled();
	});
});
