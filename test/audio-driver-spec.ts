import { PollingSegmentPlayer } from "../src/driver/audio/segment-polling";
import { FakeAudioDriver } from "../src/driver/audio/test/fake";
import { createPeaksEvents } from "../src/events";
import type { Segment } from "../src/segment";

function makeSegment(startTime: number, endTime: number): Segment {
	return { endTime, startTime } as unknown as Segment;
}

describe("PollingSegmentPlayer", () => {
	it("seeks to segment start and triggers play when started", async () => {
		const events = createPeaksEvents();
		let playing = false;
		let currentTime = 0;
		const seeks: number[] = [];
		const pauses: number[] = [];
		let playCalls = 0;

		const player = PollingSegmentPlayer.from({
			events,
			getCurrentTime: () => currentTime,
			isPlaying: () => playing,
			pause: () => {
				playing = false;
				pauses.push(currentTime);
			},
			play: () => {
				playCalls += 1;
				playing = true;
				return Promise.resolve();
			},
			schedule: () => {
				// no-op: tests drive ticks via dispatching events directly
			},
			seek: (t) => {
				seeks.push(t);
				currentTime = t;
			},
		});

		await player.start(makeSegment(10, 20), false);

		expect(seeks).toEqual([10]);
		expect(playCalls).toBe(1);
		expect(playing).toBe(true);
	});

	it("dispatches player.ended when boundary crossed without loop", async () => {
		const events = createPeaksEvents();
		let playing = false;
		let currentTime = 0;
		let endedCount = 0;
		events.addEventListener("player.ended", () => {
			endedCount += 1;
		});

		const ticks: Array<() => void> = [];
		const player = PollingSegmentPlayer.from({
			events,
			getCurrentTime: () => currentTime,
			isPlaying: () => playing,
			pause: () => {
				playing = false;
			},
			play: () => {
				playing = true;
				return Promise.resolve();
			},
			schedule: (cb) => {
				ticks.push(cb);
			},
			seek: (t) => {
				currentTime = t;
			},
		});

		await player.start(makeSegment(0, 5), false);
		// Trigger the once-listener
		events.dispatch("player.playing", { time: 0 });
		// Advance the clock past the segment
		currentTime = 6;
		// Run scheduled ticks
		while (ticks.length > 0) {
			const cb = ticks.shift();
			cb?.();
		}

		expect(endedCount).toBe(1);
		expect(playing).toBe(false);
	});

	it("loops back to start and dispatches player.looped", async () => {
		const events = createPeaksEvents();
		let playing = false;
		let currentTime = 0;
		let loopedCount = 0;
		events.addEventListener("player.looped", () => {
			loopedCount += 1;
		});

		const ticks: Array<() => void> = [];
		const player = PollingSegmentPlayer.from({
			events,
			getCurrentTime: () => currentTime,
			isPlaying: () => playing,
			pause: () => {
				playing = false;
			},
			play: () => {
				playing = true;
				return Promise.resolve();
			},
			schedule: (cb) => {
				ticks.push(cb);
			},
			seek: (t) => {
				currentTime = t;
			},
		});

		await player.start(makeSegment(2, 4), true);
		events.dispatch("player.playing", { time: 2 });
		// One frame: still inside segment
		currentTime = 3;
		ticks.shift()?.();
		expect(loopedCount).toBe(0);
		// Cross boundary
		currentTime = 5;
		ticks.shift()?.();
		expect(loopedCount).toBe(1);
		expect(currentTime).toBe(2);
		expect(playing).toBe(true);

		// stop() halts the loop
		player.stop();
	});
});

describe("FakeAudioDriver", () => {
	it("dispatches deterministic events on play/pause/seek", async () => {
		const events = createPeaksEvents();
		const driver = FakeAudioDriver.default();
		await driver.init({ events });

		await driver.play();
		driver.tick(1);
		driver.pause();

		const names = driver.log.map((e) => e.name);
		expect(names).toContain("player.playing");
		expect(names).toContain("player.timeupdate");
		expect(names).toContain("player.pause");
		expect(driver.getCurrentTime()).toBe(1);
	});

	it("playSegment ends after the segment when not looping", async () => {
		const events = createPeaksEvents();
		const driver = FakeAudioDriver.from({ duration: 10 });
		await driver.init({ events });

		let endedCount = 0;
		events.addEventListener("player.ended", () => {
			endedCount += 1;
		});

		await driver.playSegment({
			loop: false,
			segment: makeSegment(2, 4),
		});
		driver.tick(3);

		expect(endedCount).toBe(1);
		expect(driver.isPlaying()).toBe(false);
	});

	it("playSegment loops while looping", async () => {
		const events = createPeaksEvents();
		const driver = FakeAudioDriver.from({ duration: 10 });
		await driver.init({ events });

		let loopedCount = 0;
		events.addEventListener("player.looped", () => {
			loopedCount += 1;
		});

		await driver.playSegment({
			loop: true,
			segment: makeSegment(0, 2),
		});
		driver.tick(3);
		expect(loopedCount).toBe(1);
		expect(driver.getCurrentTime()).toBe(0);
		driver.tick(3);
		expect(loopedCount).toBe(2);
	});
});
