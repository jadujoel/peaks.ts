import Konva from "konva/lib/Core";
import type { Group } from "konva/lib/Group";
import type { Layer } from "konva/lib/Layer";
import type { KonvaEventObject } from "konva/lib/Node";
import type { Shape } from "konva/lib/Shape";
import { Rect } from "konva/lib/shapes/Rect";
import { Text } from "konva/lib/shapes/Text";

import OverlaySegmentMarker from "./overlay-segment-marker";
import type { Segment } from "./segment";
import SegmentMarker from "./segment-marker";
import type {
	CreateSegmentMarkerOptions,
	KonvaMouseEvent,
	Marker,
	PeaksInstance,
	SegmentClickEvent,
	SegmentMarkerAPI,
	SegmentsLayerAPI,
	WaveformViewAPI,
} from "./types";
import WaveformShape from "./waveform-shape";

function createOverlayMarker(options: CreateSegmentMarkerOptions): Marker {
	return new OverlaySegmentMarker(options);
}

function getDuration(segment: Segment): number {
	return segment.endTime - segment.startTime;
}

class SegmentShape {
	_segment: Segment;
	_peaks: PeaksInstance;
	_layer: SegmentsLayerAPI;
	_view: WaveformViewAPI;
	_label: Shape | null;
	_startMarker: SegmentMarker | null;
	_endMarker: SegmentMarker | null;
	_color: string | undefined;
	_borderColor: string | undefined;
	_draggable: boolean;
	_dragging: boolean;
	_overlayOffset: number;
	_waveformShape: WaveformShape | null;
	_overlay!: Group;
	_overlayRect!: Rect;
	_overlayText: Text | null = null;
	_nextSegment: Segment | undefined = undefined;
	_previousSegment: Segment | undefined = undefined;
	_dragStartX = 0;
	_dragStartTime = 0;
	_dragEndTime = 0;
	_startMarkerX = 0;
	_endMarkerX = 0;

	_onMouseEnter: (event: KonvaEventObject<MouseEvent>) => void;
	_onMouseLeave: (event: KonvaEventObject<MouseEvent>) => void;
	_onMouseDown: (event: KonvaEventObject<MouseEvent>) => void;
	_onMouseUp: (event: KonvaEventObject<MouseEvent>) => void;
	_dragBoundFunc: (pos: { x: number; y: number }) => { x: number; y: number };
	_onSegmentDragStart: (event: KonvaEventObject<MouseEvent>) => void;
	_onSegmentDragMove: (event: KonvaEventObject<MouseEvent>) => void;
	_onSegmentDragEnd: (event: KonvaEventObject<MouseEvent>) => void;
	_onSegmentMarkerClick: (
		marker: SegmentMarkerAPI,
		event: KonvaMouseEvent,
	) => void;
	_onSegmentMarkerDragStart: (
		marker: SegmentMarkerAPI,
		event: KonvaMouseEvent,
	) => void;
	_onSegmentMarkerDragMove: (
		marker: SegmentMarkerAPI,
		event: KonvaMouseEvent,
	) => void;
	_onSegmentMarkerDragEnd: (
		marker: SegmentMarkerAPI,
		event: KonvaMouseEvent,
	) => void;
	_segmentMarkerDragBoundFunc: (
		marker: SegmentMarkerAPI,
		pos: { x: number; y: number },
	) => { x: number; y: number };

