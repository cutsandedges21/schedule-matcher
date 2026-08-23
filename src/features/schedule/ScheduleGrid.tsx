// src/features/schedule/ScheduleGrid.tsx
import { useState } from 'react';
import { computeAxis, computeLayout, axisHours } from '@/domain/layout';
import { formatHourLabel } from '@/domain/time';
import { WEEKDAYS, WEEKDAY_LABELS } from '@/domain/constants';
import { HOUR_HEIGHT_PX, HourLabels, HourRules } from '@/components/HourGrid';
import type { ClassMeeting } from '@/domain/types';
import { minuteFromOffset } from '@/domain/gridTime';
import DaySelector from './DaySelector';
import ClassBlock from './ClassBlock';
import { useLongPress } from './useLongPress';

export function todayWeekday(): number {
  const iso = new Date().getDay();
  return iso === 0 ? 7 : iso;
}

interface Props {
  classes: ClassMeeting[];
  /** Edit mode: a block was tapped. */
  onSelectClass?: (meeting: ClassMeeting) => void;
  /** Edit mode: empty space was long-pressed, on this day at this minute. */
  onCreateAt?: (day: number, startMinute: number) => void;
  /** Edit mode: the visible day changed, so an open sheet can close itself. */
  onDayChange?: (day: number) => void;
}

export default function ScheduleGrid({ classes, onSelectClass, onCreateAt, onDayChange }: Props) {
  const weekendDays = [6, 7].filter((d) => classes.some((c) => c.days.includes(d)));
  const days = [...WEEKDAYS, ...weekendDays];

  const initial = days.includes(todayWeekday()) ? todayWeekday() : days[0];
  const [selectedDay, setSelectedDay] = useState(initial);

  const axis = computeAxis(classes);
  const hours = axisHours(axis);
  const gridHeight = ((axis.endMinute - axis.startMinute) / 60) * HOUR_HEIGHT_PX;

  const mobileBlocks = computeLayout(classes, [selectedDay], axis);
  const desktopBlocks = computeLayout(classes, days, axis);

  function selectDay(day: number) {
    setSelectedDay(day);
    onDayChange?.(day);
  }

  const longPress = useLongPress((offsetY) => {
    onCreateAt?.(selectedDay, minuteFromOffset(offsetY, axis));
  });

  /**
   * Blocks sit inside this column, so a press on one bubbles up here. Without
   * this guard, long-pressing an existing class would create a second class on
   * top of it. A press landing on a class is that class's business —
   * ClassBlock's own onClick edits it. Only empty space creates.
   */
  const createHandlers = onCreateAt
    ? {
        ...longPress,
        onPointerDown: (event: React.PointerEvent<HTMLElement>) => {
          if ((event.target as HTMLElement).closest('[data-class-block]')) return;
          longPress.onPointerDown(event);
        },
      }
    : {};

  return (
    <>
      <DaySelector days={days} selected={selectedDay} onSelect={selectDay} />

      {/* pt-2 keeps the 8 AM label's own -translate-y-1/2 centring (HourGrid)
          from bleeding up into DaySelector's sticky, z-10 box above it — with
          no gap, that half-line-height rise landed the label's top behind the
          selector's background and clipped it. */}
      <div className="flex px-4 pb-6 pt-2">
        <HourLabels hours={hours} gridHeight={gridHeight} formatLabel={formatHourLabel} />

        {/* Mobile: one day */}
        {/* touch-pan-y keeps vertical scrolling native while the press is timed. */}
        <div
          className="relative flex-1 touch-pan-y lg:hidden"
          style={{ height: gridHeight }}
          {...createHandlers}
        >
          <HourRules hours={hours} />
          <div className="absolute inset-0">
            {mobileBlocks.map((block) => (
              <ClassBlock
                key={`${block.meeting.id}-${block.day}`}
                block={block}
                onSelect={onSelectClass ? () => onSelectClass(block.meeting) : undefined}
              />
            ))}
          </div>
        </div>

        {/* Desktop: full week */}
        <div className="hidden flex-1 lg:flex">
          {days.map((day) => (
            <div key={day} className="flex-1 border-l border-slate-200">
              <p className="py-1 text-center text-xs font-semibold text-slate-500">
                {WEEKDAY_LABELS[day]}
              </p>
              <div className="relative" style={{ height: gridHeight }}>
                <HourRules hours={hours} />
                <div className="absolute inset-0">
                  {desktopBlocks
                    .filter((b) => b.day === day)
                    .map((block) => (
                      <ClassBlock key={`${block.meeting.id}-${block.day}`} block={block} />
                    ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
