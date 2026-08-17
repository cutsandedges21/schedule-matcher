// src/features/upload/ImageCropper.tsx
import { useEffect, useMemo, useRef, useState } from 'react';
import Button from '@/components/Button';
import type { CropRect } from '@/domain/image';

interface Props {
  file: File;
  onConfirm: (crop: CropRect) => void;
  onCancel: () => void;
}

/** Where the image actually renders inside the stage — see `content` below. */
interface ContentRect {
  displayWidth: number;
  displayHeight: number;
  offsetX: number;
  offsetY: number;
}

type DragMode = 'move' | 'n' | 's' | 'e' | 'w' | 'nw' | 'ne' | 'sw' | 'se';

interface DragState {
  mode: DragMode;
  pointerId: number;
  startCrop: CropRect;
  startNorm: { x: number; y: number };
}

/** Handles can't shrink the rectangle's screen size below this many CSS px. */
const MIN_CROP_PX = 60;

/** Touch target for every handle, per the 44px minimum. */
const HANDLE_PX = 44;

/** Inset from the edges so it's visually obvious the rectangle is adjustable. */
const DEFAULT_CROP: CropRect = { x: 0.1, y: 0.1, width: 0.8, height: 0.8 };

/**
 * Which edges each mode moves. Edge handles move ONE edge, so a side can be
 * extended on its own — dragging a corner changes both axes at once, which is
 * why corners alone made the rectangle feel shape-locked.
 */
const EDGES: Record<Exclude<DragMode, 'move'>, { l: boolean; r: boolean; t: boolean; b: boolean }> = {
  n: { l: false, r: false, t: true, b: false },
  s: { l: false, r: false, t: false, b: true },
  w: { l: true, r: false, t: false, b: false },
  e: { l: false, r: true, t: false, b: false },
  nw: { l: true, r: false, t: true, b: false },
  ne: { l: false, r: true, t: true, b: false },
  sw: { l: true, r: false, t: false, b: true },
  se: { l: false, r: true, t: false, b: true },
};

/** Anchor point on the rectangle, as a 0–1 fraction of its width/height. */
const HANDLES: { mode: Exclude<DragMode, 'move'>; fx: number; fy: number; cursor: string }[] = [
  { mode: 'nw', fx: 0, fy: 0, cursor: 'nwse-resize' },
  { mode: 'n', fx: 0.5, fy: 0, cursor: 'ns-resize' },
  { mode: 'ne', fx: 1, fy: 0, cursor: 'nesw-resize' },
  { mode: 'w', fx: 0, fy: 0.5, cursor: 'ew-resize' },
  { mode: 'e', fx: 1, fy: 0.5, cursor: 'ew-resize' },
  { mode: 'sw', fx: 0, fy: 1, cursor: 'nesw-resize' },
  { mode: 's', fx: 0.5, fy: 1, cursor: 'ns-resize' },
  { mode: 'se', fx: 1, fy: 1, cursor: 'nwse-resize' },
];

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Phone-first crop UI so a screenshot upload can be trimmed to just the
 * schedule grid before it's read — see prepareImage() for why that matters
 * for accuracy, not just tidiness.
 *
 * The crop rectangle is tracked in normalized 0–1 image coordinates, not
 * display pixels, because the rendered image size (`content` below) changes
 * with viewport size while the underlying image doesn't — normalized
 * coordinates make every subsequent step (rendering, dragging, and the
 * final canvas crop in prepareImage) resize-safe.
 */
