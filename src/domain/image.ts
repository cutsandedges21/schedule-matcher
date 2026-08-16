// src/domain/image.ts
import { MAX_IMAGE_EDGE } from './constants';

export async function downscaleImage(file: File): Promise<{ base64: string; mimeType: string }> {
  // Without this, a photo taken in portrait (which stores its rotation as
  // EXIF metadata rather than baking it into the pixels) decodes sideways —
  // the canvas below has no idea about EXIF and just copies raw pixels.
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is unavailable on this device.');
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
  return { base64: dataUrl.split(',')[1], mimeType: 'image/jpeg' };
}
