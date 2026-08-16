// src/features/schedule/ScheduleGrid.tsx
import { useState } from 'react';
import { computeAxis, computeLayout, axisHours } from '@/domain/layout';
import { formatHourLabel } from '@/domain/time';
import { WEEKDAYS, WEEKDAY_LABELS } from '@/domain/constants';
import type { ClassMeeting } from '@/domain/types';
import DaySelector from './DaySelector';
import ClassBlock from './ClassBlock';

const HOUR_HEIGHT_PX = 64;

function todayWeekday(): number {
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
        <div className="w-12 shrink-0" style={{ height: gridHeight }}>
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

        {/* Mobile: one day */}
        <div className="relative flex-1 lg:hidden" style={{ height: gridHeight }}>
          {hours.map((minute) => (
            <div key={minute} className="border-t border-slate-200" style={{ height: HOUR_HEIGHT_PX }} />
          ))}
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
                {hours.map((minute) => (
                  <div key={minute} className="border-t border-slate-200" style={{ height: HOUR_HEIGHT_PX }} />
                ))}
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
