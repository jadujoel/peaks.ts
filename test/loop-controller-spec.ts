import { describe, expect, it, vi } from "vitest";
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
	isPlaying: () => boolean;
	isSeeking: () => boolean;
	init: () => Promise<void>;
	dispose: () => void;
	setSource: () => Promise<void>;
}

function makePeaksWithPlayer(player: PlayerStub): PeaksInstance {
	return {
		player,
	} as unknown as PeaksInstance;
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
		const player: PlayerStub = {
			dispose: () => {},
			getCurrentTime: () => 0,
			getDuration: () => 60,
			init: () => Promise.resolve(),
			isPlaying: () => false,
			isSeeking: () => false,
			pause: () => {},
			play: () => Promise.resolve(),
			playLooped,
			playSegment: () => Promise.resolve(),
			seek: () => {},
			setSource: () => Promise.resolve(),
		};
		const labels: string[] = [];
		const controller = LoopController.from({
			onChange: (label) => labels.push(label),
			peaks: makePeaksWithPlayer(player),
		});

		await controller.loopFile();

		expect(playLooped).toHaveBeenCalledOnce();
		expect(controller.state()).toEqual({ kind: "file" });
		expect(controller.currentSegmentId()).toBe(undefined);
		expect(labels).toEqual(["entire file"]);
	});

	it("loopFile is a no-op when duration is non-positive", async () => {
		const playLooped = vi.fn();
		const player: PlayerStub = {
			dispose: () => {},
			getCurrentTime: () => 0,
			getDuration: () => 0,
			init: () => Promise.resolve(),
			isPlaying: () => false,
			isSeeking: () => false,
			pause: () => {},
			play: () => Promise.resolve(),
			playLooped,
			playSegment: () => Promise.resolve(),
			seek: () => {},
			setSource: () => Promise.resolve(),
		};
		const controller = LoopController.from({
			peaks: makePeaksWithPlayer(player),
		});

		await controller.loopFile();
		expect(playLooped).not.toHaveBeenCalled();
		expect(controller.state()).toEqual({ kind: "none" });
	});

	it("loopSegment tracks segment id and forwards loop=true", async () => {
		const playSegment = vi.fn().mockResolvedValue(undefined);
		const player: PlayerStub = {
			dispose: () => {},
			getCurrentTime: () => 0,
			getDuration: () => 60,
			init: () => Promise.resolve(),
			isPlaying: () => false,
			isSeeking: () => false,
			pause: () => {},
			play: () => Promise.resolve(),
			playLooped: () => Promise.resolve(),
			playSegment,
			seek: () => {},
			setSource: () => Promise.resolve(),
		};
		const labels: string[] = [];
		const controller = LoopController.from({
			onChange: (label) => labels.push(label),
			peaks: makePeaksWithPlayer(player),
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
		const player: PlayerStub = {
			dispose: () => {},
			getCurrentTime: () => 0,
			getDuration: () => 60,
			init: () => Promise.resolve(),
			isPlaying: () => true,
			isSeeking: () => false,
			pause,
			play: () => Promise.resolve(),
			playLooped: () => Promise.resolve(),
			playSegment: () => Promise.resolve(),
			seek: () => {},
			setSource: () => Promise.resolve(),
		};
		const labels: string[] = [];
		const controller = LoopController.from({
			onChange: (label) => labels.push(label),
			peaks: makePeaksWithPlayer(player),
		});
		await controller.loopFile();

		controller.stop();

		expect(pause).toHaveBeenCalledOnce();
		expect(controller.state()).toEqual({ kind: "none" });
		expect(controller.currentSegmentId()).toBe(undefined);
		expect(labels).toEqual(["entire file", "(none)"]);
	});

	it("falls back to segment id when label is empty", async () => {
		const player: PlayerStub = {
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
			setSource: () => Promise.resolve(),
		};
		const labels: string[] = [];
		const controller = LoopController.from({
			onChange: (label) => labels.push(label),
			peaks: makePeaksWithPlayer(player),
		});

		await controller.loopSegment(makeSegment("seg-x", 1, 2));
		expect(labels[0]?.startsWith("seg-x")).toBe(true);
	});
});
