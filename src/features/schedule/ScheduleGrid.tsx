// src/features/schedule/ScheduleGrid.tsx
import { useRef, useState } from 'react';
import { computeAxis, computeLayout, axisHours } from '@/domain/layout';
import { formatHourLabel } from '@/domain/time';
import { WEEKDAYS, WEEKDAY_LABELS } from '@/domain/constants';
import { HOUR_HEIGHT_PX, HourLabels, HourRules } from '@/components/HourGrid';
import type { ClassMeeting } from '@/domain/types';
import { minuteFromOffset } from '@/domain/gridTime';
import DaySelector from './DaySelector';
import ViewToggle from './ViewToggle';
import ClassBlock from './ClassBlock';
import { useLongPress } from './useLongPress';
import { useScheduleView, type ScheduleView } from './useScheduleView';

/**
 * Week view buys back the page's own side padding on a phone, and the header
 * row and the grid have to agree on it or the day names stop sitting over their
 * columns. Sixteen pixels is a whole character of class name in a five-column
 * week on a 320px screen — the difference between "ENG 214" and "ENG 2…" — and
 * the grid draws its own edges, so it loses nothing by reaching further out.
 */
const WEEK_GUTTER = 'px-2 lg:px-4';

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
  /**
   * Edit mode: what the grid is showing changed — a different day picked, or
   * the day/week switch flipped — so an open sheet can close itself.
   */
  onDayChange?: (day: number) => void;
}

export default function ScheduleGrid({ classes, onSelectClass, onCreateAt, onDayChange }: Props) {
  const weekendDays = [6, 7].filter((d) => classes.some((c) => c.days.includes(d)));
  const days = [...WEEKDAYS, ...weekendDays];

  const initial = days.includes(todayWeekday()) ? todayWeekday() : days[0];
  const [selectedDay, setSelectedDay] = useState(initial);

  // Phones only. At `lg` the week always fits, so the desktop layout below
  // ignores this and renders every day regardless.
  const [view, setView] = useScheduleView();
  const weekView = view === 'week';

  const axis = computeAxis(classes);
  const hours = axisHours(axis);
  const gridHeight = ((axis.endMinute - axis.startMinute) / 60) * HOUR_HEIGHT_PX;

  const dayBlocks = computeLayout(classes, [selectedDay], axis);
  const weekBlocks = computeLayout(classes, days, axis);

  function selectDay(day: number) {
    setSelectedDay(day);
    onDayChange?.(day);
  }

  function selectView(next: ScheduleView) {
    if (next === view) return;
    setView(next);
    // Same reasoning as selectDay: switching to a single day can hide the class
    // an open sheet is editing, and editing something you cannot see is worse
    // than closing.
    onDayChange?.(selectedDay);
  }

  /**
   * Which column the live press started in.
   *
   * Week view has one column per day but they share a single long-press timer,
   * so the day has to travel with the press. Reading `selectedDay` when the
   * timer fires would file every week-view creation under whatever day the
   * chips were last left on.
   */
  const pressedDay = useRef(selectedDay);

  const longPress = useLongPress((offsetY) => {
    onCreateAt?.(pressedDay.current, minuteFromOffset(offsetY, axis));
  });

  /**
   * Blocks sit inside these columns, so a press on one bubbles up here. Without
   * the guard, long-pressing an existing class would create a second class on
   * top of it. A press landing on a class is that class's business —
   * ClassBlock's own onClick edits it. Only empty space creates.
   */
  function createHandlers(day: number) {
    if (!onCreateAt) return {};
    return {
      ...longPress,
      onPointerDown: (event: React.PointerEvent<HTMLElement>) => {
        if ((event.target as HTMLElement).closest('[data-class-block]')) return;
        pressedDay.current = day;
        longPress.onPointerDown(event);
      },
    };
  }

  return (
    <>
      <div className="flex justify-end px-4 pt-3 lg:hidden">
        <ViewToggle value={view} onChange={selectView} />
      </div>

      {/* Nothing to pick between when every day is already on screen. */}
      {!weekView && <DaySelector days={days} selected={selectedDay} onSelect={selectDay} />}

      {/* Weekday headers, in a row of their own with a `w-12` spacer matching
          HourLabels so each name sits over its own column — the alignment
          GroupGrid uses for its lane headers, and the reason these are not
          simply the first child of each column: a header inside the column
          pushes that column's hour rules down past the hour labels beside them.

          Sticky on a phone in week view, where the grid is tall enough to scroll
          the headers away and an unlabelled column of blocks says nothing.
          `lg:static` because DesktopNav is itself sticky at a higher z-index,
          and this would otherwise slide underneath it. */}
      <div
        className={
          weekView
            ? `sticky top-0 z-10 flex bg-slate-50/95 py-2 backdrop-blur lg:static ${WEEK_GUTTER}`
            : 'hidden px-4 pt-2 lg:flex'
        }
      >
        <div className="w-12 shrink-0" />
        <div className="flex flex-1">
          {days.map((day) => (
            <div key={day} className="min-w-0 flex-1">
              <p className="truncate text-center text-[11px] font-semibold text-slate-500 lg:text-xs">
                {WEEKDAY_LABELS[day]}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* pt-2 keeps the 8 AM label's own -translate-y-1/2 centring (HourGrid)
          from bleeding up into the sticky, z-10 box above it — with no gap,
          that half-line-height rise landed the label's top behind the sticky
          background and clipped it. */}
      <div className={`flex pb-6 pt-2 ${weekView ? WEEK_GUTTER : 'px-4'}`}>
        <HourLabels hours={hours} gridHeight={gridHeight} formatLabel={formatHourLabel} />

        {/* One day, phone only. */}
        {/* touch-pan-y keeps vertical scrolling native while the press is timed. */}
        {!weekView && (
          <div
            className="relative flex-1 touch-pan-y lg:hidden"
            style={{ height: gridHeight }}
            {...createHandlers(selectedDay)}
          >
            <HourRules hours={hours} />
            <div className="absolute inset-0">
              {dayBlocks.map((block) => (
                <ClassBlock
                  key={`${block.meeting.id}-${block.day}`}
                  block={block}
                  onSelect={onSelectClass ? () => onSelectClass(block.meeting) : undefined}
                />
              ))}
            </div>
          </div>
        )}

        {/* The full week: always on at `lg`, and on a phone only when asked for.
            The two panes are mutually exclusive on a phone — rendering both and
            hiding one in CSS would put a second, invisible copy of every block
            in the accessibility tree, and two buttons per class in edit mode. */}
        <div className={`flex-1 ${weekView ? 'flex' : 'hidden lg:flex'}`}>
          {days.map((day) => (
            <div
              key={day}
              className="relative min-w-0 flex-1 touch-pan-y border-l border-slate-200"
              style={{ height: gridHeight }}
              {...(weekView ? createHandlers(day) : {})}
            >
              <HourRules hours={hours} />
              <div className="absolute inset-0">
                {weekBlocks
                  .filter((b) => b.day === day)
                  .map((block) => (
                    <ClassBlock
                      key={`${block.meeting.id}-${block.day}`}
                      block={block}
                      variant="week"
                      // Only interactive when this pane is the one the student
                      // is actually looking at. On a desktop the editor is
                      // EditPanel beside the grid, and the grid stays a preview.
                      onSelect={
                        weekView && onSelectClass ? () => onSelectClass(block.meeting) : undefined
                      }
                    />
                  ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
