// src/components/Field.tsx
import { useId, type ComponentProps, type ReactNode } from 'react';
import { twMerge } from 'tailwind-merge';

/**
 * The input look FriendSearch and Settings already use, in one place. 16px
 * text comes from index.css (iOS zooms the page on focus below that), and the
 * 44px floor from min-h-touch.
 */
export const inputClassName =
  'min-h-touch w-full rounded-xl border border-slate-300 bg-white px-3 text-slate-900 disabled:opacity-60 aria-[invalid=true]:border-rose-400';

interface FieldChrome {
  label: string;
  hint?: ReactNode;
  error?: string | null;
  /** Hide the label visually but keep it for screen readers. */
  hideLabel?: boolean;
}

function useFieldIds(error?: string | null, hint?: ReactNode) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;
  return { id, hintId, errorId, describedBy };
}

function Chrome({
  id,
  label,
  hint,
  hintId,
  error,
  errorId,
  hideLabel,
  children,
}: FieldChrome & { id: string; hintId?: string; errorId?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className={hideLabel ? 'sr-only' : 'text-sm font-medium text-slate-700'}>
        {label}
      </label>
      {children}
      {hint && (
        <p id={hintId} className="text-xs text-slate-500">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-sm text-rose-600">
          {error}
        </p>
      )}
    </div>
  );
}

export function TextField({
  label,
  hint,
  error,
  hideLabel,
  className,
  ...input
}: FieldChrome & ComponentProps<'input'>) {
  const ids = useFieldIds(error, hint);
  return (
    <Chrome {...ids} label={label} hint={hint} error={error} hideLabel={hideLabel}>
      <input
        id={ids.id}
        aria-describedby={ids.describedBy}
        aria-invalid={error ? true : undefined}
        className={twMerge(inputClassName, className)}
        {...input}
      />
    </Chrome>
  );
}

export function TextAreaField({
  label,
  hint,
  error,
  hideLabel,
  className,
  ...textarea
}: FieldChrome & ComponentProps<'textarea'>) {
  const ids = useFieldIds(error, hint);
  return (
    <Chrome {...ids} label={label} hint={hint} error={error} hideLabel={hideLabel}>
      <textarea
        id={ids.id}
        aria-describedby={ids.describedBy}
        aria-invalid={error ? true : undefined}
        rows={3}
        className={twMerge(inputClassName, 'py-2', className)}
        {...textarea}
      />
    </Chrome>
  );
}

export function SelectField({
  label,
  hint,
  error,
  hideLabel,
  className,
  options,
  ...select
}: FieldChrome &
  ComponentProps<'select'> & { options: readonly { value: string; label: string }[] }) {
  const ids = useFieldIds(error, hint);
  return (
    <Chrome {...ids} label={label} hint={hint} error={error} hideLabel={hideLabel}>
      <select
        id={ids.id}
        aria-describedby={ids.describedBy}
        aria-invalid={error ? true : undefined}
        className={twMerge(inputClassName, className)}
        {...select}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </Chrome>
  );
}

export function CheckboxField({
  label,
  description,
  className,
  ...input
}: { label: string; description?: string } & Omit<ComponentProps<'input'>, 'type'>) {
  const id = useId();
  return (
    <label htmlFor={id} className={twMerge('flex min-h-touch items-start gap-3 py-2', className)}>
      <input id={id} type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 accent-slate-900" {...input} />
      <span className="flex flex-col">
        <span className="text-sm font-medium text-slate-800">{label}</span>
        {description && <span className="text-xs text-slate-500">{description}</span>}
      </span>
    </label>
  );
}
