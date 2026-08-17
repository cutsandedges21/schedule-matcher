// src/domain/image.ts
import { MAX_IMAGE_EDGE } from './constants';

/**
 * A crop region in normalized 0–1 coordinates relative to the image's
 * natural (post-EXIF-orientation) size. { x: 0, y: 0, width: 1, height: 1 }
 * is the whole image.
 */
export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Crops (if a CropRect is given) and downscales an image in one pass, then
 * JPEG-encodes it.
 *
 * The crop is applied at the source's natural resolution, before any
 * downscaling. This matters for accuracy, not just framing: a phone
 * screenshot of a schedule is mostly status bar, browser chrome and page
 * furniture, with the actual grid occupying a fraction of the frame. If we
 * downscaled first and cropped after, the grid would already have lost the
 * detail cropping was meant to preserve. Cropping first means the entire
 * MAX_IMAGE_EDGE pixel budget below is spent on the region that actually
 * gets read.
 *
 * The crop and the resize happen in a single nine-argument drawImage call
 * — one source rectangle, one destination rectangle — so there's no
 * intermediate canvas and no extra generation of quality loss.
 */
export async function prepareImage(file: File, crop?: CropRect): Promise<{ base64: string; mimeType: string }> {
  const canvas = await prepareCanvas(file, crop, MAX_IMAGE_EDGE);
  const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
  return { base64: dataUrl.split(',')[1], mimeType: 'image/jpeg' };
}

/**
 * The cropped, scaled image as a canvas — needed by the on-device OCR path,
 * which reads pixels directly rather than sending bytes anywhere.
 *
 * `maxEdge` is a parameter because the two consumers want different things:
 * the upload path trades resolution for a smaller payload over cellular, while
 * OCR wants every pixel it can get, since character recognition degrades
 * sharply as glyphs shrink.
 */
export async function prepareCanvas(
  file: File,
  crop: CropRect | undefined,
  maxEdge: number
): Promise<HTMLCanvasElement> {
  // Without this, a photo taken in portrait (which stores its rotation as
  // EXIF metadata rather than baking it into the pixels) decodes sideways —
  // the canvas below has no idea about EXIF and just copies raw pixels.
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });

  try {
    // Clamp defensively even though the cropper already keeps the rect
    // inside [0, 1] — this is the last line of defense before pixel math.
    const cx = crop ? clamp(crop.x, 0, 1) : 0;
    const cy = crop ? clamp(crop.y, 0, 1) : 0;
    const cw = crop ? clamp(crop.width, 0, 1 - cx) : 1;
    const ch = crop ? clamp(crop.height, 0, 1 - cy) : 1;

    const sx = Math.round(cx * bitmap.width);
    const sy = Math.round(cy * bitmap.height);
    const sWidth = Math.max(1, Math.round(cw * bitmap.width));
    const sHeight = Math.max(1, Math.round(ch * bitmap.height));

    // Never scale above 1.0 — a cropped grid is often already well under
    // the cap, and upscaling it would invent detail, not preserve it.
    const scale = Math.min(1, maxEdge / Math.max(sWidth, sHeight));
    const width = Math.max(1, Math.round(sWidth * scale));
    const height = Math.max(1, Math.round(sHeight * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas is unavailable on this device.');
    ctx.drawImage(bitmap, sx, sy, sWidth, sHeight, 0, 0, width, height);
    return canvas;
  } finally {
    bitmap.close();
  }
}

/** @deprecated Use `prepareImage(file)` — kept only so no existing import breaks. */
export async function downscaleImage(file: File): Promise<{ base64: string; mimeType: string }> {
  return prepareImage(file);
}
