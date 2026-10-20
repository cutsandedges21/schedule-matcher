// src/features/availability/AvailabilityHeatmap.tsx
import { useState } from 'react';
import type { GridCell, GridDay } from '@/domain/availability';
import { formatDateKey, formatTimeIn, parseDateKey, type DateKey } from '@/domain/zonedTime';
import { formatHourLabel } from '@/domain/time';
import Button from '@/components/Button';

const DAYS_PER_PAGE = 7;

/**
 * Literal classes per bucket, never interpolated (the JIT scanner rule in
 * domain/color.ts). Colour is not the only signal: a cell where everyone is
 * free also carries a check mark, and every cell has a spoken label.
 */
function cellClass(cell: GridCell, total: number, past: boolean): string {
  if (past) return 'bg-slate-50';
  const ratio = total === 0 ? 0 : cell.available.length / total;
  if (ratio === 1) return 'bg-emerald-500 text-white';
  if (ratio >= 0.75) return 'bg-emerald-300';
  if (ratio >= 0.5) return 'bg-emerald-200';
  if (ratio > 0) return 'bg-emerald-100';
  return 'bg-slate-200';
}

export default function AvailabilityHeatmap({
  grid,
  countedTotal,
  labelOf,
  timeZone,
  nowMs,
}: {
  grid: readonly GridDay[];
  countedTotal: number;
  labelOf: (id: string) => string;
  timeZone: string;
  nowMs: number;
}) {
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<{ date: DateKey; cell: GridCell } | null>(null);
  const pages = Math.max(1, Math.ceil(grid.length / DAYS_PER_PAGE));
  const days = grid.slice(page * DAYS_PER_PAGE, (page + 1) * DAYS_PER_PAGE);
  const rows = days[0]?.cells.length ?? 0;

  if (rows === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      {pages > 1 && (
        <div className="flex items-center justify-between">
          <Button size="sm" variant="secondary" disabled={page === 0} onClick={() => setPage(page - 1)} aria-label="Earlier days">
            ←
          </Button>
          <span className="text-xs text-slate-500">
            Days {page * DAYS_PER_PAGE + 1}–{Math.min(grid.length, (page + 1) * DAYS_PER_PAGE)} of {grid.length}
          </span>
          <Button size="sm" variant="secondary" disabled={page >= pages - 1} onClick={() => setPage(page + 1)} aria-label="Later days">
            →
          </Button>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full table-fixed border-separate border-spacing-0.5 text-[10px]">
          <thead>
            <tr>
              <th className="w-10" />
              {days.map((day) => (
                <th key={day.date} scope="col" className="font-semibold text-slate-500">
                  <span className="block">{formatDateKey(day.date, 'weekday')}</span>
                  <span className="block text-slate-400">{parseDateKey(day.date).day}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }, (_, row) => {
              const minute = days[0].cells[row].startMinute;
              return (
                <tr key={minute}>
                  <th scope="row" className="pr-1 text-right align-top font-normal text-slate-400">
                    {minute % 60 === 0 ? formatHourLabel(minute) : ''}
                  </th>
                  {days.map((day) => {
                    const cell = day.cells[row];
                    if (!cell) return <td key={day.date} />;
                    const past = cell.start < nowMs;
                    const everyone = countedTotal > 0 && cell.available.length === countedTotal;
                    const isSelected = selected?.cell.start === cell.start;
                    return (
                      <td key={day.date} className="p-0">
                        <button
                          type="button"
                          onClick={() => setSelected(isSelected ? null : { date: day.date, cell })}
                          aria-label={`${formatDateKey(day.date)}, ${formatTimeIn(cell.start, timeZone)}: ${
                            past ? 'already passed' : `${cell.available.length} of ${countedTotal} free`
                          }`}
                          className={`flex h-[18px] w-full items-center justify-center rounded-sm ${cellClass(cell, countedTotal, past)} ${
                            isSelected ? 'ring-2 ring-slate-900' : ''
                          }`}
                        >
                          {everyone && !past ? '✓' : ''}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-600" aria-hidden>
        <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-sm bg-emerald-500" /> Everyone ✓</span>
        <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-sm bg-emerald-200" /> Some</span>
        <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-sm bg-slate-200" /> Nobody</span>
      </div>

      {selected ? (
        <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm" aria-live="polite">
          <p className="font-semibold">
            {formatDateKey(selected.date)} · {formatTimeIn(selected.cell.start, timeZone)}
          </p>
          <p className="text-emerald-800">
            Free: {selected.cell.available.length ? selected.cell.available.map(labelOf).join(', ') : 'nobody'}
          </p>
          <p className="text-slate-600">
            Busy: {selected.cell.busy.length ? selected.cell.busy.map(labelOf).join(', ') : 'nobody'}
          </p>
        </div>
      ) : (
        <p className="text-xs text-slate-500">Tap a square to see who is free then.</p>
      )}
    </div>
  );
}
