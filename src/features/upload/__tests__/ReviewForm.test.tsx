// @vitest-environment jsdom
// src/features/upload/__tests__/ReviewForm.test.tsx
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import ReviewForm from '../ReviewForm';
import type { ExtractedClass } from '@/domain/types';

afterEach(cleanup);

function draft(over: Partial<ExtractedClass> = {}): ExtractedClass {
  return {
    name: 'BIO 101',
    instructor: null,
    room: null,
    courseCode: null,
    section: null,
    days: [1, 3],
    startMinute: 600,
    endMinute: 650,
    ...over,
  };
}

describe('ReviewForm', () => {
  it('renders one card per class in `value`', () => {
    render(
      <ReviewForm
        value={[draft(), draft({ name: 'MATH 220' })]}
        onChange={vi.fn()}
        warnings={[]}
        saving={false}
        onSave={vi.fn()}
      />
    );
    expect((screen.getByDisplayValue('BIO 101') as HTMLInputElement).value).toBe('BIO 101');
    expect((screen.getByDisplayValue('MATH 220') as HTMLInputElement).value).toBe('MATH 220');
  });

  it('reports an edited name through onChange instead of holding it internally', () => {
    const onChange = vi.fn();
    render(
      <ReviewForm value={[draft()]} onChange={onChange} warnings={[]} saving={false} onSave={vi.fn()} />
    );

    fireEvent.change(screen.getByDisplayValue('BIO 101'), { target: { value: 'BIO 102' } });

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0][0].name).toBe('BIO 102');
  });

  it('reports an added class through onChange', () => {
    const onChange = vi.fn();
    render(
      <ReviewForm value={[draft()]} onChange={onChange} warnings={[]} saving={false} onSave={vi.fn()} />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Add a class' }));

    expect(onChange.mock.calls[0][0]).toHaveLength(2);
  });

  it('reports a removed class through onChange', () => {
    const onChange = vi.fn();
    render(
      <ReviewForm value={[draft()]} onChange={onChange} warnings={[]} saving={false} onSave={vi.fn()} />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Remove class' }));

    expect(onChange.mock.calls[0][0]).toHaveLength(0);
  });

  it('passes the current value to onSave', () => {
    const onSave = vi.fn();
    const value = [draft()];
    render(
      <ReviewForm value={value} onChange={vi.fn()} warnings={[]} saving={false} onSave={onSave} />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Save schedule' }));

    expect(onSave).toHaveBeenCalledWith(value);
  });

  it('disables save when a class has no day selected', () => {
    render(
      <ReviewForm value={[draft({ days: [] })]} onChange={vi.fn()} warnings={[]} saving={false} onSave={vi.fn()} />
    );
    expect((screen.getByRole('button', { name: 'Save schedule' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('disables save when the list is empty', () => {
    render(<ReviewForm value={[]} onChange={vi.fn()} warnings={[]} saving={false} onSave={vi.fn()} />);
    expect((screen.getByRole('button', { name: 'Save schedule' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('uses a custom save label when given one', () => {
    render(
      <ReviewForm
        value={[draft()]}
        onChange={vi.fn()}
        warnings={[]}
        saving={false}
        onSave={vi.fn()}
        saveLabel="Save changes"
      />
    );
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDefined();
  });
});