	constructor(
		segment: Segment,
		peaks: PeaksInstance,
		layer: SegmentsLayerAPI,
		view: WaveformViewAPI,
	) {
		this._segment = segment;
		this._peaks = peaks;
		this._layer = layer;
		this._view = view;
		this._label = null;
		this._startMarker = null;
		this._endMarker = null;
		this._color = segment.color;
		this._borderColor = segment.borderColor;
		this._draggable =
			this._segment.editable && this._view.isSegmentDraggingEnabled();
		this._dragging = false;

		const viewOptions = view.getViewOptions();
		const segmentOptions = viewOptions.segmentOptions;

		this._overlayOffset = segmentOptions.overlayOffset;

		this._waveformShape = null;

		if (!segment.overlay) {
			this._waveformShape = new WaveformShape({
				color: segment.color,
				view: view,
				segment: segment,
			});
		}

		this._onMouseEnter = this.#onMouseEnter.bind(this);
		this._onMouseLeave = this.#onMouseLeave.bind(this);
		this._onMouseDown = this.#onMouseDown.bind(this);
		this._onMouseUp = this.#onMouseUp.bind(this);

		this._dragBoundFunc = this.#dragBoundFunc.bind(this);
		this._onSegmentDragStart = this.#onSegmentDragStart.bind(this);
		this._onSegmentDragMove = this.#onSegmentDragMove.bind(this);
		this._onSegmentDragEnd = this.#onSegmentDragEnd.bind(this);

		// Event handlers for markers
		this._onSegmentMarkerClick = this.#onSegmentMarkerClick.bind(this);
		this._onSegmentMarkerDragStart = this.#onSegmentMarkerDragStart.bind(this);
		this._onSegmentMarkerDragMove = this.#onSegmentMarkerDragMove.bind(this);
		this._onSegmentMarkerDragEnd = this.#onSegmentMarkerDragEnd.bind(this);
		this._segmentMarkerDragBoundFunc =
			this.#segmentMarkerDragBoundFunc.bind(this);

		this._label = this._peaks.options.createSegmentLabel({
			segment: segment,
			view: this._view.getName(),
			layer: this._layer,
			fontFamily: viewOptions.fontFamily,
			fontSize: viewOptions.fontSize,
			fontStyle: viewOptions.fontStyle,
		});

		if (this._label) {
			this._label.hide();
		}

		// Create with default y and height, the real values are set in fitToView().
		const segmentStartOffset = this._view.timeToPixelOffset(
			this._segment.startTime,
		);
		const segmentEndOffset = this._view.timeToPixelOffset(
			this._segment.endTime,
		);

		const overlayRectHeight = Math.max(
			0,
			this._view.getHeight() - 2 * this._overlayOffset,
		);

		// The clip rectangle prevents text in the overlay from appearing
		// outside the overlay.

		this._overlay = new Konva.Group({
			name: "segment-overlay",
			segment: this._segment,
			x: segmentStartOffset,
			y: 0,
			width: segmentEndOffset - segmentStartOffset,
			height: this._view.getHeight(),
			clipX: 0,
			clipY: this._overlayOffset,
			clipWidth: segmentEndOffset - segmentStartOffset,
			clipHeight: overlayRectHeight,
			draggable: this._draggable,
			dragBoundFunc: this._dragBoundFunc,
		});

		let overlayBorderColor: string | undefined,
			overlayBorderWidth: number | undefined,
			overlayColor: string | undefined,
			overlayOpacity: number | undefined,
			overlayCornerRadius: number | undefined;

		if (segment.overlay) {
			overlayBorderColor =
				this._borderColor || segmentOptions.overlayBorderColor;
			overlayBorderWidth = segmentOptions.overlayBorderWidth;
			overlayColor = this._color || segmentOptions.overlayColor;
			overlayOpacity = segmentOptions.overlayOpacity;
			overlayCornerRadius = segmentOptions.overlayCornerRadius;
		}

		const rectConfig: Record<string, unknown> = {
			x: 0,
			y: this._overlayOffset,
			width: segmentEndOffset - segmentStartOffset,
			height: overlayRectHeight,
		};

		if (overlayBorderColor !== undefined) {
			rectConfig.stroke = overlayBorderColor;
		}
		if (overlayBorderWidth !== undefined) {
			rectConfig.strokeWidth = overlayBorderWidth;
		}
		if (overlayColor !== undefined) {
			rectConfig.fill = overlayColor;
		}
		if (overlayOpacity !== undefined) {
			rectConfig.opacity = overlayOpacity;
		}

		if (overlayCornerRadius !== undefined) {
			rectConfig.cornerRadius = overlayCornerRadius;
		}

		this._overlayRect = new Rect(rectConfig);

		this._overlay.add(this._overlayRect);

		if (segment.overlay) {
			this._overlayText = new Text({
				x: 0,
				y: this._overlayOffset,
				text: this._segment.labelText,
				fontFamily: segmentOptions.overlayFontFamily,
				fontSize: segmentOptions.overlayFontSize,
				fontStyle: segmentOptions.overlayFontStyle,
				fill: segmentOptions.overlayLabelColor,
				listening: false,
				align: segmentOptions.overlayLabelAlign,
				width: segmentEndOffset - segmentStartOffset,
				verticalAlign: segmentOptions.overlayLabelVerticalAlign,
				height: overlayRectHeight,
				padding: segmentOptions.overlayLabelPadding,
			});

			this._overlay.add(this._overlayText);
		}

		// Set up event handlers to show/hide the segment label text when the user
		// hovers the mouse over the segment.
		this._overlay.on("mouseenter", this._onMouseEnter);
		this._overlay.on("mouseleave", this._onMouseLeave);

		this._overlay.on("mousedown", this._onMouseDown);
		this._overlay.on("mouseup", this._onMouseUp);

		if (this._draggable) {
			this._overlay.on("dragstart", this._onSegmentDragStart);
			this._overlay.on("dragmove", this._onSegmentDragMove);
			this._overlay.on("dragend", this._onSegmentDragEnd);
		}

		this._createMarkers();
	}