export default function ImageCropper({ file, onConfirm, onCancel }: Props) {
  const stageRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);

  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [natural, setNatural] = useState<{ width: number; height: number } | null>(null);
  const [stageSize, setStageSize] = useState<{ width: number; height: number } | null>(null);
  const [crop, setCrop] = useState<CropRect>(DEFAULT_CROP);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setObjectUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const box = entries[0]?.contentRect;
      if (box) setStageSize({ width: box.width, height: box.height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // The <img> element fills the stage, but with object-contain the visible
  // picture is letterboxed inside it whenever the stage and image aspect
  // ratios differ. Every crop/pointer calculation below needs the actual
  // visible rectangle, not the stage box — so we compute it ourselves and
  // size the <img> to match exactly, which also means the DOM box IS the
  // visible image with no internal letterboxing left to account for.
  const content: ContentRect | null = useMemo(() => {
    if (!natural || !stageSize || stageSize.width <= 0 || stageSize.height <= 0) return null;
    const scale = Math.min(stageSize.width / natural.width, stageSize.height / natural.height);
    const displayWidth = natural.width * scale;
    const displayHeight = natural.height * scale;
    return {
      displayWidth,
      displayHeight,
      offsetX: (stageSize.width - displayWidth) / 2,
      offsetY: (stageSize.height - displayHeight) / 2,
    };
  }, [natural, stageSize]);

  function handleImageLoad(event: React.SyntheticEvent<HTMLImageElement>) {
    const img = event.currentTarget;
    setNatural({ width: img.naturalWidth, height: img.naturalHeight });
  }

  function pointToNorm(clientX: number, clientY: number, rect: ContentRect): { x: number; y: number } {
    const stageBox = stageRef.current!.getBoundingClientRect();
    const localX = clientX - stageBox.left - rect.offsetX;
    const localY = clientY - stageBox.top - rect.offsetY;
    return {
      x: clamp(localX / rect.displayWidth, 0, 1),
      y: clamp(localY / rect.displayHeight, 0, 1),
    };
  }

  function beginDrag(mode: DragMode) {
    return (event: React.PointerEvent) => {
      if (!content) return;
      // Handles are children of the rectangle, so without this the event
      // bubbles to the rectangle's own pointerdown and overwrites the mode
      // with 'move' — which turned every resize into a whole-rect drag.
      event.stopPropagation();
      // Capture keeps the drag alive when the pointer leaves the handle. It can
      // throw if the pointer is already gone; that must not abort the drag,
      // since the stage's own move handler works without capture anyway.
      try {
        stageRef.current?.setPointerCapture(event.pointerId);
      } catch {
        /* capture unavailable — drag still tracked via the stage handlers */
      }
      dragRef.current = {
        mode,
        pointerId: event.pointerId,
        startCrop: crop,
        startNorm: pointToNorm(event.clientX, event.clientY, content),
      };
    };
  }

  function handleDragMove(event: React.PointerEvent) {
    const drag = dragRef.current;
    if (!drag || !content || event.pointerId !== drag.pointerId) return;

    const current = pointToNorm(event.clientX, event.clientY, content);
    const minW = Math.min(0.5, MIN_CROP_PX / content.displayWidth);
    const minH = Math.min(0.5, MIN_CROP_PX / content.displayHeight);

    if (drag.mode === 'move') {
      const dx = current.x - drag.startNorm.x;
      const dy = current.y - drag.startNorm.y;
      setCrop({
        x: clamp(drag.startCrop.x + dx, 0, 1 - drag.startCrop.width),
        y: clamp(drag.startCrop.y + dy, 0, 1 - drag.startCrop.height),
        width: drag.startCrop.width,
        height: drag.startCrop.height,
      });
      return;
    }

    // Resize: only the edges this handle owns move, so `n`/`s`/`e`/`w` adjust a
    // single side while corners adjust two. The untouched edges stay exactly
    // where they were, and each moved edge is clamped so the rectangle can
    // neither invert nor shrink below the minimum on-screen size.
    const x1 = drag.startCrop.x;
    const y1 = drag.startCrop.y;
    const x2 = drag.startCrop.x + drag.startCrop.width;
    const y2 = drag.startCrop.y + drag.startCrop.height;
    const edges = EDGES[drag.mode];

    const nx1 = edges.l ? clamp(current.x, 0, x2 - minW) : x1;
    const nx2 = edges.r ? clamp(current.x, x1 + minW, 1) : x2;
    const ny1 = edges.t ? clamp(current.y, 0, y2 - minH) : y1;
    const ny2 = edges.b ? clamp(current.y, y1 + minH, 1) : y2;

    setCrop({ x: nx1, y: ny1, width: nx2 - nx1, height: ny2 - ny1 });
  }

  function endDrag(event: React.PointerEvent) {
    if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null;
  }

  const rect = content
    ? {
        left: content.offsetX + crop.x * content.displayWidth,
        top: content.offsetY + crop.y * content.displayHeight,
        width: crop.width * content.displayWidth,
        height: crop.height * content.displayHeight,
      }
    : null;

  return (
    <div className="flex min-h-dvh flex-col">
      <div className="flex items-center gap-2 p-4 pb-2">
        <Button
          variant="ghost"
          onClick={onCancel}
          aria-label="Back to choosing an image"
          className="-ml-3 px-3"
        >
          ← Back
        </Button>
      </div>

      {/* Reading the schedule on-device needs both the weekday names and the
          time column to calibrate against — cropping either away silently
          falls back to the slower cloud reader, so ask for them explicitly. */}
      <p className="px-4 pb-3 text-sm text-slate-600">
        Keep the day names along the top and the times down the left side. Trim
        away everything else.
      </p>

      <div
        ref={stageRef}
        className="relative flex-1 touch-none overflow-hidden bg-slate-900"
        style={{ touchAction: 'none' }}
        onPointerMove={handleDragMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        {objectUrl && (
          <img
            src={objectUrl}
            onLoad={handleImageLoad}
            alt="Uploaded schedule, ready to crop"
            draggable={false}
            className="pointer-events-none absolute select-none"
            style={
              content
                ? { left: content.offsetX, top: content.offsetY, width: content.displayWidth, height: content.displayHeight }
                : { opacity: 0 }
            }
          />
        )}

        {content && rect && (
          <>
            {/* Dimmed bands covering everything outside the crop rectangle. */}
            <div
              className="pointer-events-none absolute bg-black/60"
              style={{ left: content.offsetX, top: content.offsetY, width: content.displayWidth, height: rect.top - content.offsetY }}
            />
            <div
              className="pointer-events-none absolute bg-black/60"
              style={{
                left: content.offsetX,
                top: rect.top + rect.height,
                width: content.displayWidth,
                height: content.offsetY + content.displayHeight - (rect.top + rect.height),
              }}
            />
            <div
              className="pointer-events-none absolute bg-black/60"
              style={{ left: content.offsetX, top: rect.top, width: rect.left - content.offsetX, height: rect.height }}
            />
            <div
              className="pointer-events-none absolute bg-black/60"
              style={{
                left: rect.left + rect.width,
                top: rect.top,
                width: content.offsetX + content.displayWidth - (rect.left + rect.width),
                height: rect.height,
              }}
            />

            {/* Crop rectangle: dragging the body moves it, corner handles resize it. */}
            <div
              className="absolute touch-none border-2 border-white shadow-lg"
              style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height, touchAction: 'none', cursor: 'move' }}
              onPointerDown={beginDrag('move')}
            >
              {HANDLES.map(({ mode, fx, fy, cursor }) => {
                const isCorner = mode.length === 2;
                const horizontalEdge = mode === 'n' || mode === 's';
                const verticalEdge = mode === 'e' || mode === 'w';

                // Edge handles stretch along their edge so there is something
                // substantial to grab, stopping short of the corners so they
                // never sit on top of them.
                const width = horizontalEdge
                  ? Math.max(24, rect.width - HANDLE_PX * 2)
                  : HANDLE_PX;
                const height = verticalEdge
                  ? Math.max(24, rect.height - HANDLE_PX * 2)
                  : HANDLE_PX;

                return (
                  <div
                    key={mode}
                    role="button"
                    aria-label={`Resize crop: ${mode}`}
                    className="absolute touch-none"
                    style={{
                      left: fx * rect.width,
                      top: fy * rect.height,
                      width,
                      height,
                      transform: 'translate(-50%, -50%)',
                      touchAction: 'none',
                      cursor,
                    }}
                    onPointerDown={beginDrag(mode)}
                  >
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                      {isCorner ? (
                        <div className="h-4 w-4 rounded-full border-2 border-slate-900 bg-white shadow" />
                      ) : (
                        <div
                          className="rounded-full bg-white shadow"
                          style={
                            horizontalEdge
                              ? { width: 32, height: 5 }
                              : { width: 5, height: 32 }
                          }
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      <div className="border-t border-slate-200 bg-white p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <Button onClick={() => onConfirm(crop)} className="w-full">
          Use this
        </Button>
        <Button
          variant="secondary"
          onClick={() => onConfirm({ x: 0, y: 0, width: 1, height: 1 })}
          className="mt-2 w-full"
        >
          Use full image
        </Button>
      </div>
    </div>
  );
}
