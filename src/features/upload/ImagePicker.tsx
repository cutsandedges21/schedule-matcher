// src/features/upload/ImagePicker.tsx
import { useRef } from 'react';
import Button from '@/components/Button';

// No camera capture here on purpose: schedules come from Omnivox digitally,
// so there is never a reason to photograph one — only to pick the screenshot
// the student already has.
export default function ImagePicker({ onPick }: { onPick: (file: File) => void }) {
  const libraryRef = useRef<HTMLInputElement>(null);

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) onPick(file);
    event.target.value = '';
  }

  return (
    <div className="flex flex-col gap-3">
      <input ref={libraryRef} type="file" accept="image/*" onChange={handleChange} className="hidden" />

      <Button onClick={() => libraryRef.current?.click()} className="w-full">
        Choose a screenshot
      </Button>
    </div>
  );
}
