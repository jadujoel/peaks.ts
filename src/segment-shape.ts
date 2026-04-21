import Konva from "konva/lib/Core";
import type { Group } from "konva/lib/Group";
import type { Layer } from "konva/lib/Layer";
import type { KonvaEventObject } from "konva/lib/Node";
import type { Shape } from "konva/lib/Shape";
import { Rect } from "konva/lib/shapes/Rect";
import { Text } from "konva/lib/shapes/Text";

import { OverlaySegmentMarker } from "./overlay-segment-marker";
import type { Segment } from "./segment";
import { SegmentMarker } from "./segment-marker";
import type {
	CreateSegmentMarkerOptions,
	KonvaMouseEvent,
	Marker,
	PeaksInstance,
	SegmentClickEvent,
	SegmentMarkerAPI,
	SegmentsLayerAPI,
	WaveformViewAPI,
	XY,
} from "./types";
import { WaveformShape } from "./waveform/shape";

export function createOverlayMarker(
	options: CreateSegmentMarkerOptions,
): Marker {
	return OverlaySegmentMarker.from({ options });
}

export function getDuration(segment: Segment): number {
	return segment.endTime - segment.startTime;
}

export interface SegmentShapeFromOptions {
	readonly segment: Segment;
	readonly peaks: PeaksInstance;
	readonly layer: SegmentsLayerAPI;
	readonly view: WaveformViewAPI;
}

export class SegmentShape {
	private constructor(
		private readonly segment: Segment,
		private readonly peaks: PeaksInstance,
		private readonly layer: SegmentsLayerAPI,
		private readonly view: WaveformViewAPI,
		private readonly overlayOffset: number,
		private readonly waveformShape: WaveformShape | undefined,
		private readonly overlay: Group,
		private readonly overlayRect: Rect,
		private readonly overlayText: Text | undefined,
		private readonly label: Shape | undefined,
		private color: string | undefined,
		private borderColor: string | undefined,
		private draggable: boolean,
		private dragging: boolean,
		private startMarkerInstance: SegmentMarker | undefined,
		private endMarkerInstance: SegmentMarker | undefined,
		private nextSegment: Segment | undefined,
		private previousSegment: Segment | undefined,
		private dragStartX: number,
		private dragStartTime: number,
		private dragEndTime: number,
	) {}

