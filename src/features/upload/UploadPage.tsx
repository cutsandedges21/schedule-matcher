// src/features/upload/UploadPage.tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { downscaleImage } from '@/domain/image';
import { extractionResponseSchema } from '@/domain/schema';
import { saveSchedule } from '@/features/schedule/useSchedule';
import { useAuth } from '@/features/auth/AuthProvider';
import ImagePicker from './ImagePicker';
import ReviewForm from './ReviewForm';
import Button from '@/components/Button';
import Spinner from '@/components/Spinner';
import type { ExtractedClass } from '@/domain/types';

type Stage =
  | { name: 'picking' }
  | { name: 'extracting' }
  | { name: 'reviewing'; classes: ExtractedClass[]; warnings: string[] };

const MESSAGES: Record<string, string> = {
  RATE_LIMITED: "You've hit the upload limit for this hour. Enter your classes manually, or try again later.",
  PROVIDER_RATE_LIMITED: 'The reader is busy right now. Try again in a few minutes, or enter your classes manually.',
  IMAGE_TOO_LARGE: 'That image is too large. Try a screenshot rather than a photo.',
  BAD_IMAGE: "That file isn't an image we can read.",
};

/**
 * supabase-js wraps a non-2xx Edge Function reply in a FunctionsHttpError whose
 * `context` is the raw Response, so the JSON body has to be read off it to get
 * our error code. Reading `caught.context.error` directly returns undefined.
 */
async function errorCodeOf(caught: unknown): Promise<string> {
  const context = (caught as { context?: Response }).context;
  if (!context || typeof context.json !== 'function') return '';
  try {
    const body = (await context.json()) as { error?: string };
    return typeof body.error === 'string' ? body.error : '';
  } catch {
    return '';
  }
}

export default function UploadPage() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [stage, setStage] = useState<Stage>({ name: 'picking' });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function startManual() {
    setError(null);
    setStage({ name: 'reviewing', classes: [], warnings: [] });
  }

  async function handlePick(file: File) {
    setError(null);
    setStage({ name: 'extracting' });

    try {
      const image = await downscaleImage(file);
      const { data, error: fnError } = await supabase.functions.invoke('extract-schedule', {
        body: { imageBase64: image.base64, mimeType: image.mimeType },
      });

      if (fnError) throw fnError;

      const payload = extractionResponseSchema.safeParse(data);
      if (!payload.success) {
        setError('We could not read that schedule. Enter your classes manually.');
        setStage({ name: 'reviewing', classes: [], warnings: [] });
        return;
      }

      setStage({
        name: 'reviewing',
        classes: payload.data.classes,
        warnings: payload.data.classes.length === 0
          ? ['No classes found in that image.', ...payload.data.warnings]
          : payload.data.warnings,
      });
    } catch (caught) {
      setError(MESSAGES[await errorCodeOf(caught)] ?? 'Something went wrong reading that image. Enter your classes manually.');
      setStage({ name: 'reviewing', classes: [], warnings: [] });
    }
  }

  async function handleSave(classes: ExtractedClass[]) {
    setSaving(true);
    try {
      await saveSchedule(session!.user.id, classes);
      navigate('/', { replace: true });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save your schedule.');
    } finally {
      setSaving(false);
    }
  }

  if (stage.name === 'extracting') return <Spinner label="Reading your schedule…" />;

  return (
    <main className="p-4">
      <h1 className="text-2xl font-bold">Add your schedule</h1>

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
            initial={stage.classes}
            warnings={stage.warnings}
            saving={saving}
            onSave={handleSave}
          />
        </div>
      )}
    </main>
  );
}
