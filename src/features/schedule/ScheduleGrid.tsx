// src/features/schedule/ScheduleGrid.tsx
import { useState } from 'react';
import { computeAxis, computeLayout, axisHours } from '@/domain/layout';
import { formatHourLabel } from '@/domain/time';
import { WEEKDAYS, WEEKDAY_LABELS } from '@/domain/constants';
import { HOUR_HEIGHT_PX, HourLabels, HourRules } from '@/components/HourGrid';
import type { ClassMeeting } from '@/domain/types';
import DaySelector from './DaySelector';
import ClassBlock from './ClassBlock';

export function todayWeekday(): number {
  const iso = new Date().getDay();
  return iso === 0 ? 7 : iso;
}

export default function ScheduleGrid({ classes }: { classes: ClassMeeting[] }) {
  const weekendDays = [6, 7].filter((d) => classes.some((c) => c.days.includes(d)));
  const days = [...WEEKDAYS, ...weekendDays];

  const initial = days.includes(todayWeekday()) ? todayWeekday() : days[0];
  const [selectedDay, setSelectedDay] = useState(initial);

  const axis = computeAxis(classes);
  const hours = axisHours(axis);
  const gridHeight = ((axis.endMinute - axis.startMinute) / 60) * HOUR_HEIGHT_PX;

  const mobileBlocks = computeLayout(classes, [selectedDay], axis);
  const desktopBlocks = computeLayout(classes, days, axis);

  return (
    <>
      <DaySelector days={days} selected={selectedDay} onSelect={setSelectedDay} />

      <div className="flex px-4 pb-6">
        <HourLabels hours={hours} gridHeight={gridHeight} formatLabel={formatHourLabel} />

        {/* Mobile: one day */}
        <div className="relative flex-1 lg:hidden" style={{ height: gridHeight }}>
          <HourRules hours={hours} />
          <div className="absolute inset-0">
            {mobileBlocks.map((block) => (
              <ClassBlock key={`${block.meeting.id}-${block.day}`} block={block} />
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
