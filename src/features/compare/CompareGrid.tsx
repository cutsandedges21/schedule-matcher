// src/features/compare/CompareGrid.tsx
import { useState } from 'react';
import { computeAxis, computeLayout, axisHours, type PositionedBlock } from '@/domain/layout';
import { findSharedClasses } from '@/domain/compare';
import { normalizeClassName } from '@/domain/text';
import { formatHourLabel, formatMinutes } from '@/domain/time';
import { CLASS_COLORS } from '@/domain/color';
import { HOUR_HEIGHT_PX, HourLabels, HourRules } from '@/components/HourGrid';
import { todayWeekday } from '@/features/schedule/ScheduleGrid';
import type { ClassMeeting, Interval } from '@/domain/types';
import DaySelector from '@/features/schedule/DaySelector';

interface Props {
  mine: ClassMeeting[];
  theirs: ClassMeeting[];
  days: number[];
  freeByDay: Record<number, Interval[]>;
  theirUsername: string;
}

function dayKey(name: string, day: number): string {
  return `${normalizeClassName(name)}|${day}`;
}

/** One positioned block, scaled into `widthBase`% of the track starting at
 * `leftBase`%, subdivided by its own lane if it overlaps siblings in the
 * same group (mine / theirs / shared each get independent lane numbering). */
function renderBlock(block: PositionedBlock, keyPrefix: string, leftBase: number, widthBase: number, suffix?: string) {
  const styles = CLASS_COLORS[block.meeting.color] ?? CLASS_COLORS.indigo;
  const widthPct = widthBase / block.laneCount;
  const leftPct = leftBase + block.lane * widthPct;

  return (
    <div
      key={`${keyPrefix}-${block.meeting.id}`}
      className={`absolute overflow-hidden rounded-lg border px-1.5 py-1 ${styles.block} ${styles.text}`}
      style={{
        top: `${block.topPct}%`,
        height: `${block.heightPct}%`,
        left: `${leftPct}%`,
        width: `${widthPct}%`,
      }}
    >
      <p className="truncate text-[11px] font-semibold leading-tight">
        {suffix ? `${block.meeting.name} ${suffix}` : block.meeting.name}
      </p>
      <p className="truncate text-[10px] opacity-80">
        {formatMinutes(block.meeting.startMinute)}
      </p>
    </div>
  );
}

export default function CompareGrid({ mine, theirs, days, freeByDay, theirUsername }: Props) {
  const initial = days.includes(todayWeekday()) ? todayWeekday() : days[0];
  const [selectedDay, setSelectedDay] = useState(initial);

  const axis = computeAxis([...mine, ...theirs]);
  const hours = axisHours(axis);
  const span = axis.endMinute - axis.startMinute;
  const gridHeight = (span / 60) * HOUR_HEIGHT_PX;

  // Sharedness is determined per (class, day) using findSharedClasses, which
  // intersects days — not isSameClass alone, which is deliberately
  // day-agnostic (name + clock overlap only) and would call a Monday class
  // "shared" against an unrelated Tuesday class of the same name and time.
  const sharedKeys = new Set(
    findSharedClasses(mine, theirs).map((s) => dayKey(s.name, s.day))
  );
  const isShared = (meeting: ClassMeeting) => sharedKeys.has(dayKey(meeting.name, selectedDay));

  // Shared classes render once (from my copy) spanning the full width; each
  // side's private classes get their own lane numbering within their half so
  // overlapping classes (e.g. a lecture and a lab) don't paint over each other.
  const mySharedBlocks = computeLayout(mine.filter(isShared), [selectedDay], axis);
  const myPrivateBlocks = computeLayout(mine.filter((m) => !isShared(m)), [selectedDay], axis);
  const theirPrivateBlocks = computeLayout(theirs.filter((m) => !isShared(m)), [selectedDay], axis);

  return (
    <>
      <DaySelector days={days} selected={selectedDay} onSelect={setSelectedDay} />

      {/*
        Lane headers, and the reason the 08:00 label is no longer clipped.
        DaySelector above is `sticky top-0 z-10` over a near-opaque background,
        and the first hour label sits at `top: 0` with `-translate-y-1/2` — so
        half of it renders above the grid and used to slide underneath that bar.
        This row gives the overhang somewhere to land. The w-12 spacer matches
        HourLabels so each name sits over its own lane.
      */}
      <div className="flex px-4">
        <div className="w-12 shrink-0" />
        <div className="flex flex-1">
          <div className="min-w-0 px-0.5" style={{ width: '50%' }}>
            <p className="truncate text-center text-[10px] font-semibold text-slate-500">You</p>
          </div>
          <div className="min-w-0 px-0.5" style={{ width: '50%' }}>
            <p className="truncate text-center text-[10px] font-semibold text-slate-500">
              @{theirUsername}
            </p>
          </div>
        </div>
      </div>

      <div className="flex px-4 pb-6">
        <HourLabels hours={hours} gridHeight={gridHeight} formatLabel={formatHourLabel} />

        <div className="relative flex-1" style={{ height: gridHeight }}>
          <HourRules hours={hours} />

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
            {myPrivateBlocks.map((block) => renderBlock(block, 'mine', 0, 50))}
            {theirPrivateBlocks.map((block) => renderBlock(block, 'theirs', 50, 50))}
            {mySharedBlocks.map((block) => renderBlock(block, 'shared', 0, 100, '· shared'))}
          </div>
        </div>
      </div>

    </>
  );
}
