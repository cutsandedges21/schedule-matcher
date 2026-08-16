// src/features/upload/ImagePicker.tsx
import { useRef } from 'react';
import Button from '@/components/Button';

export default function ImagePicker({ onPick }: { onPick: (file: File) => void }) {
  const libraryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) onPick(file);
    event.target.value = '';
  }

  return (
    <div className="flex flex-col gap-3">
      <input ref={libraryRef} type="file" accept="image/*" onChange={handleChange} className="hidden" />
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" onChange={handleChange} className="hidden" />

      <Button onClick={() => libraryRef.current?.click()} className="w-full">
        Choose a screenshot
      </Button>
      <Button variant="secondary" onClick={() => cameraRef.current?.click()} className="w-full">
        Take a photo
      </Button>
    </div>
  );
}
