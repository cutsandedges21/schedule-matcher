// src/features/upload/UploadPage.tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { prepareImage, prepareCanvas, type CropRect } from '@/domain/image';
import { extractScheduleByOcr, mergeAcrossDays } from '@/domain/ocrSchedule';
import { ocrProgressFraction, ocrProgressLabel } from '@/domain/ocrProgress';
import { extractedClassSchema } from '@/domain/schema';
import { MAX_IMAGE_BYTES, OCR_MAX_IMAGE_EDGE } from '@/domain/constants';
import { saveSchedule } from '@/features/schedule/useSchedule';
import ImagePicker from './ImagePicker';
import ImageCropper from './ImageCropper';
import ReviewForm from './ReviewForm';
import Button from '@/components/Button';
import BackButton from '@/components/BackButton';
import ProgressBar from '@/components/ProgressBar';
import type { ExtractedClass } from '@/domain/types';

type Stage =
  | { name: 'picking' }
  | { name: 'cropping'; file: File }
  /** `progress` is 0–1 while OCR reports it, and null once we're waiting on the model. */
  | { name: 'extracting'; progress: number | null; label: string }
  | { name: 'reviewing'; classes: ExtractedClass[]; warnings: string[] };

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

function messageFor(code: string, retryAfterMinutes?: number): string {
  switch (code) {
    case 'RATE_LIMITED':
      return retryAfterMinutes
        ? `You've hit the upload limit for this hour. Try again in about ${plural(retryAfterMinutes, 'minute')}, or enter your classes manually.`
        : "You've hit the upload limit for this hour. Enter your classes manually, or try again later.";
    case 'PROVIDER_RATE_LIMITED':
      return retryAfterMinutes
        ? `The reader is busy right now. Try again in about ${plural(retryAfterMinutes, 'minute')}, or enter your classes manually.`
        : 'The reader is busy right now. Try again in a few minutes, or enter your classes manually.';
    case 'RATE_LIMIT_CHECK_FAILED':
      return 'We could not check your upload limit right now. Try again in a moment, or enter your classes manually.';
    case 'IMAGE_TOO_LARGE':
      return 'That image is too large. Try a screenshot rather than a photo.';
    case 'BAD_IMAGE':
      return "That file isn't an image we can read.";
    default:
      return 'Something went wrong reading that image. Enter your classes manually.';
  }
}

/**
 * supabase-js wraps a non-2xx Edge Function reply in a FunctionsHttpError whose
 * `context` is the raw Response, so the JSON body has to be read off it to get
 * our error code (and, for 429s, how long to wait). Reading `caught.context.error`
 * directly returns undefined.
 */
async function errorBodyOf(caught: unknown): Promise<{ code: string; retryAfterMinutes?: number }> {
  const context = (caught as { context?: Response }).context;
  if (!context || typeof context.json !== 'function') return { code: '' };
  try {
    const body = (await context.json()) as { error?: string; retryAfterMinutes?: number };
    return {
      code: typeof body.error === 'string' ? body.error : '',
      retryAfterMinutes: typeof body.retryAfterMinutes === 'number' ? body.retryAfterMinutes : undefined,
    };
  } catch {
    return { code: '' };
  }
}

/**
 * Validate element-by-element instead of parsing the whole array as one unit.
 * One malformed field (Gemini misreading a room as a 66-character string)
 * must not throw away every correctly-extracted class alongside it.
 */
function parseExtraction(data: unknown): { classes: ExtractedClass[]; warnings: string[] } | null {
  if (typeof data !== 'object' || data === null || !('classes' in data) || !Array.isArray((data as { classes: unknown }).classes)) {
    return null;
  }

  const rawClasses = (data as { classes: unknown[] }).classes;
  const rawWarnings = (data as { warnings?: unknown }).warnings;
  const warnings = Array.isArray(rawWarnings) ? rawWarnings.filter((w): w is string => typeof w === 'string') : [];

  const classes: ExtractedClass[] = [];
  for (const item of rawClasses) {
    const result = extractedClassSchema.safeParse(item);
    if (result.success) {
      classes.push(result.data);
    } else {
      const name = typeof (item as { name?: unknown })?.name === 'string' ? (item as { name: string }).name : null;
      warnings.push(name ? `Could not read "${name}" — dropped it, add it manually if needed.` : 'Could not read one of the classes — dropped it.');
    }
  }

  return { classes, warnings };
}

