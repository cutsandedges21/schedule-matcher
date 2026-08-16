// src/features/compare/CompareGrid.tsx
import { useState } from 'react';
import { computeAxis, computeLayout, axisHours } from '@/domain/layout';
import { isSameClass } from '@/domain/compare';
import { formatHourLabel, formatMinutes } from '@/domain/time';
import { CLASS_COLORS } from '@/domain/color';
import type { ClassMeeting, Interval } from '@/domain/types';
import DaySelector from '@/features/schedule/DaySelector';

const HOUR_HEIGHT_PX = 64;

interface Props {
  mine: ClassMeeting[];
  theirs: ClassMeeting[];
  days: number[];
  freeByDay: Record<number, Interval[]>;
  theirUsername: string;
}

export default function CompareGrid({ mine, theirs, days, freeByDay, theirUsername }: Props) {
  const [selectedDay, setSelectedDay] = useState(days[0]);

  const axis = computeAxis([...mine, ...theirs]);
  const hours = axisHours(axis);
  const span = axis.endMinute - axis.startMinute;
  const gridHeight = (span / 60) * HOUR_HEIGHT_PX;

  // A shared class renders once, full width, from my side — so their copy is
  // filtered out rather than drawn underneath.
  const mySharedIds = new Set(
    mine.filter((a) => theirs.some((b) => isSameClass(a, b))).map((a) => a.id)
  );
  const theirSharedIds = new Set(
    theirs.filter((b) => mine.some((a) => isSameClass(a, b))).map((b) => b.id)
  );

  const mineBlocks = computeLayout(mine, [selectedDay], axis);
  const theirBlocks = computeLayout(theirs, [selectedDay], axis);

  return (
    <>
      <DaySelector days={days} selected={selectedDay} onSelect={setSelectedDay} />

      <div className="flex px-4 pb-6">
        <div className="w-12 shrink-0">
          {hours.map((minute, i) => (
            <div key={minute} className="relative" style={{ height: HOUR_HEIGHT_PX }}>
              {i < hours.length - 1 && (
                <span className="absolute -top-2 right-2 text-[10px] text-slate-400">
                  {formatHourLabel(minute)}
                </span>
              )}
            </div>
          ))}
        </div>

        <div className="relative flex-1" style={{ height: gridHeight }}>
          {hours.map((minute) => (
            <div key={minute} className="border-t border-slate-200" style={{ height: HOUR_HEIGHT_PX }} />
          ))}

          {(freeByDay[selectedDay] ?? []).map((window) => (
            <div
              key={`${window.start}-${window.end}`}
              className="absolute inset-x-0 bg-emerald-100/60"
              style={{
                top: `${((window.start - axis.startMinute) / span) * 100}%`,
                height: `${((window.end - window.start) / span) * 100}%`,
              }}
            >
              <span className="absolute right-1 top-1 text-[10px] font-medium text-emerald-800">
                Both free
              </span>
            </div>
          ))}

          <div className="absolute inset-0">
            {mineBlocks.map((block) => {
              const shared = mySharedIds.has(block.meeting.id);
              const styles = CLASS_COLORS[block.meeting.color] ?? CLASS_COLORS.indigo;
              return (
                <div
                  key={`mine-${block.meeting.id}`}
                  className={`absolute overflow-hidden rounded-lg border px-1.5 py-1 ${styles.block} ${styles.text}`}
                  style={{
                    top: `${block.topPct}%`,
                    height: `${block.heightPct}%`,
                    left: 0,
                    width: shared ? '100%' : '50%',
                  }}
                >
                  <p className="truncate text-[11px] font-semibold leading-tight">
                    {shared ? `${block.meeting.name} · shared` : block.meeting.name}
                  </p>
                  <p className="truncate text-[10px] opacity-80">
                    {formatMinutes(block.meeting.startMinute)}
                  </p>
                </div>
              );
            })}

            {theirBlocks
              .filter((block) => !theirSharedIds.has(block.meeting.id))
              .map((block) => {
                const styles = CLASS_COLORS[block.meeting.color] ?? CLASS_COLORS.indigo;
                return (
                  <div
                    key={`theirs-${block.meeting.id}`}
                    className={`absolute overflow-hidden rounded-lg border px-1.5 py-1 ${styles.block} ${styles.text}`}
                    style={{
                      top: `${block.topPct}%`,
                      height: `${block.heightPct}%`,
                      left: '50%',
                      width: '50%',
                    }}
                  >
                    <p className="truncate text-[11px] font-semibold leading-tight">{block.meeting.name}</p>
                    <p className="truncate text-[10px] opacity-80">
                      {formatMinutes(block.meeting.startMinute)}
                    </p>
                  </div>
                );
              })}
          </div>
        </div>
      </div>

      <p className="px-4 pb-4 text-xs text-slate-500">
        Left lane: you. Right lane: @{theirUsername}. Full width: shared.
      </p>
    </>
  );
}
