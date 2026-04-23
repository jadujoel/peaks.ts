import { Cue } from "../src/cue";
import { CueEmitter } from "../src/cue-emitter";
import { Peaks } from "../src/main";
import { initPeaks } from "./helpers/init-peaks";

type CueEmitterWithCues = {
	cues: Array<{ time: number; type: string }>;
};

describe("CueEmitter", () => {
	let p = null;
	let cueEmitter = null;

	beforeEach((done: DoneCallback) => {
		const options = {
			dataUri: {
				arraybuffer: "base/test/data/sample.dat",
			},
			emitCueEvents: false,
			mediaElement: document.getElementById("media"),
			overview: {
				container: document.getElementById("overview-container"),
			},
			zoomview: {
				container: document.getElementById("zoomview-container"),
			},
		};

		initPeaks(options, (err, instance) => {
			expect(err).to.equal(undefined);

			p = instance;
			cueEmitter = CueEmitter.from({ peaks: instance });

			done();
		});
	});

	afterEach(() => {
		if (p) {
			p.dispose();
			p = null;
		}

		cueEmitter = null;
	});

	it("should initialise correctly", () => {
		expect(p.cueEmitter).to.be.undefined;
		expect(cueEmitter.peaks).equals(p, "instance did not match");
		expect(cueEmitter.cues.length).equals(0, "marker array not empty");
	});

	it("should initialise with already existing points", (done: DoneCallback) => {
		const options = {
			dataUri: {
				arraybuffer: "base/test/data/sample.dat",
			},
			emitCueEvents: true,
			mediaElement: document.getElementById("media"),
			overview: {
				container: document.getElementById("overview-container"),
			},
			points: [{ time: 1.0 }],
			segments: [{ endTime: 1.2, startTime: 1.1 }],
			zoomview: {
				container: document.getElementById("zoomview-container"),
			},
		};

		initPeaks(options, (err, peaks) => {
			expect(err).to.equal(undefined);
			expect(peaks).to.be.an.instanceOf(Peaks);
			expect(peaks.cueEmitter).to.be.an.instanceOf(CueEmitter);
			expect(
				(peaks.cueEmitter as unknown as CueEmitterWithCues).cues.length,
			).to.equal(3);
			done();
		});
	});

	it("should be destroyed when the Peaks instance is destroyed", (done: DoneCallback) => {
		const options = {
			dataUri: {
				arraybuffer: "base/test/data/sample.dat",
			},
			emitCueEvents: true,
			mediaElement: document.getElementById("media"),
			overview: {
				container: document.getElementById("overview-container"),
			},
			zoomview: {
				container: document.getElementById("zoomview-container"),
			},
		};

		initPeaks(options, (err, peaks) => {
			expect(err).to.equal(undefined);
			expect(peaks).to.be.an.instanceOf(Peaks);
			expect(peaks.cueEmitter).to.be.an.instanceOf(CueEmitter);

			p.points.add({ time: 1.0 });
			p.dispose();
			expect(
				(peaks.cueEmitter as unknown as CueEmitterWithCues).cues.length,
			).to.equal(0, "did not empty cues");
			done();
		});
	});

	describe("adding points", () => {
		it("should add cues when point is added", () => {
			p.points.add({ time: 1.0 });
			expect(cueEmitter.cues.length).equals(1, "cues length did not match");
			expect(cueEmitter.cues[0].time).equals(1.0, "cue time did not match");
			expect(cueEmitter.cues[0].type).equals(
				Cue.POINT,
				"cue type did not match",
			);

			p.points.add({ time: 2.0 });
			expect(cueEmitter.cues.length).equals(2, "cues length did not match");
		});

		it("should reorder cues when point is added earlier", () => {
			p.points.add({ time: 1.0 });
			p.points.add({ time: 1.5 });
			expect(cueEmitter.cues[0].time).equals(1.0, "cue time did not match");
			p.points.add({ time: 0.2 });
			expect(cueEmitter.cues[0].time).equals(0.2, "cue time did not match");
		});

		it("should update cues when point is updated", () => {
			const id = "mypoint";

			p.points.add({ id: id, time: 1.1 });
			p.points.add({ id: "other", time: 9.1 });

			expect(cueEmitter.cues[0].id).equals(id, "point id did not match");
			expect(cueEmitter.cues[0].time).equals(1.1, "time did not match");
			expect(cueEmitter.cues[1].time).equals(9.1, "time did not match");

			p.points.getPoint(id).update({ time: 2.2 });
			expect(cueEmitter.cues[0].time).equals(2.2, "time did not match");
			expect(cueEmitter.cues[1].time).equals(9.1, "time did not match");
		});

		it("should remove cues when point is removed", () => {
			p.points.add({ id: "id1", time: 1.1 });
			p.points.add({ time: 9.1 });
			p.points.removeById("id1");
			expect(cueEmitter.cues[0].time).equals(9.1, "time did not match");
		});

		it("should update when all points are removed", () => {
			p.points.add({ time: 2.1 });
			p.points.add({ time: 3.1 });
			p.segments.add({ endTime: 3.2, startTime: 2.2 });
			p.points.removeAll();
			expect(cueEmitter.cues.length).equals(2, "cues length did not match");
		});
	});

	describe("adding segments", () => {
		it("should add start and end cues when segment is added", () => {
			p.segments.add({ endTime: 3.0, startTime: 2.0 });
			expect(cueEmitter.cues.length).equals(2, "cues length did not match");

			expect(cueEmitter.cues[0].time).equals(
				2.0,
				"start cue time did not match",
			);
			expect(cueEmitter.cues[1].time).equals(3.0, "end cue time did not match");

			expect(cueEmitter.cues[0].type).equals(
				Cue.SEGMENT_START,
				"cue type did not match",
			);
			expect(cueEmitter.cues[1].type).equals(
				Cue.SEGMENT_END,
				"cue type did not match",
			);
		});

		it("should reorder cues when segment is added earlier", () => {
			p.segments.add({ endTime: 3.0, id: "seg1", startTime: 2.0 });
			p.segments.add({ endTime: 3.3, id: "seg2", startTime: 2.5 });
			expect(cueEmitter.cues[1].time).equals(
				2.5,
				"seg2 start cue time did not match",
			);
			expect(cueEmitter.cues[2].time).equals(
				3.0,
				"seg1 end cue time did not match",
			);
		});

		it("should update cues when segment is updated", () => {
			p.segments.add({ endTime: 3.0, id: "seg1", startTime: 2.0 });
			p.segments.getSegment("seg1").update({ endTime: 3.3, startTime: 2.2 });
			expect(cueEmitter.cues[0].time).equals(
				2.2,
				"start cue time did not update?",
			);
			expect(cueEmitter.cues[1].time).equals(
				3.3,
				"end cue time did not update?",
			);
		});

		it("should remove cues when segment is removed", () => {
			p.segments.add({ endTime: 3.4, id: "segx", startTime: 3.3 });
			p.points.add({ time: 3.3 });
			p.segments.removeById("segx");
			expect(cueEmitter.cues.length).equals(1, "cues length did not match");
			expect(cueEmitter.cues[0].type).equals(
				Cue.POINT,
				"remaining cue type did not match",
			);
		});

		it("should update when all segments are removed", () => {
			p.segments.add({ endTime: 3.4, id: "segx", startTime: 3.3 });
			p.segments.add({ endTime: 4.4, id: "seg2", startTime: 4.3 });
			p.points.add({ time: 3.3 });
			p.segments.removeAll();
			expect(cueEmitter.cues.length).equals(1, "did not remove all segments?");
			expect(cueEmitter.cues[0].type).equals(
				Cue.POINT,
				"remaining cue type did not match",
			);
		});
	});

	describe("events", () => {
		// Don't run this test in Firefox. The implementation varies depending
		// on whether the window is visible, and we can't detect if we're running
		// Firefox in headless mode.
		if (!navigator.userAgent.match(/Firefox/)) {
			it("should update internal previous time when seeking", () => {
				p.events.dispatch("player.timeupdate", { time: 1.0 });
				expect(cueEmitter.previousTime).equals(
					1.0,
					"did not move previous time",
				);
				p.events.dispatch("player.timeupdate", { time: 2.0 });
				expect(cueEmitter.previousTime).equals(
					2.0,
					"did not move previous time",
				);
			});
		}

		it("should emit point events during forward playback", (done: DoneCallback) => {
			const emitted = [];

			p.points.add({ id: "p1", time: 1.05 });
			p.points.add({ id: "p2", time: 1.07 });
			p.points.add({ id: "p3", time: 1.09 });

			p.events.addEventListener("points.enter", (event) => {
				emitted.push(event.point.id);

				expect(event.time).to.equal(1.1);

				if (emitted.length === 3) {
					expect(emitted).to.deep.equal(["p1", "p2", "p3"]);
					done();
				}
			});

			cueEmitter.emitCueCrossings(1.1, 1.0);
		});

		it("should emit point events during reverse playback", (done: DoneCallback) => {
			const emitted = [];

			p.points.add({ id: "p1", time: 1.05 });
			p.points.add({ id: "p2", time: 1.07 });
			p.points.add({ id: "p3", time: 1.09 });

			p.events.addEventListener("points.enter", (event) => {
				emitted.push(event.point.id);

				expect(event.time).to.equal(1.0);

				if (emitted.length === 3) {
					expect(emitted).to.deep.equal(["p3", "p2", "p1"]);
					done();
				}
			});

			cueEmitter.emitCueCrossings(1.0, 1.1);
		});

		it("should emit segment events during forward playback", (done: DoneCallback) => {
			const emitted = [];

			p.segments.add({ endTime: 1.09, id: "seg1", startTime: 1.05 });

			p.events.addEventListener("segments.enter", (event) => {
				expect(event.segment.id).equals("seg1", "segment id did not match");
				expect(event.time).to.equal(1.1);
				emitted.push(1.05);
			});

			p.events.addEventListener("segments.exit", (event) => {
				expect(event.segment.id).equals("seg1", "segment id did not match");
				expect(event.time).to.equal(1.1);
				emitted.push(1.09);
				expect(emitted).to.deep.equal([1.05, 1.09]);
				done();
			});

			cueEmitter.emitCueCrossings(1.1, 1.0);
		});

		it("should emit segment events during reverse playback", (done: DoneCallback) => {
			const emitted = [];

			p.segments.add({ endTime: 1.09, id: "seg1", startTime: 1.05 });

			p.events.addEventListener("segments.enter", (event) => {
				expect(event.segment.id).equals("seg1", "segment id did not match");
				emitted.push(1.09);
			});

			p.events.addEventListener("segments.exit", (event) => {
				expect(event.segment.id).equals("seg1", "segment id did not match");
				emitted.push(1.05);
				expect(emitted).to.deep.equal([1.09, 1.05]);
				done();
			});

			cueEmitter.emitCueCrossings(1.1, 1.0);
		});

		it("should emit events on seeking", (done: DoneCallback) => {
			// This test uses a custom player object as sometimes
			// the test would timeout waiting for the media element to seek.
			const player = {
				destroy: () => {},
				dispose: () => {},

				getCurrentTime: function () {
					return this.currentTime;
				},

				getDuration: () => 0,
				init: function (peaks) {
					this.eventEmitter = peaks.events;
					this.currentTime = 0;

					return Promise.resolve();
				},

				isPlaying: () => false,

				isSeeking: () => false,

				pause: () => {},

				play: () => {},

				seek: function (time) {
					this.currentTime = time;
					this.eventEmitter.dispatch("player.seeked", { time });
				},
			};

			const options = {
				dataUri: {
					arraybuffer: "base/test/data/sample.dat",
				},
				emitCueEvents: true,
				overview: {
					container: document.getElementById("overview-container"),
				},
				player: player,
				zoomview: {
					container: document.getElementById("zoomview-container"),
				},
			};

			initPeaks(options, (err, peaks) => {
				expect(err).to.equal(undefined);
				expect(peaks).to.be.an.instanceOf(Peaks);

				peaks.segments.add({ endTime: 4, id: "segment.1", startTime: 2 });
				peaks.segments.add({ endTime: 8, id: "segment.2", startTime: 6 });
				peaks.segments.add({ endTime: 12, id: "segment.3", startTime: 10 });

				const events = [];
				const seekTimes = [3, 11]; // Seek to segment.1 then segment.3

				peaks.events.addEventListener("player.seeked", () => {
					const time = seekTimes.shift();

					if (time) {
						peaks.player.seek(time);
					} else {
						expect(events.length).to.equal(3);
						expect(events[0].type).to.equal("segments.enter");
						expect(events[0].event.segment.id).to.equal("segment.1");
						expect(events[0].event.time).to.equal(3);
						expect(events[1].type).to.equal("segments.exit");
						expect(events[1].event.segment.id).to.equal("segment.1");
						expect(events[1].event.time).to.equal(11);
						expect(events[2].type).to.equal("segments.enter");
						expect(events[2].event.segment.id).to.equal("segment.3");
						expect(events[2].event.time).to.equal(11);
						done();
					}
				});

				peaks.events.addEventListener("segments.enter", (event) => {
					events.push({ event: event, type: "segments.enter" });
				});

				peaks.events.addEventListener("segments.exit", (event) => {
					events.push({ event: event, type: "segments.exit" });
				});

				const time = seekTimes.shift();
				peaks.player.seek(time);
			});
		});
	});
});