	_createMarkers() {
		const editable = this._layer.isEditingEnabled() && this._segment.editable;
		const viewOptions = this._view.getViewOptions();
		const segmentOptions = viewOptions.segmentOptions;

		let createSegmentMarkerFn:
			| ((options: CreateSegmentMarkerOptions) => Marker | null)
			| null = null;
		let startMarker: Marker | null = null;
		let endMarker: Marker | null = null;

		if (this._segment.markers) {
			createSegmentMarkerFn = this._peaks.options.createSegmentMarker;
		} else if (this._segment.overlay) {
			createSegmentMarkerFn = createOverlayMarker;
		}

		if (createSegmentMarkerFn) {
			startMarker = createSegmentMarkerFn({
				segment: this._segment,
				editable: editable,
				startMarker: true,
				color: segmentOptions.startMarkerColor,
				fontFamily: viewOptions.fontFamily,
				fontSize: viewOptions.fontSize,
				fontStyle: viewOptions.fontStyle,
				layer: this._layer,
				view: this._view.getName(),
				segmentOptions: this._view.getViewOptions().segmentOptions,
			});
		}

		if (startMarker) {
			this._startMarker = new SegmentMarker({
				segment: this._segment,
				segmentShape: this,
				editable: editable,
				startMarker: true,
				marker: startMarker,
				onClick: this._onSegmentMarkerClick,
				onDragStart: this._onSegmentMarkerDragStart,
				onDragMove: this._onSegmentMarkerDragMove,
				onDragEnd: this._onSegmentMarkerDragEnd,
				dragBoundFunc: this._segmentMarkerDragBoundFunc,
			});
		}

		if (createSegmentMarkerFn) {
			endMarker = createSegmentMarkerFn({
				segment: this._segment,
				editable: editable,
				startMarker: false,
				color: segmentOptions.endMarkerColor,
				fontFamily: viewOptions.fontFamily,
				fontSize: viewOptions.fontSize,
				fontStyle: viewOptions.fontStyle,
				layer: this._layer,
				view: this._view.getName(),
				segmentOptions: this._view.getViewOptions().segmentOptions,
			});
		}

		if (endMarker) {
			this._endMarker = new SegmentMarker({
				segment: this._segment,
				segmentShape: this,
				editable: editable,
				startMarker: false,
				marker: endMarker,
				onClick: this._onSegmentMarkerClick,
				onDragStart: this._onSegmentMarkerDragStart,
				onDragMove: this._onSegmentMarkerDragMove,
				onDragEnd: this._onSegmentMarkerDragEnd,
				dragBoundFunc: this._segmentMarkerDragBoundFunc,
			});
		}
	}

