import sinon from "sinon";
import { Player } from "../src/player";
import { initPeaks } from "./helpers/init-peaks";

describe("Player", () => {
	describe("with stub player", () => {
		let p = null;
		let player = null;
		let logger = null;

		beforeEach((done: DoneCallback) => {
			logger = sinon.spy();

			player = {
				dispose: sinon.spy(),
				getCurrentTime: sinon.spy(() => 111),
				getDuration: sinon.spy(() => 123),
				init: sinon.spy(() => Promise.resolve()),
				isPlaying: sinon.spy(() => true),
				isSeeking: sinon.spy(() => false),
				pause: sinon.spy(),
				play: sinon.spy(() => Promise.resolve()),
				seek: sinon.spy(),
			};

			const options = {
				dataUri: {
					json: "base/test/data/sample.json",
				},
				logger: logger,
				mediaElement: document.getElementById("media"),
				overview: {
					container: document.getElementById("overview-container"),
				},
				player: player,
				zoomview: {
					container: document.getElementById("zoomview-container"),
				},
			};

			initPeaks(options, (err, instance) => {
				expect(err).to.equal(undefined);
				p = instance;
				done();
			});
		});

		afterEach(() => {
			if (p) {
				p.dispose();
				p = null;
			}
		});

		describe("constructor", () => {
			it("should construct a Player from an AudioDriver", () => {
				const driver = {
					dispose: sinon.spy(),
					getCurrentTime: sinon.spy(() => 0),
					getDuration: sinon.spy(() => 0),
					init: sinon.spy(() => Promise.resolve()),
					isPlaying: sinon.spy(() => false),
					isSeeking: sinon.spy(() => false),
					pause: sinon.spy(),
					play: sinon.spy(() => Promise.resolve()),
					playSegment: sinon.spy(() => Promise.resolve()),
					seek: sinon.spy(),
					setSource: sinon.spy(() => Promise.resolve()),
				};

				const built = Player.from({
					driver: driver as unknown as never,
					peaks: {
						events: {
							addEventListener: () => {},
							dispatch: () => {},
							removeEventListener: () => {},
						},
					} as unknown as never,
				});

				expect(built).to.be.an.instanceOf(Player);
			});
		});

		describe("init", () => {
			it("should call the player's init() method", () => {
				expect(player.init.calledOnce).to.be.true;
			});
		});

		describe("dispose", () => {
			it("should call the player's dispose() method", () => {
				expect(player.dispose.notCalled).to.equal(true);

				p.dispose();

				expect(player.dispose.calledOnce).to.equal(true);
			});
		});

		describe("play", () => {
			it("should call the player's play() method", () => {
				p.player.play();

				expect(player.play.calledOnce).to.equal(true);
			});

			it("should return the value from the player's play() method", () => {
				const result = p.player.play();

				expect(result).to.be.an.instanceOf(Promise);
			});
		});

		describe("pause", () => {
			it("should call the player's pause() method", () => {
				p.player.pause();

				expect(player.pause.calledOnce).to.equal(true);
			});
		});

		describe("isPlaying", () => {
			it("should call the player's isPlaying() method and return its value", () => {
				const count = player.isPlaying.callCount;
				expect(p.player.isPlaying()).to.equal(true);
				expect(player.isPlaying.callCount).to.equal(count + 1);
			});
		});

		describe("isSeeking", () => {
			it("should call the player's isSeeking() method and return its value", () => {
				expect(p.player.isSeeking()).to.equal(false);
				expect(player.isSeeking.calledOnce).to.equal(true);
			});
		});

		describe("getCurrentTime", () => {
			it("should call the player's getCurrentTime() method and return its value", () => {
				const count = player.getCurrentTime.callCount;
				expect(p.player.getCurrentTime()).to.equal(111);
				expect(player.getCurrentTime.callCount).to.equal(count + 1);
			});
		});

		describe("getDuration", () => {
			it("should call the player's getDuration() method and return its value", () => {
				expect(p.player.getDuration()).to.equal(123);
				expect(player.getDuration.calledOnce).to.equal(true);
			});
		});

		describe("seek", () => {
			it("should call the player's seek() method", () => {
				p.player.seek(42);

				expect(logger.notCalled).to.equal(true);
				expect(player.seek.calledOnce).to.equal(true);
				expect(player.seek).to.have.been.calledWith(42);
			});

			it("should log an error if the given time is not valid", () => {
				p.player.seek("6.0");

				expect(logger.calledOnce).to.equal(true);
				expect(player.seek.notCalled).to.equal(true);
			});
		});

		describe("playSegment", () => {
			it("should return a rejected promise if a segment id is given", () => {
				const result = p.player.playSegment("peaks.segment.0");

				expect(result).to.be.an.instanceOf(Promise);

				return result.catch((error) => {
					expect(error).to.be.an.instanceOf(Error);
					expect(error.message).to.match(/segment object/);
				});
			});

			it("should call the player's seek() and play() methods", (done: DoneCallback) => {
				const segment = { editable: true, endTime: 20, startTime: 10 };

				p.player.playSegment(segment).then(() => {
					expect(logger.notCalled).to.equal(true);

					expect(player.seek.calledOnce).to.equal(true);
					expect(player.seek).to.have.been.calledWith(segment.startTime);

					expect(player.play.calledOnce).to.equal(true);
					expect(player.pause.notCalled).to.equal(true);
					done();
				});
			});

			it("should return the value from the player's play() method", () => {
				const result = p.player.playSegment({ endTime: 20, startTime: 10 });

				expect(result).to.be.an.instanceOf(Promise);
			});

			it("should call driver.playSegment exactly once when natively supported", async () => {
				// Build a Player directly with a stub driver that natively supports
				// playSegment to ensure the polling loop has not crept back in.
				const events = {
					addEventListener: sinon.spy(),
					dispatch: sinon.spy(),
					removeEventListener: sinon.spy(),
				};
				const driver = {
					dispose: sinon.spy(),
					getCurrentTime: sinon.spy(() => 0),
					getDuration: sinon.spy(() => 0),
					init: sinon.spy(() => Promise.resolve()),
					isPlaying: sinon.spy(() => false),
					isSeeking: sinon.spy(() => false),
					pause: sinon.spy(),
					play: sinon.spy(() => Promise.resolve()),
					playSegment: sinon.spy(() => Promise.resolve()),
					seek: sinon.spy(),
					setSource: sinon.spy(() => Promise.resolve()),
				};
				const player = Player.from({
					driver: driver as unknown as never,
					peaks: {
						events,
						logger: () => {},
					} as unknown as never,
				});
				await player.playSegment(
					{ endTime: 4, startTime: 2 } as unknown as never,
					true,
				);
				expect(driver.playSegment.calledOnce).to.equal(true);
				// And the polling-loop fallback (seek + play loop) must not run
				expect(driver.seek.notCalled).to.equal(true);
				expect(driver.play.notCalled).to.equal(true);
			});
		});
	});

	describe("with media element player", () => {
		let p = null;
		let logger = null;

		beforeEach((done: DoneCallback) => {
			logger = sinon.spy();

			const options = {
				dataUri: {
					json: "base/test/data/sample.json",
				},
				logger: logger,
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
				done();
			});
		});

		afterEach(() => {
			if (p) {
				p.dispose();
				p = null;
			}
		});

		describe("play", () => {
			it("should trigger mediaelement playing event", (done: DoneCallback) => {
				p.events.addEventListener("player.playing", (event) => {
					expect(event.time).to.be.lessThan(0.05);
					done();
				});

				p.player.play();
			});
		});

		describe("isSeeking", () => {
			it("should return the actual value of the audio element", () => {
				expect(p.player.isSeeking()).to.equal(
					document.getElementById("media").seeking,
				);
			});
		});

		describe("getCurrentTime", () => {
			const newTime = 6.0;

			it("should return the actual value of the audio element", () => {
				expect(p.player.getCurrentTime()).to.equal(0);
			});

			it("should return an updated time if it has been modified through the audio element", (done: DoneCallback) => {
				p.events.addEventListener("player.seeked", (event) => {
					expect(event.time).to.equal(p.player.getCurrentTime());

					const diff = Math.abs(event.time - newTime);
					expect(diff).to.be.lessThan(0.2);

					done();
				});

				document.querySelector("audio").currentTime = newTime;
			});
		});

		describe("seek", () => {
			beforeEach((done: DoneCallback) => {
				if (p.player.getCurrentTime() === 0.0) {
					done();
					return;
				}

				p.events.addEventListener(
					"player.seeked",
					() => {
						done();
					},
					{ once: true },
				);

				p.player.seek(0.0);
			});

			it("should change the currentTime value of the audio element", (done: DoneCallback) => {
				const newTime = 6.0;

				p.events.addEventListener(
					"player.seeked",
					(event) => {
						const diff = Math.abs(event.time - newTime);
						expect(diff).to.be.lessThan(0.2);
						done();
					},
					{ once: true },
				);

				p.player.seek(newTime);
			});

			it("should log an error and not seek if the given time is not valid", () => {
				p.player.seek("6.0");

				expect(logger.calledOnce).to.equal(true);
				expect(p.player.getCurrentTime()).to.equal(0.0);
			});
		});

		describe("playSegment", () => {
			it("should return a rejected promise if a segment id is given", () => {
				const result = p.player.playSegment("peaks.segment.0");

				expect(result).to.be.an.instanceOf(Promise);

				return result.catch((error) => {
					expect(error).to.be.an.instanceOf(Error);
					expect(error.message).to.match(/segment object/);
				});
			});

			it("should play a given segment", () => {
				p.segments.add({ editable: true, endTime: 20, startTime: 10 });

				const segments = p.segments.getSegments();
				expect(segments.length).to.equal(1);

				return p.player.playSegment(segments[0]).then(() => {
					p.player.pause();
					expect(logger.notCalled).to.equal(true);
				});
			});

			it("should play a segment if an object with startTime and endTime values is given", (done: DoneCallback) => {
				const expectedStart = 1;
				const expectedEnd = 2;

				p.player
					.playSegment({ endTime: expectedEnd, startTime: expectedStart })
					.catch((error) => {
						expect(error.name).to.equal("AbortError");
					});

				p.events.addEventListener("player.playing", (event) => {
					const diff = Math.abs(event.time - expectedStart);
					expect(diff).to.be.lessThan(0.05);
				});

				p.events.addEventListener("player.pause", () => {
					const diff = Math.abs(p.player.getCurrentTime() - expectedEnd);
					expect(diff).to.be.lessThan(0.05);
					done();
				});
			});
		});

		describe("dispose", () => {
			it("should remove all event listeners", () => {
				p.player.dispose();

				expect(p.player.driver.listeners).to.be.empty;
			});
		});
	});

	describe("with custom player that fails to initialize", () => {
		let p = null;

		afterEach(() => {
			if (p) {
				p.dispose();
				p = null;
			}
		});

		describe("init", () => {
			it("should cause initPeaks() to return an error", (done: DoneCallback) => {
				const player = {
					dispose: sinon.spy(),
					getCurrentTime: sinon.spy(() => 111),
					getDuration: sinon.spy(() => 123),
					init: sinon.spy(() => Promise.reject(new Error("failed"))),
					isPlaying: sinon.spy(() => true),
					isSeeking: sinon.spy(() => false),
					pause: sinon.spy(),
					play: sinon.spy(() => Promise.resolve()),
					seek: sinon.spy(),
				};

				const options = {
					dataUri: {
						json: "base/test/data/sample.json",
					},
					mediaElement: document.getElementById("media"),
					overview: {
						container: document.getElementById("overview-container"),
					},
					player: player,
					zoomview: {
						container: document.getElementById("zoomview-container"),
					},
				};

				initPeaks(options, (err, instance) => {
					expect(err).to.be.an.instanceOf(Error);
					expect(err.message).to.equal("failed");
					p = instance;
					done();
				});
			});
		});
	});
});
