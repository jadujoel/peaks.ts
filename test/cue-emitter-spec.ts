import Cue from "../src/cue";
import CueEmitter from "../src/cue-emitter";
import Peaks from "../src/main";

type CueEmitterWithCues = {
	_cues: Array<{ time: number; type: string }>;
};

describe("CueEmitter", () => {
	let p = null;
	let cueEmitter = null;

	beforeEach((done) => {
		const options = {
			overview: {
				container: document.getElementById("overview-container"),
			},
			zoomview: {
				container: document.getElementById("zoomview-container"),
			},
			mediaElement: document.getElementById("media"),
			dataUri: {
				arraybuffer: "base/test/data/sample.dat",
			},
			emitCueEvents: false,
		};

		Peaks.init(options, (err, instance) => {
			expect(err).to.equal(null);

			p = instance;
			cueEmitter = new CueEmitter(instance);

			done();
		});
	});

	afterEach(() => {
		if (p) {
			p.destroy();
			p = null;
		}

		cueEmitter = null;
	});

	it("should initialise correctly", () => {
		expect(p._cueEmitter).to.be.undefined;
		expect(cueEmitter._peaks).equals(p, "instance did not match");
		expect(cueEmitter._cues.length).equals(0, "marker array not empty");
	});

	it("should initialise with already existing points", (done) => {
		const options = {
			overview: {
				container: document.getElementById("overview-container"),
			},
			zoomview: {
				container: document.getElementById("zoomview-container"),
			},
			mediaElement: document.getElementById("media"),
			dataUri: {
				arraybuffer: "base/test/data/sample.dat",
			},
			emitCueEvents: true,
			points: [{ time: 1.0 }],
			segments: [{ startTime: 1.1, endTime: 1.2 }],
		};

		Peaks.init(options, (err, peaks) => {
			expect(err).to.equal(null);
			expect(peaks).to.be.an.instanceOf(Peaks);
			expect(peaks._cueEmitter).to.be.an.instanceOf(CueEmitter);
			expect(
				(peaks._cueEmitter as unknown as CueEmitterWithCues)._cues.length,
			).to.equal(3);
			done();
		});
	});

	it("should be destroyed when the Peaks instance is destroyed", (done) => {
		const options = {
			overview: {
				container: document.getElementById("overview-container"),
			},
			zoomview: {
				container: document.getElementById("zoomview-container"),
			},
			mediaElement: document.getElementById("media"),
			dataUri: {
				arraybuffer: "base/test/data/sample.dat",
			},
			emitCueEvents: true,
		};

		Peaks.init(options, (err, peaks) => {
			expect(err).to.equal(null);
			expect(peaks).to.be.an.instanceOf(Peaks);
			expect(peaks._cueEmitter).to.be.an.instanceOf(CueEmitter);

			p.points.add({ time: 1.0 });
			p.destroy();
			expect(
				(peaks._cueEmitter as unknown as CueEmitterWithCues)._cues.length,
			).to.equal(0, "did not empty cues");
			done();
		});
	});

	describe("adding points", () => {
		it("should add cues when point is added", () => {
			p.points.add({ time: 1.0 });
			expect(cueEmitter._cues.length).equals(1, "cues length did not match");
			expect(cueEmitter._cues[0].time).equals(1.0, "cue time did not match");
			expect(cueEmitter._cues[0].type).equals(
				Cue.POINT,
				"cue type did not match",
			);

			p.points.add({ time: 2.0 });
			expect(cueEmitter._cues.length).equals(2, "cues length did not match");
		});

		it("should reorder cues when point is added earlier", () => {
			p.points.add({ time: 1.0 });
			p.points.add({ time: 1.5 });
			expect(cueEmitter._cues[0].time).equals(1.0, "cue time did not match");
			p.points.add({ time: 0.2 });
			expect(cueEmitter._cues[0].time).equals(0.2, "cue time did not match");
		});

		it("should update cues when point is updated", () => {
			const id = "mypoint";

			p.points.add({ time: 1.1, id: id });
			p.points.add({ time: 9.1, id: "other" });

			expect(cueEmitter._cues[0].id).equals(id, "point id did not match");
			expect(cueEmitter._cues[0].time).equals(1.1, "time did not match");
			expect(cueEmitter._cues[1].time).equals(9.1, "time did not match");

			p.points.getPoint(id).update({ time: 2.2 });
			expect(cueEmitter._cues[0].time).equals(2.2, "time did not match");
			expect(cueEmitter._cues[1].time).equals(9.1, "time did not match");
		});

		it("should remove cues when point is removed", () => {
			p.points.add({ time: 1.1, id: "id1" });
			p.points.add({ time: 9.1 });
			p.points.removeById("id1");
			expect(cueEmitter._cues[0].time).equals(9.1, "time did not match");
		});

		it("should update when all points are removed", () => {
			p.points.add({ time: 2.1 });
			p.points.add({ time: 3.1 });
			p.segments.add({ startTime: 2.2, endTime: 3.2 });
			p.points.removeAll();
			expect(cueEmitter._cues.length).equals(2, "cues length did not match");
		});
	});

	describe("adding segments", () => {
		it("should add start and end cues when segment is added", () => {
			p.segments.add({ startTime: 2.0, endTime: 3.0 });
			expect(cueEmitter._cues.length).equals(2, "cues length did not match");

			expect(cueEmitter._cues[0].time).equals(
				2.0,
				"start cue time did not match",
			);
			expect(cueEmitter._cues[1].time).equals(
				3.0,
				"end cue time did not match",
			);

			expect(cueEmitter._cues[0].type).equals(
				Cue.SEGMENT_START,
				"cue type did not match",
			);
			expect(cueEmitter._cues[1].type).equals(
				Cue.SEGMENT_END,
				"cue type did not match",
			);
		});

		it("should reorder cues when segment is added earlier", () => {
			p.segments.add({ startTime: 2.0, endTime: 3.0, id: "seg1" });
			p.segments.add({ startTime: 2.5, endTime: 3.3, id: "seg2" });
			expect(cueEmitter._cues[1].time).equals(
				2.5,
				"seg2 start cue time did not match",
			);
			expect(cueEmitter._cues[2].time).equals(
				3.0,
				"seg1 end cue time did not match",
			);
		});

		it("should update cues when segment is updated", () => {
			p.segments.add({ startTime: 2.0, endTime: 3.0, id: "seg1" });
			p.segments.getSegment("seg1").update({ startTime: 2.2, endTime: 3.3 });
			expect(cueEmitter._cues[0].time).equals(
				2.2,
				"start cue time did not update?",
			);
			expect(cueEmitter._cues[1].time).equals(
				3.3,
				"end cue time did not update?",
			);
		});

		it("should remove cues when segment is removed", () => {
			p.segments.add({ startTime: 3.3, endTime: 3.4, id: "segx" });
			p.points.add({ time: 3.3 });
			p.segments.removeById("segx");
			expect(cueEmitter._cues.length).equals(1, "cues length did not match");
			expect(cueEmitter._cues[0].type).equals(
				Cue.POINT,
				"remaining cue type did not match",
			);
		});

		it("should update when all segments are removed", () => {
			p.segments.add({ startTime: 3.3, endTime: 3.4, id: "segx" });
			p.segments.add({ startTime: 4.3, endTime: 4.4, id: "seg2" });
			p.points.add({ time: 3.3 });
			p.segments.removeAll();
			expect(cueEmitter._cues.length).equals(1, "did not remove all segments?");
			expect(cueEmitter._cues[0].type).equals(
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
				p.emit("player.timeupdate", 1.0);
				expect(cueEmitter._previousTime).equals(
					1.0,
					"did not move previous time",
				);
				p.emit("player.timeupdate", 2.0);
				expect(cueEmitter._previousTime).equals(
					2.0,
					"did not move previous time",
				);
			});
		}

		it("should emit point events during forward playback", (done) => {
			const emitted = [];

			p.points.add({ time: 1.05, id: "p1" });
			p.points.add({ time: 1.07, id: "p2" });
			p.points.add({ time: 1.09, id: "p3" });

			p.on("points.enter", (event) => {
				emitted.push(event.point.id);

				expect(event.time).to.equal(1.1);

				if (emitted.length === 3) {
					expect(emitted).to.deep.equal(["p1", "p2", "p3"]);
					done();
				}
			});

			cueEmitter._onUpdate(1.1, 1.0);
		});

		it("should emit point events during reverse playback", (done) => {
			const emitted = [];

			p.points.add({ time: 1.05, id: "p1" });
			p.points.add({ time: 1.07, id: "p2" });
			p.points.add({ time: 1.09, id: "p3" });

			p.on("points.enter", (event) => {
				emitted.push(event.point.id);

				expect(event.time).to.equal(1.0);

				if (emitted.length === 3) {
					expect(emitted).to.deep.equal(["p3", "p2", "p1"]);
					done();
				}
			});

			cueEmitter._onUpdate(1.0, 1.1);
		});

		it("should emit segment events during forward playback", (done) => {
			const emitted = [];

			p.segments.add({ startTime: 1.05, endTime: 1.09, id: "seg1" });

			p.on("segments.enter", (event) => {
				expect(event.segment.id).equals("seg1", "segment id did not match");
				expect(event.time).to.equal(1.1);
				emitted.push(1.05);
			});

			p.on("segments.exit", (event) => {
				expect(event.segment.id).equals("seg1", "segment id did not match");
				expect(event.time).to.equal(1.1);
				emitted.push(1.09);
				expect(emitted).to.deep.equal([1.05, 1.09]);
				done();
			});

			cueEmitter._onUpdate(1.1, 1.0);
		});

		it("should emit segment events during reverse playback", (done) => {
			const emitted = [];

			p.segments.add({ startTime: 1.05, endTime: 1.09, id: "seg1" });

			p.on("segments.enter", (event) => {
				expect(event.segment.id).equals("seg1", "segment id did not match");
				emitted.push(1.09);
			});

			p.on("segments.exit", (event) => {
				expect(event.segment.id).equals("seg1", "segment id did not match");
				emitted.push(1.05);
				expect(emitted).to.deep.equal([1.09, 1.05]);
				done();
			});

			cueEmitter._onUpdate(1.1, 1.0);
		});

		it("should emit events on seeking", (done) => {
			// This test uses a custom player object as sometimes
			// the test would timeout waiting for the media element to seek.
			const player = {
				init: function (eventEmitter) {
					this._eventEmitter = eventEmitter;
					this._currentTime = 0;

					return Promise.resolve();
				},

				destroy: () => {},

				play: () => {},

				pause: () => {},

				isPlaying: () => false,

				isSeeking: () => false,

				seek: function (time) {
					this._currentTime = time;
					this._eventEmitter.emit("player.seeked", time);
				},

				getCurrentTime: function () {
					return this._currentTime;
				},

				getDuration: () => 0,
			};

			const options = {
				overview: {
					container: document.getElementById("overview-container"),
				},
				zoomview: {
					container: document.getElementById("zoomview-container"),
				},
				dataUri: {
					arraybuffer: "base/test/data/sample.dat",
				},
				player: player,
				emitCueEvents: true,
			};

			Peaks.init(options, (err, peaks) => {
				expect(err).to.equal(null);
				expect(peaks).to.be.an.instanceOf(Peaks);

				peaks.segments.add({ startTime: 2, endTime: 4, id: "segment.1" });
				peaks.segments.add({ startTime: 6, endTime: 8, id: "segment.2" });
				peaks.segments.add({ startTime: 10, endTime: 12, id: "segment.3" });

				const events = [];
				const seekTimes = [3, 11]; // Seek to segment.1 then segment.3

				peaks.on("player.seeked", () => {
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

				peaks.on("segments.enter", (event) => {
					events.push({ type: "segments.enter", event: event });
				});

				peaks.on("segments.exit", (event) => {
					events.push({ type: "segments.exit", event: event });
				});

				const time = seekTimes.shift();
				peaks.player.seek(time);
			});
		});
	});
});