	static from(options: SegmentShapeFromOptions): SegmentShape {
		const { segment, peaks, layer, view } = options;
		const viewOptions = view.getViewOptions();
		const segmentOptions = viewOptions.segmentOptions;
		const overlayOffset = segmentOptions.overlayOffset;
		const draggable = segment.editable && view.isSegmentDraggingEnabled();

		let waveformShape: WaveformShape | undefined;
		if (!segment.overlay) {
			waveformShape = WaveformShape.from({
				color: segment.color,
				segment: segment,
				view: view,
			});
		}

		const label = peaks.options.createSegmentLabel({
			fontFamily: viewOptions.fontFamily,
			fontSize: viewOptions.fontSize,
			fontStyle: viewOptions.fontStyle,
			layer: layer,
			segment: segment,
			view: view.getName(),
		});

		if (label) {
			label.hide();
		}

		const segmentStartOffset = view.timeToPixelOffset(segment.startTime);
		const segmentEndOffset = view.timeToPixelOffset(segment.endTime);
		const overlayRectHeight = Math.max(0, view.getHeight() - 2 * overlayOffset);

		let instance: SegmentShape;
		const overlay = new Konva.Group({
			clipHeight: overlayRectHeight,
			clipWidth: segmentEndOffset - segmentStartOffset,
			clipX: 0,
			clipY: overlayOffset,
			dragBoundFunc: (pos: XY) => instance.onDragBoundFunc(pos),
			draggable: draggable,
			height: view.getHeight(),
			name: "segment-overlay",
			segment: segment,
			width: segmentEndOffset - segmentStartOffset,
			x: segmentStartOffset,
			y: 0,
		});

		let overlayBorderColor: string | undefined;
		let overlayBorderWidth: number | undefined;
		let overlayColor: string | undefined;
		let overlayOpacity: number | undefined;
		let overlayCornerRadius: number | undefined;

		if (segment.overlay) {
			overlayBorderColor =
				segment.borderColor || segmentOptions.overlayBorderColor;
			overlayBorderWidth = segmentOptions.overlayBorderWidth;
			overlayColor = segment.color || segmentOptions.overlayColor;
			overlayOpacity = segmentOptions.overlayOpacity;
			overlayCornerRadius = segmentOptions.overlayCornerRadius;
		}

		const rectConfig: Record<string, unknown> = {
			height: overlayRectHeight,
			width: segmentEndOffset - segmentStartOffset,
			x: 0,
			y: overlayOffset,
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

		const overlayRect = new Rect(rectConfig);
		overlay.add(overlayRect);

		let overlayText: Text | undefined;
		if (segment.overlay) {
			overlayText = new Text({
				align: segmentOptions.overlayLabelAlign,
				fill: segmentOptions.overlayLabelColor,
				fontFamily: segmentOptions.overlayFontFamily,
				fontSize: segmentOptions.overlayFontSize,
				fontStyle: segmentOptions.overlayFontStyle,
				height: overlayRectHeight,
				listening: false,
				padding: segmentOptions.overlayLabelPadding,
				text: segment.labelText,
				verticalAlign: segmentOptions.overlayLabelVerticalAlign,
				width: segmentEndOffset - segmentStartOffset,
				x: 0,
				y: overlayOffset,
			});
			overlay.add(overlayText);
		}

		instance = new SegmentShape(
			segment,
			peaks,
			layer,
			view,
			overlayOffset,
			waveformShape,
			overlay,
			overlayRect,
			overlayText,
			label,
			segment.color,
			segment.borderColor,
			draggable,
			false,
			undefined,
			undefined,
			undefined,
			undefined,
			0,
			0,
			0,
		);

		overlay.on("mouseenter", instance.onMouseEnter);
		overlay.on("mouseleave", instance.onMouseLeave);
		overlay.on("mousedown", instance.onMouseDown);
		overlay.on("mouseup", instance.onMouseUp);

		if (draggable) {
			overlay.on("dragstart", instance.onSegmentDragStart);
			overlay.on("dragmove", instance.onSegmentDragMove);
			overlay.on("dragend", instance.onSegmentDragEnd);
		}

		instance.createMarkers();

		return instance;
	}

	update(options?: Record<string, unknown>) {
		const segmentStartOffset = this.view.timeToPixelOffset(
			this.segment.startTime,
		);
		const segmentEndOffset = this.view.timeToPixelOffset(this.segment.endTime);
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

		this.color = this.segment.color;
		this.borderColor = this.segment.borderColor;

		if (this.label && "text" in this.label) {
			(this.label as Text).text(this.segment.labelText);
		}

		if (this.overlayText) {
			this.overlayText.text(this.segment.labelText);
		}

		if (this.segment.overlay) {
			if (this.color) {
				this.overlayRect.fill(this.color);
			}

			if (this.borderColor) {
				this.overlayRect.stroke(this.borderColor);
			}
		} else {
			this.waveformShape?.setWaveformColor(this.segment.color);
		}

		// While dragging, the overlay position is controlled in onSegmentDragMove().

		if (!this.dragging) {
			if (this.overlay) {
				this.overlay.setAttrs({
					clipWidth: width < 1 ? 1 : width,
					width: width,
					x: segmentStartOffset,
				});

				this.overlayRect.setAttrs({
					width: width,
					x: 0,
				});

				if (this.overlayText) {
					this.overlayText.setAttrs({
						width: width,
					});
				}
			}
		}
	}

	getSegment() {
		return this.segment;
	}

	getStartMarker() {
		return this.startMarkerInstance;
	}

	getEndMarker() {
		return this.endMarkerInstance;
	}

	addToLayer(layer: Layer) {
		if (this.waveformShape) {
			this.waveformShape.addToLayer(layer);
		}

		if (this.label) {
			layer.add(this.label);
		}

		if (this.overlay) {
			layer.add(this.overlay);
		}

		if (this.startMarkerInstance) {
			this.startMarkerInstance.addToLayer(layer);
		}

		if (this.endMarkerInstance) {
			this.endMarkerInstance.addToLayer(layer);
		}
	}

	isDragging() {
		return this.dragging;
	}

	segmentClicked(eventName: string, event: SegmentClickEvent) {
		this.moveSegmentToTop();

		this.peaks.emit(`segments.${eventName}`, event);
	}

	enableSegmentDragging(enable: boolean) {
		if (!this.segment.editable) {
			return;
		}

		if (!this.draggable && enable) {
			this.overlay.on("dragstart", this.onSegmentDragStart);
			this.overlay.on("dragmove", this.onSegmentDragMove);
			this.overlay.on("dragend", this.onSegmentDragEnd);
		} else if (this.draggable && !enable) {
			this.overlay.off("dragstart", this.onSegmentDragStart);
			this.overlay.off("dragmove", this.onSegmentDragMove);
			this.overlay.off("dragend", this.onSegmentDragEnd);
		}

		this.overlay.draggable(enable);
		this.draggable = enable;
	}

	moveMarkersToTop() {
		if (this.startMarkerInstance) {
			this.startMarkerInstance.moveToTop();
		}

		if (this.endMarkerInstance) {
			this.endMarkerInstance.moveToTop();
		}
	}

	startDrag() {
		if (this.endMarkerInstance) {
			this.endMarkerInstance.startDrag();
		}
	}

	stopDrag() {
		if (this.endMarkerInstance) {
			this.endMarkerInstance.stopDrag();
		}
	}

	fitToView() {
		if (this.startMarkerInstance) {
			this.startMarkerInstance.fitToView();
		}

		if (this.endMarkerInstance) {
			this.endMarkerInstance.fitToView();
		}

		if (this.overlay) {
			const height = this.view.getHeight();

			const overlayRectHeight = Math.max(0, height - this.overlayOffset * 2);

			this.overlay.setAttrs({
				clipHeight: overlayRectHeight,
				clipY: this.overlayOffset,
				height: height,
				y: 0,
			});

			this.overlayRect.setAttrs({
				height: overlayRectHeight,
				y: this.overlayOffset,
			});

			if (this.overlayText) {
				this.overlayText.setAttrs({
					height: overlayRectHeight,
					y: this.overlayOffset,
				});
			}
		}
	}

	dispose(): void {
		if (this.waveformShape) {
			this.waveformShape.dispose();
		}

		if (this.label) {
			this.label.destroy();
		}

		if (this.startMarkerInstance) {
			this.startMarkerInstance.dispose();
		}

		if (this.endMarkerInstance) {
			this.endMarkerInstance.dispose();
		}

		if (this.overlay) {
			this.overlay.destroy();
		}
	}

	private createMarkers() {
		const editable = this.layer.isEditingEnabled() && this.segment.editable;
		const viewOptions = this.view.getViewOptions();
		const segmentOptions = viewOptions.segmentOptions;

		let createSegmentMarkerFn:
			| ((options: CreateSegmentMarkerOptions) => Marker | undefined)
			| undefined;
		let startMarker: Marker | undefined;
		let endMarker: Marker | undefined;

		if (this.segment.markers) {
			createSegmentMarkerFn = this.peaks.options.createSegmentMarker;
		} else if (this.segment.overlay) {
			createSegmentMarkerFn = createOverlayMarker;
		}

		if (createSegmentMarkerFn) {
			startMarker = createSegmentMarkerFn({
				color: segmentOptions.startMarkerColor,
				editable: editable,
				fontFamily: viewOptions.fontFamily,
				fontSize: viewOptions.fontSize,
				fontStyle: viewOptions.fontStyle,
				layer: this.layer,
				segment: this.segment,
				segmentOptions: this.view.getViewOptions().segmentOptions,
				startMarker: true,
				view: this.view.getName(),
			});
		}

		if (startMarker) {
			this.startMarkerInstance = SegmentMarker.from({
				dragBoundFunc: this.onSegmentMarkerDragBoundFunc,
				editable: editable,
				marker: startMarker,
				onClick: this.onSegmentMarkerClick,
				onDragEnd: this.onSegmentMarkerDragEnd,
				onDragMove: this.onSegmentMarkerDragMove,
				onDragStart: this.onSegmentMarkerDragStart,
				segment: this.segment,
				segmentShape: this,
				startMarker: true,
			});
		}

		if (createSegmentMarkerFn) {
			endMarker = createSegmentMarkerFn({
				color: segmentOptions.endMarkerColor,
				editable: editable,
				fontFamily: viewOptions.fontFamily,
				fontSize: viewOptions.fontSize,
				fontStyle: viewOptions.fontStyle,
				layer: this.layer,
				segment: this.segment,
				segmentOptions: this.view.getViewOptions().segmentOptions,
				startMarker: false,
				view: this.view.getName(),
			});
		}

		if (endMarker) {
			this.endMarkerInstance = SegmentMarker.from({
				dragBoundFunc: this.onSegmentMarkerDragBoundFunc,
				editable: editable,
				marker: endMarker,
				onClick: this.onSegmentMarkerClick,
				onDragEnd: this.onSegmentMarkerDragEnd,
				onDragMove: this.onSegmentMarkerDragMove,
				onDragStart: this.onSegmentMarkerDragStart,
				segment: this.segment,
				segmentShape: this,
				startMarker: false,
			});
		}
	}

	private moveSegmentToTop() {
		this.overlay.moveToTop();

		this.layer.moveSegmentMarkersToTop();
	}

	private setPreviousAndNextSegments() {
		if (this.view.getSegmentDragMode() !== "overlap") {
			this.nextSegment = this.peaks.segments.findNextSegment(this.segment);
			this.previousSegment = this.peaks.segments.findPreviousSegment(
				this.segment,
			);
		} else {
			this.nextSegment = undefined;
			this.previousSegment = undefined;
		}
	}

	private segmentStartMarkerDragMove(
		segmentMarker: SegmentMarkerAPI,
		event: KonvaMouseEvent,
	) {
		if (!this.startMarkerInstance || !this.endMarkerInstance) {
			return;
		}

		const width = this.view.getWidth();

		let startMarkerX = this.startMarkerInstance.getX();
		const endMarkerX = this.endMarkerInstance.getX();

		let minSegmentDuration = this.view.pixelsToTime(50);
		const minSegmentWidth = this.view.getMinSegmentDragWidth();

		let upperLimit = this.endMarkerInstance.getX() - minSegmentWidth;

		if (upperLimit > width) {
			upperLimit = width;
		}

		let previousSegmentVisible = false;
		let previousSegmentUpdated = false;
		let previousSegmentEndX = 0;

		if (this.previousSegment) {
			previousSegmentEndX = this.view.timeToPixelOffset(
				this.previousSegment.endTime,
			);
			previousSegmentVisible = previousSegmentEndX >= 0;
		}

		if (startMarkerX > upperLimit) {
			segmentMarker.setX(upperLimit);
			this.overlay.clipWidth(upperLimit - endMarkerX);

			if (minSegmentWidth === 0 && upperLimit < width) {
				this.segment.setStartTime(this.segment.endTime);
			} else {
				this.segment.setStartTime(this.view.pixelOffsetToTime(upperLimit));
			}
		} else if (this.previousSegment && previousSegmentVisible) {
			const dragMode = this.view.getSegmentDragMode();

			const fixedPreviousSegment =
				dragMode === "no-overlap" ||
				(dragMode === "compress" && !this.previousSegment.editable);

			const compressPreviousSegment =
				dragMode === "compress" && this.previousSegment.editable;

			if (startMarkerX <= previousSegmentEndX) {
				if (fixedPreviousSegment) {
					segmentMarker.setX(previousSegmentEndX);
					this.overlay.clipWidth(previousSegmentEndX - endMarkerX);

					this.segment.setStartTime(this.previousSegment.endTime);
				} else if (compressPreviousSegment) {
					const previousSegmentDuration = getDuration(this.previousSegment);

					if (previousSegmentDuration < minSegmentDuration) {
						minSegmentDuration = previousSegmentDuration;
					}

					const lowerLimit = this.view.timeToPixelOffset(
						this.previousSegment.startTime + minSegmentDuration,
					);

					if (startMarkerX < lowerLimit) {
						startMarkerX = lowerLimit;
					}

					segmentMarker.setX(startMarkerX);
					this.overlay.clipWidth(endMarkerX - startMarkerX);

					this.segment.setStartTime(this.view.pixelOffsetToTime(startMarkerX));

					this.previousSegment.update({
						endTime: this.view.pixelOffsetToTime(startMarkerX),
					});

					previousSegmentUpdated = true;
				}
			} else {
				if (startMarkerX < 0) {
					startMarkerX = 0;
				}

				segmentMarker.setX(startMarkerX);
				this.overlay.clipWidth(endMarkerX - startMarkerX);

				this.segment.setStartTime(this.view.pixelOffsetToTime(startMarkerX));
			}
		} else {
			if (startMarkerX < 0) {
				startMarkerX = 0;
			}

			segmentMarker.setX(startMarkerX);
			this.overlay.clipWidth(endMarkerX - startMarkerX);

			this.segment.setStartTime(this.view.pixelOffsetToTime(startMarkerX));
		}

		this.peaks.emit("segments.dragged", {
			evt: event.evt,
			marker: true,
			segment: this.segment,
			startMarker: true,
		});

		if (previousSegmentUpdated) {
			this.peaks.emit("segments.dragged", {
				evt: event.evt,
				marker: true,
				segment: this.previousSegment,
				startMarker: false,
			});
		}
	}

	private segmentEndMarkerDragMove(
		segmentMarker: SegmentMarkerAPI,
		event: KonvaMouseEvent,
	) {
		if (!this.startMarkerInstance || !this.endMarkerInstance) {
			return;
		}

		const width = this.view.getWidth();

		const startMarkerX = this.startMarkerInstance.getX();
		let endMarkerX = this.endMarkerInstance.getX();

		let minSegmentDuration = this.view.pixelsToTime(50);
		const minSegmentWidth = this.view.getMinSegmentDragWidth();

		let lowerLimit = this.startMarkerInstance.getX() + minSegmentWidth;

		if (lowerLimit < 0) {
			lowerLimit = 0;
		}

		let nextSegmentVisible = false;
		let nextSegmentUpdated = false;
		let nextSegmentStartX = 0;

		if (this.nextSegment) {
			nextSegmentStartX = this.view.timeToPixelOffset(
				this.nextSegment.startTime,
			);
			nextSegmentVisible = nextSegmentStartX < width;
		}

		if (endMarkerX < lowerLimit) {
			segmentMarker.setX(lowerLimit);
			this.overlay.clipWidth(lowerLimit - startMarkerX);

			if (minSegmentWidth === 0 && lowerLimit > 0) {
				this.segment.setEndTime(this.segment.startTime);
			} else {
				this.segment.setEndTime(this.view.pixelOffsetToTime(lowerLimit));
			}
		} else if (this.nextSegment && nextSegmentVisible) {
			const dragMode = this.view.getSegmentDragMode();

			const fixedNextSegment =
				dragMode === "no-overlap" ||
				(dragMode === "compress" && !this.nextSegment.editable);

			const compressNextSegment =
				dragMode === "compress" && this.nextSegment.editable;

			if (endMarkerX >= nextSegmentStartX) {
				if (fixedNextSegment) {
					segmentMarker.setX(nextSegmentStartX);
					this.overlay.clipWidth(nextSegmentStartX - startMarkerX);

					this.segment.setEndTime(this.nextSegment.startTime);
				} else if (compressNextSegment) {
					const nextSegmentDuration = getDuration(this.nextSegment);

					if (nextSegmentDuration < minSegmentDuration) {
						minSegmentDuration = nextSegmentDuration;
					}

					const upperLimit = this.view.timeToPixelOffset(
						this.nextSegment.endTime - minSegmentDuration,
					);

					if (endMarkerX > upperLimit) {
						endMarkerX = upperLimit;
					}

					segmentMarker.setX(endMarkerX);
					this.overlay.clipWidth(endMarkerX - startMarkerX);

					this.segment.setEndTime(this.view.pixelOffsetToTime(endMarkerX));

					this.nextSegment.update({
						startTime: this.view.pixelOffsetToTime(endMarkerX),
					});

					nextSegmentUpdated = true;
				}
			} else {
				if (endMarkerX > width) {
					endMarkerX = width;
				}

				segmentMarker.setX(endMarkerX);
				this.overlay.clipWidth(endMarkerX - startMarkerX);

				this.segment.setEndTime(this.view.pixelOffsetToTime(endMarkerX));
			}
		} else {
			if (endMarkerX > width) {
				endMarkerX = width;
			}

			segmentMarker.setX(endMarkerX);
			this.overlay.clipWidth(endMarkerX - startMarkerX);

			this.segment.setEndTime(this.view.pixelOffsetToTime(endMarkerX));
		}

		this.peaks.emit("segments.dragged", {
			evt: event.evt,
			marker: true,
			segment: this.segment,
			startMarker: false,
		});

		if (nextSegmentUpdated) {
			this.peaks.emit("segments.dragged", {
				evt: event.evt,
				marker: true,
				segment: this.nextSegment,
				startMarker: true,
			});
		}
	}

	private onDragBoundFunc = (pos: XY) => {
		// Allow the segment to be moved horizontally but not vertically.
		return {
			x: pos.x,
			y: 0,
		};
	};

	private onMouseEnter = (event: KonvaEventObject<MouseEvent>) => {
		if (this.label) {
			this.label.moveToTop();
			this.label.show();
		}

		this.peaks.emit("segments.mouseenter", {
			evt: event.evt,
			segment: this.segment,
		});
	};

	private onMouseLeave = (event: KonvaEventObject<MouseEvent>) => {
		if (this.label) {
			this.label.hide();
		}

		this.peaks.emit("segments.mouseleave", {
			evt: event.evt,
			segment: this.segment,
		});
	};

	private onMouseDown = (event: KonvaEventObject<MouseEvent>) => {
		this.peaks.emit("segments.mousedown", {
			evt: event.evt,
			segment: this.segment,
		});
	};

	private onMouseUp = (event: KonvaEventObject<MouseEvent>) => {
		this.peaks.emit("segments.mouseup", {
			evt: event.evt,
			segment: this.segment,
		});
	};

	private onSegmentDragStart = (event: KonvaEventObject<MouseEvent>) => {
		this.setPreviousAndNextSegments();

		this.dragging = true;
		this.dragStartX = this.overlay?.x();
		this.dragStartTime = this.segment.startTime;
		this.dragEndTime = this.segment.endTime;

		this.peaks.emit("segments.dragstart", {
			evt: event.evt,
			marker: false,
			segment: this.segment,
			startMarker: false,
		});
	};

	private onSegmentDragMove = (event: KonvaEventObject<MouseEvent>) => {
		const x = this.overlay?.x();
		const offsetX = x - this.dragStartX;
		const timeOffset = this.view.pixelsToTime(offsetX);

		let startTime = this.dragStartTime + timeOffset;
		let endTime = this.dragEndTime + timeOffset;
		const segmentDuration = this.segment.endTime - this.segment.startTime;
		let dragMode;
		const minSegmentWidth = this.view.getMinSegmentDragWidth();
		const minSegmentDuration = this.view.pixelsToTime(minSegmentWidth);
		let previousSegmentUpdated = false;
		let nextSegmentUpdated = false;

		if (startTime < 0) {
			startTime = 0;
			endTime = segmentDuration;
			this.overlay?.x(this.view.timeToPixelOffset(startTime));
		}

		if (this.previousSegment) {
			let previousSegmentEndX = this.view.timeToPixelOffset(
				this.previousSegment.endTime,
			);

			if (startTime < this.previousSegment.endTime) {
				dragMode = this.view.getSegmentDragMode();

				if (
					dragMode === "no-overlap" ||
					(dragMode === "compress" && !this.previousSegment.editable)
				) {
					startTime = this.previousSegment.endTime;
					endTime = startTime + segmentDuration;
					this.overlay?.x(previousSegmentEndX);
				} else if (dragMode === "compress") {
					let previousSegmentEndTime = startTime;

					const minPreviousSegmentEndTime =
						this.previousSegment.startTime + minSegmentDuration;

					if (previousSegmentEndTime < minPreviousSegmentEndTime) {
						previousSegmentEndTime = minPreviousSegmentEndTime;

						previousSegmentEndX = this.view.timeToPixelOffset(
							previousSegmentEndTime,
						);

						this.overlay?.x(previousSegmentEndX);

						startTime = previousSegmentEndTime;
						endTime = startTime + segmentDuration;
					}

					this.previousSegment.update({ endTime: previousSegmentEndTime });

					previousSegmentUpdated = true;
				}
			}
		}

		if (this.nextSegment) {
			let nextSegmentStartX = this.view.timeToPixelOffset(
				this.nextSegment.startTime,
			);

			if (endTime > this.nextSegment.startTime) {
				dragMode = this.view.getSegmentDragMode();

				if (
					dragMode === "no-overlap" ||
					(dragMode === "compress" && !this.nextSegment.editable)
				) {
					endTime = this.nextSegment.startTime;
					startTime = endTime - segmentDuration;
					this.overlay?.x(nextSegmentStartX - this.overlay?.width());
				} else if (dragMode === "compress") {
					let nextSegmentStartTime = endTime;

					const maxNextSegmentStartTime =
						this.nextSegment.endTime - minSegmentDuration;

					if (nextSegmentStartTime > maxNextSegmentStartTime) {
						nextSegmentStartTime = maxNextSegmentStartTime;

						nextSegmentStartX =
							this.view.timeToPixelOffset(nextSegmentStartTime);

						this.overlay?.x(nextSegmentStartX - this.overlay?.width());

						endTime = nextSegmentStartTime;
						startTime = endTime - segmentDuration;
					}

					this.nextSegment.update({ startTime: nextSegmentStartTime });

					nextSegmentUpdated = true;
				}
			}
		}

		this.segment.setStartTime(startTime);
		this.segment.setEndTime(endTime);

		this.peaks.emit("segments.dragged", {
			evt: event.evt,
			marker: false,
			segment: this.segment,
			startMarker: false,
		});

		if (previousSegmentUpdated) {
			this.peaks.emit("segments.dragged", {
				evt: event.evt,
				marker: false,
				segment: this.previousSegment,
				startMarker: false,
			});
		} else if (nextSegmentUpdated) {
			this.peaks.emit("segments.dragged", {
				evt: event.evt,
				marker: false,
				segment: this.nextSegment,
				startMarker: false,
			});
		}
	};

	private onSegmentDragEnd = (event: KonvaEventObject<MouseEvent>) => {
		this.dragging = false;

		this.peaks.emit("segments.dragend", {
			evt: event.evt,
			marker: false,
			segment: this.segment,
			startMarker: false,
		});
	};

	private onSegmentMarkerDragStart = (
		segmentMarker: SegmentMarkerAPI,
		event: KonvaMouseEvent,
	) => {
		if (!this.startMarkerInstance || !this.endMarkerInstance) {
			return;
		}

		this.setPreviousAndNextSegments();

		this.moveSegmentToTop();

		this.peaks.emit("segments.dragstart", {
			evt: event.evt,
			marker: true,
			segment: this.segment,
			startMarker: segmentMarker.isStartMarker(),
		});
	};

	private onSegmentMarkerDragMove = (
		segmentMarker: SegmentMarkerAPI,
		event: KonvaMouseEvent,
	) => {
		if (segmentMarker.isStartMarker()) {
			this.segmentStartMarkerDragMove(segmentMarker, event);
			segmentMarker.update({ startTime: this.segment.startTime });
		} else {
			this.segmentEndMarkerDragMove(segmentMarker, event);
			segmentMarker.update({ endTime: this.segment.endTime });
		}
	};

	private onSegmentMarkerDragEnd = (
		segmentMarker: SegmentMarkerAPI,
		event: KonvaMouseEvent,
	) => {
		this.nextSegment = undefined;
		this.previousSegment = undefined;

		const startMarker = segmentMarker.isStartMarker();

		this.peaks.emit("segments.dragend", {
			evt: event.evt,
			marker: true,
			segment: this.segment,
			startMarker: startMarker,
		});
	};

	private onSegmentMarkerDragBoundFunc = (
		segmentMarker: SegmentMarkerAPI,
		pos: XY,
	) => {
		return {
			x: pos.x,
			y: segmentMarker.getAbsolutePosition().y,
		};
	};

	private onSegmentMarkerClick = () => {
		this.moveSegmentToTop();
	};
}
