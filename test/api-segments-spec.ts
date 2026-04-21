import sinon from "sinon";
import { Peaks } from "../src/main";
import { Segment } from "../src/segment";

describe("Peaks.segments", () => {
	let p = null;
	let logger = null;

	beforeEach((done: DoneCallback) => {
		logger = sinon.spy();

		const options = {
			dataUri: {
				arraybuffer: "base/test/data/sample.dat",
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

		Peaks.init(options, (err, instance) => {
			expect(err).to.equal(undefined);
			p = instance;
			done();
		});
	});

	afterEach(() => {
		if (p) {
			p.dispose();
		}
	});

	describe("getSegments", () => {
		it("should return an empty array if no segments are present", () => {
			expect(p.segments.getSegments()).to.be.an("array").and.have.lengthOf(0);
		});

		it("should return any added segments", () => {
			p.segments.add({ endTime: 10, startTime: 0 });
			p.segments.add({ endTime: 12, startTime: 2 });

			const segments = p.segments.getSegments();

			expect(segments).to.have.lengthOf(2);
			expect(segments[0]).to.be.an.instanceOf(Segment);
			expect(segments[0].startTime).to.equal(0);
			expect(segments[0].endTime).to.equal(10);
			expect(segments[1]).to.be.an.instanceOf(Segment);
			expect(segments[1].startTime).to.equal(2);
			expect(segments[1].endTime).to.equal(12);
		});
	});

	describe("getSegment", () => {
		it("should return a segment given a valid id", () => {
			p.segments.add({ endTime: 10, id: "segment1", startTime: 0 });
			p.segments.add({ endTime: 12, id: "segment2", startTime: 2 });

			const segment = p.segments.getSegment("segment2");

			expect(segment).to.be.ok;
			expect(segment).to.be.an.instanceOf(Segment);
			expect(segment.id).to.equal("segment2");
			expect(segment.startTime).to.equal(2);
			expect(segment.endTime).to.equal(12);
		});

		it("should return undefined if segment not found", () => {
			p.segments.add({ endTime: 10, id: "segment1", startTime: 0 });
			p.segments.add({ endTime: 12, id: "segment2", startTime: 2 });

			const segment = p.segments.getSegment("segment3");

			expect(segment).to.equal(undefined);
		});
	});

	describe("add", () => {
		it("should accept a single segment object", () => {
			p.segments.add({ endTime: 10, startTime: 0 });

			const segments = p.segments.getSegments();

			expect(segments).to.have.lengthOf(1);
			expect(segments[0]).to.be.an.instanceOf(Segment);
			expect(segments[0].startTime).to.equal(0);
			expect(segments[0].endTime).to.equal(10);

			expect(logger).to.not.have.been.called;
		});

		it("should throw an exception if the startTime argument is missing", () => {
			expect(() => {
				p.segments.add({ endTime: 10 });
			}).to.throw(TypeError);
		});

		it("should throw an exception if the endTime argument is missing", () => {
			expect(() => {
				p.segments.add({ startTime: 0 });
			}).to.throw(TypeError);
		});

		it("should accept an optional id", () => {
			p.segments.add({ endTime: 10, id: "123", startTime: 0 });

			expect(p.segments.getSegments()[0].id).to.equal("123");
		});

		it("should allow 0 for a segment id", () => {
			p.segments.add({ endTime: 10, id: 0, startTime: 0 });

			expect(p.segments.getSegments()[0].id).to.equal(0);
		});

		it("should assign a default id if not specified", () => {
			p.segments.add({ endTime: 10, startTime: 0 });

			expect(p.segments.getSegments()[0].id).to.equal("peaks.segment.0");
		});

		it("should accept an optional segment color", () => {
			p.segments.add({ color: "#888", endTime: 10, startTime: 0 });

			expect(p.segments.getSegments()[0].color).to.equal("#888");
		});

		it("should assign a default color if not specified", () => {
			p.segments.add({ endTime: 10, startTime: 0 });

			expect(p.segments.getSegments()[0].color).to.equal("#0074d9");
		});

		it("should throw if the color is not valid", () => {
			expect(() => {
				p.segments.add({ color: 1, endTime: 10, startTime: 0 });
			}).to.throw(TypeError, /color/);
		});

		it("should accept an optional border color", () => {
			p.segments.add({ borderColor: "#888", endTime: 10, startTime: 0 });

			expect(p.segments.getSegments()[0].borderColor).to.equal("#888");
		});

		it("should assign a default border color if not specified", () => {
			p.segments.add({ endTime: 10, startTime: 0 });

			expect(p.segments.getSegments()[0].borderColor).to.equal("#ff0000");
		});

		it("should throw if the border color is not valid", () => {
			expect(() => {
				p.segments.add({ borderColor: 1, endTime: 10, startTime: 0 });
			}).to.throw(TypeError, /borderColor/);
		});

		it("should accept an optional label text", () => {
			p.segments.add({ endTime: 10, labelText: "test", startTime: 0 });

			expect(p.segments.getSegments()[0].labelText).to.equal("test");
		});

		it("should assign a default label text if not specified", () => {
			p.segments.add({ endTime: 10, startTime: 0 });

			expect(p.segments.getSegments()[0].labelText).to.equal("");
		});

		it("should assign a default label text if null", () => {
			p.segments.add({ endTime: 10, labelText: null, startTime: 0 });

			expect(p.segments.getSegments()[0].labelText).to.equal("");
		});

		it("should apply every optional default when only times are provided", () => {
			p.segments.add({ endTime: 10, startTime: 0 });

			const segment = p.segments.getSegments()[0];
			expect(segment.labelText).to.equal("");
			expect(segment.editable).to.equal(false);
			expect(segment.color).to.be.a("string");
			expect(segment.borderColor).to.be.a("string");
			expect(segment.markers).to.be.a("boolean");
			expect(segment.overlay).to.be.a("boolean");
			expect(segment.id).to.be.a("string");
		});

		it("should throw if the label text is not a string", () => {
			expect(() => {
				p.segments.add({ endTime: 10, labelText: 1, startTime: 0 });
			}).to.throw(TypeError, /labelText/);
		});

		it("should throw if the editable flag is not a boolean", () => {
			expect(() => {
				p.segments.add({ editable: 1, endTime: 10, startTime: 0 });
			}).to.throw(TypeError, /editable/);
		});

		it("should accept optional user data", () => {
			p.segments.add({ data: "test", endTime: 10, startTime: 0 });

			expect(p.segments.getSegments()[0].data).to.equal("test");
		});

		it("should accept an array of segment objects", () => {
			const segments = [
				{ endTime: 10, startTime: 0 },
				{ endTime: 10, startTime: 5 },
			];

			p.segments.add(segments);

			expect(p.segments.getSegments()).to.have.lengthOf(2);
			expect(p.segments.getSegments()[0].startTime).to.equal(0);
			expect(p.segments.getSegments()[0].endTime).to.equal(10);
			expect(p.segments.getSegments()[1].startTime).to.equal(5);
			expect(p.segments.getSegments()[1].endTime).to.equal(10);
		});

		it("should emit an event with an array containing a single segment object", (done: DoneCallback) => {
			p.on("segments.add", (event) => {
				expect(event.segments).to.have.lengthOf(1);
				expect(event.segments[0]).to.be.an.instanceOf(Segment);
				expect(event.segments[0].startTime).to.equal(0);
				expect(event.segments[0].endTime).to.equal(10);
				done();
			});

			p.segments.add({ endTime: 10, startTime: 0 });
		});

		it("should emit an event with multiple segment objects", (done: DoneCallback) => {
			p.on("segments.add", (event) => {
				expect(event.segments).to.have.lengthOf(2);
				expect(event.segments[0]).to.be.an.instanceOf(Segment);
				expect(event.segments[0].startTime).to.equal(0);
				expect(event.segments[0].endTime).to.equal(10);
				expect(event.segments[1]).to.be.an.instanceOf(Segment);
				expect(event.segments[1].startTime).to.equal(20);
				expect(event.segments[1].endTime).to.equal(30);
				done();
			});

			p.segments.add([
				{ endTime: 10, startTime: 0 },
				{ endTime: 30, startTime: 20 },
			]);
		});

		it("should return the new segment", () => {
			const result = p.segments.add({ endTime: 10, startTime: 0 });

			expect(result).to.be.an.instanceOf(Segment);
			expect(result.startTime).to.equal(0);
			expect(result.endTime).to.equal(10);
			expect(result.id).to.be.a("string");
		});

		it("should return multiple segments when passing an array", () => {
			const result = p.segments.add([
				{ endTime: 10, startTime: 0 },
				{ endTime: 40, startTime: 30 },
			]);

			expect(result).to.be.an.instanceOf(Array);
			expect(result[0].startTime).to.equal(0);
			expect(result[1].startTime).to.equal(30);
		});

		it("should throw an exception if arguments do not match any previous accepted signature form", () => {
			expect(() => {
				p.segments.add({});
			}).to.throw(TypeError);
			expect(() => {
				p.segments.add(undefined);
			}).to.throw(TypeError);
			expect(() => {
				p.segments.add(null);
			}).to.throw(TypeError);
			expect(() => {
				p.segments.add(NaN, NaN);
			}).to.throw(TypeError);
		});

		it("should throw an exception if the startTime is NaN", () => {
			expect(() => {
				p.segments.add({ endTime: 1.0, startTime: NaN });
			}).to.throw(TypeError);
		});

		it("should throw an exception if the endTime is NaN", () => {
			expect(() => {
				p.segments.add({ endTime: NaN, startTime: 1.0 });
			}).to.throw(TypeError);
		});

		it("should throw an exception if the startTime is negative", () => {
			expect(() => {
				p.segments.add({ endTime: 1.0, startTime: -1.0 });
			}).to.throw(RangeError);
		});

		it("should throw an exception if the endTime is negative", () => {
			expect(() => {
				p.segments.add({ endTime: -1.0, startTime: 1.0 });
			}).to.throw(RangeError);
		});

		it("should throw an exception if the startTime is greater than the endTime", () => {
			expect(() => {
				p.segments.add({ endTime: 1.0, startTime: 1.1 });
			}).to.throw(RangeError);
		});

		it("should allow the startTime to equal the endTime", () => {
			p.segments.add({ endTime: 1.0, startTime: 1.0 });

			const segments = p.segments.getSegments();

			expect(segments[0].startTime).to.equal(1.0);
			expect(segments[0].endTime).to.equal(1.0);
		});

		it("should throw an exception if given a duplicate id", () => {
			p.segments.add({ endTime: 20, id: "segment1", startTime: 10 });

			expect(() => {
				p.segments.add({ endTime: 20, id: "segment1", startTime: 10 });
			}).to.throw(Error, /duplicate/);
		});

		it("should add a segment with the same id as a previously removed segment", () => {
			p.segments.add({ endTime: 20, id: "segment1", startTime: 10 });
			p.segments.removeById("segment1");
			p.segments.add({ endTime: 30, id: "segment1", startTime: 20 });

			const segments = p.segments.getSegments();

			expect(segments).to.have.lengthOf(1);
			expect(segments[0].startTime).to.equal(20);
			expect(segments[0].endTime).to.equal(30);
			expect(segments[0].id).to.equal("segment1");
		});

		[
			"update",
			"isVisible",
			"peaks",
			"_id",
			"_pid",
			"_startTime",
			"_endTime",
			"_labelText",
			"_color",
			"_borderColor",
			"_editable",
		].forEach((name) => {
			it(`should not allow an invalid user data attribute name: ${name}`, () => {
				expect(() => {
					const segment = {
						endTime: 10,
						startTime: 0,
					};

					segment[name] = "test";

					p.segments.add(segment);
				}).to.throw(Error);
			});
		});

		it("should add segments atomically", () => {
			p.segments.add([
				{ endTime: 10, startTime: 0 },
				{ endTime: 20, startTime: 10 },
				{ endTime: 30, startTime: 20 },
			]);

			expect(p.segments.getSegments()).to.have.lengthOf(3);

			const segmentsToAdd = [
				{ endTime: 40, startTime: 30 },
				{ endTime: 35, startTime: 40 },
				{ endTime: 50, startTime: 40 },
			];

			expect(() => {
				p.segments.add(segmentsToAdd);
			}).to.throw(Error, /startTime/);

			const segments = p.segments.getSegments();

			expect(segments).to.have.lengthOf(3);
			expect(segments[0].startTime).to.equal(0);
			expect(segments[0].endTime).to.equal(10);
			expect(segments[1].startTime).to.equal(10);
			expect(segments[1].endTime).to.equal(20);
			expect(segments[2].startTime).to.equal(20);
			expect(segments[2].endTime).to.equal(30);
		});
	});

	describe("getSegmentsAtTime", () => {
		beforeEach(() => {
			p.segments.add({ endTime: 12, id: "segment1", startTime: 10 });
			p.segments.add({ endTime: 15, id: "segment2", startTime: 13 });
			p.segments.add({ endTime: 18, id: "segment3", startTime: 16 });
			p.segments.add({ endTime: 19, id: "segment4", startTime: 17 });
		});

		it("should return an empty array if no overlapping segments", () => {
			const segments = p.segments.getSegmentsAtTime(5);
			expect(segments).to.be.an.instanceOf(Array);
			expect(segments).to.have.lengthOf(0);
		});

		it("should return segment with time at the start of the segment", () => {
			const segments = p.segments.getSegmentsAtTime(10);
			expect(segments).to.be.an.instanceOf(Array);
			expect(segments).to.have.lengthOf(1);
			expect(segments[0].id).to.equal("segment1");
		});

		it("should not return segment with time at the end of the segment", () => {
			const segments = p.segments.getSegmentsAtTime(12);
			expect(segments).to.be.an.instanceOf(Array);
			expect(segments).to.have.lengthOf(0);
		});

		it("should return segment with time within the segment", () => {
			const segments = p.segments.getSegmentsAtTime(11);
			expect(segments).to.be.an.instanceOf(Array);
			expect(segments).to.have.lengthOf(1);
			expect(segments[0].id).to.equal("segment1");
		});

		it("should return all overlapping segments", () => {
			const segments = p.segments.getSegmentsAtTime(17);
			expect(segments).to.be.an.instanceOf(Array);
			expect(segments).to.have.lengthOf(2);
			expect(segments[0].id).to.equal("segment3");
			expect(segments[1].id).to.equal("segment4");
		});
	});

	describe("findPreviousSegment", () => {
		beforeEach(() => {
			p.segments.add([
				{ endTime: 12, id: "segment_id.1", startTime: 10 },
				{ endTime: 12, id: "segment_id.2", startTime: 5 },
			]);
		});

		it("should return the previous segment", () => {
			const segment = p.segments.getSegment("segment_id.1");

			const previous = p.segments.findPreviousSegment(segment);

			expect(previous.id).to.equal("segment_id.2");
		});

		it("should return undefined when given the first segment", () => {
			const segment = p.segments.getSegment("segment_id.2");

			const previous = p.segments.findPreviousSegment(segment);

			expect(previous).to.equal(undefined);
		});
	});

	describe("findNextSegment", () => {
		beforeEach(() => {
			p.segments.add([
				{ endTime: 12, id: "segment_id.1", startTime: 10 },
				{ endTime: 12, id: "segment_id.2", startTime: 5 },
			]);
		});

		it("should return the next segment", () => {
			const segment = p.segments.getSegment("segment_id.2");

			const next = p.segments.findNextSegment(segment);

			expect(next.id).to.equal("segment_id.1");
		});

		it("should return undefined when given the last segment", () => {
			const segment = p.segments.getSegment("segment_id.1");

			const next = p.segments.findNextSegment(segment);

			expect(next).to.equal(undefined);
		});
	});

	describe("remove", () => {
		beforeEach(() => {
			p.segments.add({ endTime: 12, id: "segment1", startTime: 10 });
			p.segments.add({ endTime: 15, id: "segment2", startTime: 13 });
			p.segments.add({ endTime: 18, id: "segment3", startTime: 16 });
		});

		it("should remove the given segment object", () => {
			const segments = p.segments.getSegments();

			const removed = p.segments.remove(segments[0]);

			expect(removed).to.be.an.instanceOf(Array);
			expect(removed).to.have.lengthOf(1);
			expect(removed[0].id).to.equal("segment1");
		});

		it("should remove the segment from the segments array", () => {
			const segments = p.segments.getSegments();

			p.segments.remove(segments[0]);

			const remainingSegments = p.segments.getSegments();

			expect(remainingSegments).to.have.lengthOf(2);
			expect(remainingSegments[0].id).to.equal("segment2");
			expect(remainingSegments[1].id).to.equal("segment3");
		});

		it("should emit an event with the removed segment", (done: DoneCallback) => {
			p.on("segments.remove", (event) => {
				expect(event.segments).to.be.an.instanceOf(Array);
				expect(event.segments).to.have.lengthOf(1);
				expect(event.segments[0]).to.be.an.instanceOf(Segment);
				expect(event.segments[0].id).to.equal("segment2");
				done();
			});

			const segments = p.segments.getSegments();

			p.segments.remove(segments[1]);
		});

		it("should return an empty array if the segment is not found", () => {
			const removed = p.segments.remove({});

			expect(removed).to.be.an.instanceOf(Array);
			expect(removed).to.be.empty;
		});
	});

	describe("removeByTime", () => {
		beforeEach(() => {
			p.segments.add({ endTime: 12, startTime: 10 });
			p.segments.add({ endTime: 12, startTime: 5 });

			p.segments.add({ endTime: 6, startTime: 3 });
			p.segments.add({ endTime: 10, startTime: 3 });
		});

		it("should not remove any segment if the startTime does not match any segment", () => {
			p.segments.removeByTime(6);

			expect(p.segments.getSegments()).to.have.a.lengthOf(4);
		});

		it("should not remove any segment if only the endTime matches the end of a segment", () => {
			p.segments.removeByTime(6, 12);

			expect(p.segments.getSegments()).to.have.a.lengthOf(4);
		});

		it("should remove the only segment matching the startTime", () => {
			p.segments.removeByTime(5);

			const segments = p.segments.getSegments();

			expect(segments).to.have.a.lengthOf(3);
			expect(segments[0].startTime).to.equal(10);
			expect(segments[1].startTime).to.equal(3);
			expect(segments[2].startTime).to.equal(3);
		});

		it("should return the removed segments", () => {
			const segments = p.segments.removeByTime(3);

			expect(segments).to.be.an.instanceOf(Array);
			expect(segments).to.have.lengthOf(2);
			expect(segments[0]).to.be.an.instanceOf(Segment);
			expect(segments[0].startTime).to.equal(3);
			expect(segments[0].endTime).to.equal(6);
			expect(segments[1]).to.be.an.instanceOf(Segment);
			expect(segments[1].startTime).to.equal(3);
			expect(segments[1].endTime).to.equal(10);
		});

		it("should emit an event containing the removed segments", (done: DoneCallback) => {
			p.on("segments.remove", (event) => {
				expect(event.segments).to.be.an.instanceOf(Array);
				expect(event.segments).to.have.lengthOf(2);
				expect(event.segments[0]).to.be.an.instanceOf(Segment);
				expect(event.segments[0].startTime).to.equal(3);
				expect(event.segments[0].endTime).to.equal(6);
				expect(event.segments[1]).to.be.an.instanceOf(Segment);
				expect(event.segments[1].startTime).to.equal(3);
				expect(event.segments[1].endTime).to.equal(10);

				done();
			});

			p.segments.removeByTime(3);
		});

		it("should remove multiple segments with the same startTime", () => {
			p.segments.removeByTime(3);

			expect(p.segments.getSegments()).to.have.a.lengthOf(2);
		});

		it("should remove a segment matching both startTime and endTime", () => {
			p.segments.removeByTime(3, 6);

			expect(p.segments.getSegments()).to.have.a.lengthOf(3);
		});
	});

	describe("removeById", () => {
		beforeEach(() => {
			p.segments.add([
				{ endTime: 10, id: "segment_id.1", startTime: 0 },
				{ endTime: 25, id: "segment_id.2", startTime: 15 },
			]);
		});

		it("should remove the segment with the given id", () => {
			p.segments.removeById("segment_id.1");

			const remainingSegments = p.segments.getSegments();

			expect(remainingSegments).to.have.a.lengthOf(1);
			expect(remainingSegments[0].id).to.equal("segment_id.2");
			expect(remainingSegments[0].startTime).to.equal(15);
			expect(remainingSegments[0].endTime).to.equal(25);
		});

		it("should return the removed segments", () => {
			const removed = p.segments.removeById("segment_id.1");

			expect(removed).to.be.an.instanceOf(Array);
			expect(removed.length).to.equal(1);
			expect(removed[0]).to.be.an.instanceOf(Segment);
			expect(removed[0].startTime).to.equal(0);
			expect(removed[0].endTime).to.equal(10);
		});

		it("should emit an event with the removed segments", (done: DoneCallback) => {
			p.on("segments.remove", (event) => {
				expect(event.segments).to.be.an.instanceOf(Array);
				expect(event.segments.length).to.equal(1);
				expect(event.segments[0]).to.be.an.instanceOf(Segment);
				expect(event.segments[0].startTime).to.equal(15);
				expect(event.segments[0].endTime).to.equal(25);

				done();
			});

			p.segments.removeById("segment_id.2");
		});

		it("should allow a segment with the same id to be subsequently added", () => {
			p.segments.removeById("segment_id.1");

			p.segments.add({ endTime: 7, id: "segment_id.1", startTime: 6 });

			const segments = p.segments.getSegments();

			expect(segments.length).to.equal(2);
			expect(segments[0].startTime).to.equal(15);
			expect(segments[1].startTime).to.equal(6);
		});
	});

	describe("removeAll", () => {
		beforeEach(() => {
			p.segments.add([
				{ endTime: 12, id: "segment_id.1", startTime: 10 },
				{ endTime: 12, id: "segment_id.2", startTime: 5 },
			]);
		});

		it("should remove all segment objects", () => {
			p.segments.removeAll();

			const remainingSegments = p.segments.getSegments();

			expect(remainingSegments).to.be.empty;
		});

		it("should emit an event", (done: DoneCallback) => {
			p.on("segments.remove_all", (param) => {
				expect(param).to.be.undefined;

				const remainingSegments = p.segments.getSegments();

				expect(remainingSegments).to.be.empty;
				done();
			});

			p.segments.removeAll();
		});

		it("should return undefined", () => {
			const result = p.segments.removeAll();

			expect(result).to.be.undefined;
		});

		it("should allow the same segment ids to be subsequently added", () => {
			p.segments.removeAll();

			p.segments.add({ endTime: 7, id: "segment_id.1", startTime: 6 });
			p.segments.add({ endTime: 9, id: "segment_id.2", startTime: 8 });

			const segments = p.segments.getSegments();

			expect(segments.length).to.equal(2);
			expect(segments[0].startTime).to.equal(6);
			expect(segments[1].startTime).to.equal(8);
		});
	});
});