	#dragBoundFunc(pos: { x: number; y: number }) {
		// Allow the segment to be moved horizontally but not vertically.
		return {
			x: pos.x,
			y: 0,
		};
	}

	update(options?: Record<string, unknown>) {
		const segmentStartOffset = this._view.timeToPixelOffset(
			this._segment.startTime,
		);
		const segmentEndOffset = this._view.timeToPixelOffset(
			this._segment.endTime,
		);
		const width = segmentEndOffset - segmentStartOffset;
		let marker;

		if ((marker = this.getStartMarker())) {
			marker.setX(segmentStartOffset - marker.getWidth());

			if (options) {
				marker.update(options);
			}
		}

		if ((marker = this.getEndMarker())) {
			marker.setX(segmentEndOffset);

			if (options) {
				marker.update(options);
			}
		}

		this._color = this._segment.color;
		this._borderColor = this._segment.borderColor;

		if (this._label && "text" in this._label) {
			(this._label as Text).text(this._segment.labelText);
		}

		if (this._overlayText) {
			this._overlayText.text(this._segment.labelText);
		}

		if (this._segment.overlay) {
			if (this._color) {
				this._overlayRect.fill(this._color);
			}

			if (this._borderColor) {
				this._overlayRect.stroke(this._borderColor);
			}
		} else {
			this._waveformShape?.setWaveformColor(this._segment.color);
		}

		// While dragging, the overlay position is controlled in _onSegmentDragMove().

		if (!this._dragging) {
			if (this._overlay) {
				this._overlay.setAttrs({
					x: segmentStartOffset,
					width: width,
					clipWidth: width < 1 ? 1 : width,
				});

				this._overlayRect.setAttrs({
					x: 0,
					width: width,
				});

				if (this._overlayText) {
					this._overlayText.setAttrs({
						width: width,
					});
				}
			}
		}
	}

	getSegment() {
		return this._segment;
	}

	getStartMarker() {
		return this._startMarker;
	}

	getEndMarker() {
		return this._endMarker;
	}

	addToLayer(layer: Layer) {
		if (this._waveformShape) {
			this._waveformShape.addToLayer(layer);
		}

		if (this._label) {
			layer.add(this._label);
		}

		if (this._overlay) {
			layer.add(this._overlay);
		}

		if (this._startMarker) {
			this._startMarker.addToLayer(layer);
		}

		if (this._endMarker) {
			this._endMarker.addToLayer(layer);
		}
	}

	isDragging() {
		return this._dragging;
	}

	#onMouseEnter(event: KonvaEventObject<MouseEvent>) {
		if (this._label) {
			this._label.moveToTop();
			this._label.show();
		}

		this._peaks.emit("segments.mouseenter", {
			segment: this._segment,
			evt: event.evt,
		});
	}

	#onMouseLeave(event: KonvaEventObject<MouseEvent>) {
		if (this._label) {
			this._label.hide();
		}

		this._peaks.emit("segments.mouseleave", {
			segment: this._segment,
			evt: event.evt,
		});
	}

	#onMouseDown(event: KonvaEventObject<MouseEvent>) {
		this._peaks.emit("segments.mousedown", {
			segment: this._segment,
			evt: event.evt,
		});
	}

	#onMouseUp(event: KonvaEventObject<MouseEvent>) {
		this._peaks.emit("segments.mouseup", {
			segment: this._segment,
			evt: event.evt,
		});
	}

	segmentClicked(eventName: string, event: SegmentClickEvent) {
		this._moveToTop();

		this._peaks.emit(`segments.${eventName}`, event);
	}

	_moveToTop() {
		this._overlay.moveToTop();

		this._layer.moveSegmentMarkersToTop();
	}

	enableSegmentDragging(enable: boolean) {
		if (!this._segment.editable) {
			return;
		}

		if (!this._draggable && enable) {
			this._overlay.on("dragstart", this._onSegmentDragStart);
			this._overlay.on("dragmove", this._onSegmentDragMove);
			this._overlay.on("dragend", this._onSegmentDragEnd);
		} else if (this._draggable && !enable) {
			this._overlay.off("dragstart", this._onSegmentDragStart);
			this._overlay.off("dragmove", this._onSegmentDragMove);
			this._overlay.off("dragend", this._onSegmentDragEnd);
		}

		this._overlay.draggable(enable);
		this._draggable = enable;
	}

	_setPreviousAndNextSegments() {
		if (this._view.getSegmentDragMode() !== "overlap") {
			this._nextSegment = this._peaks.segments.findNextSegment(this._segment);
			this._previousSegment = this._peaks.segments.findPreviousSegment(
				this._segment,
			);
		} else {
			this._nextSegment = undefined;
			this._previousSegment = undefined;
		}
	}

	#onSegmentDragStart(event: KonvaEventObject<MouseEvent>) {
		this._setPreviousAndNextSegments();

		this._dragging = true;
		this._dragStartX = this._overlay?.x();
		this._dragStartTime = this._segment.startTime;
		this._dragEndTime = this._segment.endTime;

		this._peaks.emit("segments.dragstart", {
			segment: this._segment,
			marker: false,
			startMarker: false,
			evt: event.evt,
		});
	}

	#onSegmentDragMove(event: KonvaEventObject<MouseEvent>) {
		const x = this._overlay?.x();
		const offsetX = x - this._dragStartX;
		const timeOffset = this._view.pixelsToTime(offsetX);

		// The WaveformShape for a segment fills the canvas width
		// but only draws a subset of the horizontal range. When dragged
		// we need to keep the shape object in its position but
		// update the segment start and end time so that the right
		// subset is drawn.

		// Calculate new segment start/end time based on drag position. We'll
		// correct this later based on the drag mode, to prevent overlapping
		// segments or to compress the adjacent segment.

		let startTime = this._dragStartTime + timeOffset;
		let endTime = this._dragEndTime + timeOffset;
		const segmentDuration = this._segment.endTime - this._segment.startTime;
		let dragMode;
		const minSegmentWidth = this._view.getMinSegmentDragWidth();
		const minSegmentDuration = this._view.pixelsToTime(minSegmentWidth);
		let previousSegmentUpdated = false;
		let nextSegmentUpdated = false;

		// Prevent the segment from being dragged beyond the start of the waveform.

		if (startTime < 0) {
			startTime = 0;
			endTime = segmentDuration;
			this._overlay?.x(this._view.timeToPixelOffset(startTime));
		}

		// Adjust segment position if it now overlaps the previous segment?

		if (this._previousSegment) {
			let previousSegmentEndX = this._view.timeToPixelOffset(
				this._previousSegment.endTime,
			);

			if (startTime < this._previousSegment.endTime) {
				dragMode = this._view.getSegmentDragMode();

				if (
					dragMode === "no-overlap" ||
					(dragMode === "compress" && !this._previousSegment.editable)
				) {
					startTime = this._previousSegment.endTime;
					endTime = startTime + segmentDuration;
					this._overlay?.x(previousSegmentEndX);
				} else if (dragMode === "compress") {
					let previousSegmentEndTime = startTime;

					const minPreviousSegmentEndTime =
						this._previousSegment.startTime + minSegmentDuration;

					if (previousSegmentEndTime < minPreviousSegmentEndTime) {
						previousSegmentEndTime = minPreviousSegmentEndTime;

						previousSegmentEndX = this._view.timeToPixelOffset(
							previousSegmentEndTime,
						);

						this._overlay?.x(previousSegmentEndX);

						startTime = previousSegmentEndTime;
						endTime = startTime + segmentDuration;
					}

					this._previousSegment.update({ endTime: previousSegmentEndTime });

					previousSegmentUpdated = true;
				}
			}
		}

		// Adjust segment position if it now overlaps the following segment?

		if (this._nextSegment) {
			let nextSegmentStartX = this._view.timeToPixelOffset(
				this._nextSegment.startTime,
			);

			if (endTime > this._nextSegment.startTime) {
				dragMode = this._view.getSegmentDragMode();

				if (
					dragMode === "no-overlap" ||
					(dragMode === "compress" && !this._nextSegment.editable)
				) {
					endTime = this._nextSegment.startTime;
					startTime = endTime - segmentDuration;
					this._overlay?.x(nextSegmentStartX - this._overlay?.width());
				} else if (dragMode === "compress") {
					let nextSegmentStartTime = endTime;

					const maxNextSegmentStartTime =
						this._nextSegment.endTime - minSegmentDuration;

					if (nextSegmentStartTime > maxNextSegmentStartTime) {
						nextSegmentStartTime = maxNextSegmentStartTime;

						nextSegmentStartX =
							this._view.timeToPixelOffset(nextSegmentStartTime);

						this._overlay?.x(nextSegmentStartX - this._overlay?.width());

						endTime = nextSegmentStartTime;
						startTime = endTime - segmentDuration;
					}

					this._nextSegment.update({ startTime: nextSegmentStartTime });

					nextSegmentUpdated = true;
				}
			}
		}

		this._segment._setStartTime(startTime);
		this._segment._setEndTime(endTime);

		this._peaks.emit("segments.dragged", {
			segment: this._segment,
			marker: false,
			startMarker: false,
			evt: event.evt,
		});

		if (previousSegmentUpdated) {
			this._peaks.emit("segments.dragged", {
				segment: this._previousSegment,
				marker: false,
				startMarker: false,
				evt: event.evt,
			});
		} else if (nextSegmentUpdated) {
			this._peaks.emit("segments.dragged", {
				segment: this._nextSegment,
				marker: false,
				startMarker: false,
				evt: event.evt,
			});
		}
	}

	#onSegmentDragEnd(event: KonvaEventObject<MouseEvent>) {
		this._dragging = false;

		this._peaks.emit("segments.dragend", {
			segment: this._segment,
			marker: false,
			startMarker: false,
			evt: event.evt,
		});
	}

	moveMarkersToTop() {
		if (this._startMarker) {
			this._startMarker.moveToTop();
		}

		if (this._endMarker) {
			this._endMarker.moveToTop();
		}
	}

	startDrag() {
		if (this._endMarker) {
			this._endMarker.startDrag();
		}
	}

	stopDrag() {
		if (this._endMarker) {
			this._endMarker.stopDrag();
		}
	}

	#onSegmentMarkerDragStart(
		segmentMarker: SegmentMarkerAPI,
		event: KonvaMouseEvent,
	) {
		if (!this._startMarker || !this._endMarker) {
			return;
		}

		this._setPreviousAndNextSegments();

		// Move this segment to the top of the z-order, so that it remains on top
		// of any adjacent segments that the marker is dragged over.
		this._moveToTop();

		this._startMarkerX = this._startMarker.getX();
		this._endMarkerX = this._endMarker.getX();

		this._peaks.emit("segments.dragstart", {
			segment: this._segment,
			marker: true,
			startMarker: segmentMarker.isStartMarker(),
			evt: event.evt,
		});
	}

	#onSegmentMarkerDragMove(
		segmentMarker: SegmentMarkerAPI,
		event: KonvaMouseEvent,
	) {
		if (segmentMarker.isStartMarker()) {
			this._segmentStartMarkerDragMove(segmentMarker, event);
			segmentMarker.update({ startTime: this._segment.startTime });
		} else {
			this._segmentEndMarkerDragMove(segmentMarker, event);
			segmentMarker.update({ endTime: this._segment.endTime });
		}
	}

	_segmentStartMarkerDragMove(
		segmentMarker: SegmentMarkerAPI,
		event: KonvaMouseEvent,
	) {
		if (!this._startMarker || !this._endMarker) {
			return;
		}

		const width = this._view.getWidth();

		let startMarkerX = this._startMarker.getX();
		const endMarkerX = this._endMarker.getX();

		let minSegmentDuration = this._view.pixelsToTime(50);
		const minSegmentWidth = this._view.getMinSegmentDragWidth();

		let upperLimit = this._endMarker.getX() - minSegmentWidth;

		if (upperLimit > width) {
			upperLimit = width;
		}

		let previousSegmentVisible = false;
		let previousSegmentUpdated = false;
		let previousSegmentEndX = 0;

		if (this._previousSegment) {
			previousSegmentEndX = this._view.timeToPixelOffset(
				this._previousSegment.endTime,
			);
			previousSegmentVisible = previousSegmentEndX >= 0;
		}

		if (startMarkerX > upperLimit) {
			segmentMarker.setX(upperLimit);
			this._overlay.clipWidth(upperLimit - endMarkerX);

			if (minSegmentWidth === 0 && upperLimit < width) {
				this._segment._setStartTime(this._segment.endTime);
			} else {
				this._segment._setStartTime(this._view.pixelOffsetToTime(upperLimit));
			}
		} else if (this._previousSegment && previousSegmentVisible) {
			const dragMode = this._view.getSegmentDragMode();

			const fixedPreviousSegment =
				dragMode === "no-overlap" ||
				(dragMode === "compress" && !this._previousSegment.editable);

			const compressPreviousSegment =
				dragMode === "compress" && this._previousSegment.editable;

			if (startMarkerX <= previousSegmentEndX) {
				if (fixedPreviousSegment) {
					segmentMarker.setX(previousSegmentEndX);
					this._overlay.clipWidth(previousSegmentEndX - endMarkerX);

					this._segment._setStartTime(this._previousSegment.endTime);
				} else if (compressPreviousSegment) {
					const previousSegmentDuration = getDuration(this._previousSegment);

					if (previousSegmentDuration < minSegmentDuration) {
						minSegmentDuration = previousSegmentDuration;
					}

					const lowerLimit = this._view.timeToPixelOffset(
						this._previousSegment.startTime + minSegmentDuration,
					);

					if (startMarkerX < lowerLimit) {
						startMarkerX = lowerLimit;
					}

					segmentMarker.setX(startMarkerX);
					this._overlay.clipWidth(endMarkerX - startMarkerX);

					this._segment._setStartTime(
						this._view.pixelOffsetToTime(startMarkerX),
					);

					this._previousSegment.update({
						endTime: this._view.pixelOffsetToTime(startMarkerX),
					});

					previousSegmentUpdated = true;
				}
			} else {
				if (startMarkerX < 0) {
					startMarkerX = 0;
				}

				segmentMarker.setX(startMarkerX);
				this._overlay.clipWidth(endMarkerX - startMarkerX);

				this._segment._setStartTime(this._view.pixelOffsetToTime(startMarkerX));
			}
		} else {
			if (startMarkerX < 0) {
				startMarkerX = 0;
			}

			segmentMarker.setX(startMarkerX);
			this._overlay.clipWidth(endMarkerX - startMarkerX);

			this._segment._setStartTime(this._view.pixelOffsetToTime(startMarkerX));
		}

		this._peaks.emit("segments.dragged", {
			segment: this._segment,
			marker: true,
			startMarker: true,
			evt: event.evt,
		});

		if (previousSegmentUpdated) {
			this._peaks.emit("segments.dragged", {
				segment: this._previousSegment,
				marker: true,
				startMarker: false,
				evt: event.evt,
			});
		}
	}

	_segmentEndMarkerDragMove(
		segmentMarker: SegmentMarkerAPI,
		event: KonvaMouseEvent,
	) {
		if (!this._startMarker || !this._endMarker) {
			return;
		}

		const width = this._view.getWidth();

		const startMarkerX = this._startMarker.getX();
		let endMarkerX = this._endMarker.getX();

		let minSegmentDuration = this._view.pixelsToTime(50);
		const minSegmentWidth = this._view.getMinSegmentDragWidth();

		let lowerLimit = this._startMarker.getX() + minSegmentWidth;

		if (lowerLimit < 0) {
			lowerLimit = 0;
		}

		let nextSegmentVisible = false;
		let nextSegmentUpdated = false;
		let nextSegmentStartX = 0;

		if (this._nextSegment) {
			nextSegmentStartX = this._view.timeToPixelOffset(
				this._nextSegment.startTime,
			);
			nextSegmentVisible = nextSegmentStartX < width;
		}

		if (endMarkerX < lowerLimit) {
			segmentMarker.setX(lowerLimit);
			this._overlay.clipWidth(lowerLimit - startMarkerX);

			if (minSegmentWidth === 0 && lowerLimit > 0) {
				this._segment._setEndTime(this._segment.startTime);
			} else {
				this._segment._setEndTime(this._view.pixelOffsetToTime(lowerLimit));
			}
		} else if (this._nextSegment && nextSegmentVisible) {
			const dragMode = this._view.getSegmentDragMode();

			const fixedNextSegment =
				dragMode === "no-overlap" ||
				(dragMode === "compress" && !this._nextSegment.editable);

			const compressNextSegment =
				dragMode === "compress" && this._nextSegment.editable;

			if (endMarkerX >= nextSegmentStartX) {
				if (fixedNextSegment) {
					segmentMarker.setX(nextSegmentStartX);
					this._overlay.clipWidth(nextSegmentStartX - startMarkerX);

					this._segment._setEndTime(this._nextSegment.startTime);
				} else if (compressNextSegment) {
					const nextSegmentDuration = getDuration(this._nextSegment);

					if (nextSegmentDuration < minSegmentDuration) {
						minSegmentDuration = nextSegmentDuration;
					}

					const upperLimit = this._view.timeToPixelOffset(
						this._nextSegment.endTime - minSegmentDuration,
					);

					if (endMarkerX > upperLimit) {
						endMarkerX = upperLimit;
					}

					segmentMarker.setX(endMarkerX);
					this._overlay.clipWidth(endMarkerX - startMarkerX);

					this._segment._setEndTime(this._view.pixelOffsetToTime(endMarkerX));

					this._nextSegment.update({
						startTime: this._view.pixelOffsetToTime(endMarkerX),
					});

					nextSegmentUpdated = true;
				}
			} else {
				if (endMarkerX > width) {
					endMarkerX = width;
				}

				segmentMarker.setX(endMarkerX);
				this._overlay.clipWidth(endMarkerX - startMarkerX);

				this._segment._setEndTime(this._view.pixelOffsetToTime(endMarkerX));
			}
		} else {
			if (endMarkerX > width) {
				endMarkerX = width;
			}

			segmentMarker.setX(endMarkerX);
			this._overlay.clipWidth(endMarkerX - startMarkerX);

			this._segment._setEndTime(this._view.pixelOffsetToTime(endMarkerX));
		}

		this._peaks.emit("segments.dragged", {
			segment: this._segment,
			marker: true,
			startMarker: false,
			evt: event.evt,
		});

		if (nextSegmentUpdated) {
			this._peaks.emit("segments.dragged", {
				segment: this._nextSegment,
				marker: true,
				startMarker: true,
				evt: event.evt,
			});
		}
	}

	#onSegmentMarkerDragEnd(
		segmentMarker: SegmentMarkerAPI,
		event: KonvaMouseEvent,
	) {
		this._nextSegment = undefined;
		this._previousSegment = undefined;

		const startMarker = segmentMarker.isStartMarker();

		this._peaks.emit("segments.dragend", {
			segment: this._segment,
			marker: true,
			startMarker: startMarker,
			evt: event.evt,
		});
	}

	#segmentMarkerDragBoundFunc(
		segmentMarker: SegmentMarkerAPI,
		pos: { x: number; y: number },
	) {
		// Allow the marker to be moved horizontally but not vertically.
		return {
			x: pos.x,
			y: segmentMarker.getAbsolutePosition().y,
		};
	}

	#onSegmentMarkerClick() {
		// Move this segment to the top of the z-order.
		this._moveToTop();
	}

	fitToView() {
		if (this._startMarker) {
			this._startMarker.fitToView();
		}

		if (this._endMarker) {
			this._endMarker.fitToView();
		}

		if (this._overlay) {
			const height = this._view.getHeight();

			const overlayRectHeight = Math.max(0, height - this._overlayOffset * 2);

			this._overlay.setAttrs({
				y: 0,
				height: height,
				clipY: this._overlayOffset,
				clipHeight: overlayRectHeight,
			});

			this._overlayRect.setAttrs({
				y: this._overlayOffset,
				height: overlayRectHeight,
			});

			if (this._overlayText) {
				this._overlayText.setAttrs({
					y: this._overlayOffset,
					height: overlayRectHeight,
				});
			}
		}
	}

	destroy() {
		if (this._waveformShape) {
			this._waveformShape.destroy();
		}

		if (this._label) {
			this._label.destroy();
		}

		if (this._startMarker) {
			this._startMarker.destroy();
		}

		if (this._endMarker) {
			this._endMarker.destroy();
		}

		if (this._overlay) {
			this._overlay.destroy();
		}
	}
}

export default SegmentShape;