export default function UploadPage() {
  const navigate = useNavigate();
  const [stage, setStage] = useState<Stage>({ name: 'picking' });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function startManual() {
    setError(null);
    setStage({ name: 'reviewing', classes: [], warnings: [] });
  }

  function handlePick(file: File) {
    setError(null);
    setStage({ name: 'cropping', file });
  }

  async function handleCropConfirm(file: File, crop: CropRect) {
    setError(null);
    setStage({ name: 'extracting', progress: 0.02, label: 'Getting the reader ready…' });

    /**
     * Tesseract counts each phase from zero, and can re-emit a phase it has
     * already passed, so the bar keeps the highest fraction it has seen. A bar
     * that slides backwards reads as "something broke".
     *
     * The guard also means a late callback — one that arrives after an error
     * has moved us on — cannot drag the page back to the extracting stage.
     */
    const report = (status: string, progress: number) => {
      const fraction = ocrProgressFraction(status, progress);
      setStage((current) =>
        current.name === 'extracting'
          ? {
              name: 'extracting',
              progress: Math.max(current.progress ?? 0, fraction),
              label: ocrProgressLabel(status),
            }
          : current
      );
    };

    // On-device OCR first. It measures block boundaries against the grid's own
    // printed time labels instead of estimating them, so its times are exact
    // where the model's drift by up to 30 minutes. It is also free, needs no
    // network, and consumes no rate-limited quota. It only works on a
    // weekday-column grid though, so an unrecognised layout falls through to
    // the model, which handles anything.
    try {
      const canvas = await prepareCanvas(file, crop, OCR_MAX_IMAGE_EDGE);
      const ocr = await extractScheduleByOcr(canvas, report);
      if (ocr.recognized && ocr.classes.length > 0) {
        setStage({ name: 'reviewing', classes: mergeAcrossDays(ocr.classes), warnings: ocr.warnings });
        return;
      }
    } catch (caught) {
      // Never let an OCR failure block the upload — fall through to the model.
      console.error('on-device OCR failed, falling back to the model:', caught);
    }

    // Past this point the work is a network round trip to the model, which
    // reports nothing until it answers. Switch to the indeterminate bar rather
    // than inventing a number.
    setStage({ name: 'extracting', progress: null, label: 'Reading your schedule…' });

    try {
      const image = await prepareImage(file, crop);

      // Spec §10: reject an oversized image client-side before it's ever
      // sent. Checked after downscaling — the same base64-length approximation
      // the Edge Function uses server-side, so both sides agree on the limit.
      if (image.base64.length * 0.75 > MAX_IMAGE_BYTES) {
        setError(messageFor('IMAGE_TOO_LARGE'));
        setStage({ name: 'picking' });
        return;
      }

      const { data, error: fnError } = await supabase.functions.invoke('extract-schedule', {
        body: { imageBase64: image.base64, mimeType: image.mimeType },
      });

      if (fnError) throw fnError;

      const parsed = parseExtraction(data);
      if (!parsed) {
        setError('We could not read that schedule. Enter your classes manually.');
        setStage({ name: 'reviewing', classes: [], warnings: [] });
        return;
      }

      setStage({
        name: 'reviewing',
        classes: parsed.classes,
        warnings: parsed.classes.length === 0
          ? ['No classes found in that image.', ...parsed.warnings]
          : parsed.warnings,
      });
    } catch (caught) {
      const { code, retryAfterMinutes } = await errorBodyOf(caught);
      setError(messageFor(code, retryAfterMinutes));
      setStage({ name: 'reviewing', classes: [], warnings: [] });
    }
  }

  async function handleSave(classes: ExtractedClass[]) {
    setSaving(true);
    try {
      await saveSchedule(classes);
      navigate('/', { replace: true });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save your schedule.');
    } finally {
      setSaving(false);
    }
  }

  if (stage.name === 'extracting') {
    return (
      <main className="flex min-h-dvh flex-col justify-center px-8" aria-busy="true">
        <div className="w-full">
          <ProgressBar value={stage.progress} label={stage.label} />
          <p className="mt-4 text-center text-sm font-medium text-slate-700" aria-live="polite">
            {stage.label}
          </p>
          <p className="mt-1 text-center text-xs text-slate-500">
            This usually takes a few seconds. Keep this screen open.
          </p>
        </div>
      </main>
    );
  }

  if (stage.name === 'cropping') {
    return (
      <ImageCropper
        file={stage.file}
        onConfirm={(crop) => handleCropConfirm(stage.file, crop)}
        onCancel={() => setStage({ name: 'picking' })}
      />
    );
  }

  return (
    <main className="p-4 lg:mx-auto lg:max-w-2xl lg:py-6">
      <BackButton to="/" />

      <h1 className="mt-1 text-2xl font-bold">Add your schedule</h1>

      {error && (
        <div className="mt-3 rounded-xl border border-rose-300 bg-rose-50 p-3 text-sm text-rose-900">
          {error}
        </div>
      )}

      {stage.name === 'picking' ? (
        <>
          <p className="mt-2 text-sm text-slate-600">
            Upload a screenshot and we'll turn it into a real schedule. You can fix anything we misread.
          </p>
          <div className="mt-6">
            <ImagePicker onPick={handlePick} />
          </div>
          <Button variant="ghost" onClick={startManual} className="mt-3 w-full">
            Enter manually instead
          </Button>
        </>
      ) : (
        <div className="mt-4">
          <ReviewForm
            value={stage.classes}
            onChange={(next) => setStage({ ...stage, classes: next })}
            warnings={stage.warnings}
            saving={saving}
            onSave={handleSave}
          />
        </div>
      )}
    </main>
  );
}
