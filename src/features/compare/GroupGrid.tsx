// src/features/compare/GroupGrid.tsx
import { useMemo, useState } from 'react';
import { computeAxis, computeLayout, axisHours, type PositionedBlock } from '@/domain/layout';
import { formatHourLabel, formatMinutes } from '@/domain/time';
import { CLASS_COLORS } from '@/domain/color';
import { HOUR_HEIGHT_PX, HourLabels, HourRules } from '@/components/HourGrid';
import DaySelector from '@/features/schedule/DaySelector';
import type { GroupSharedClass } from '@/domain/compare';
import type { ClassMeeting, Interval } from '@/domain/types';
import type { GroupPerson } from './GroupSummary';

interface Props {
  people: GroupPerson[];
  classesByPerson: Record<string, ClassMeeting[]>;
  shared: GroupSharedClass[];
  days: number[];
  freeByDay: Record<number, Interval[]>;
  selectedDay: number;
  onSelectDay: (day: number) => void;
}

interface Selection {
  personId: string;
  meeting: ClassMeeting;
}

/**
 * Splits lane indices into runs of adjacent lanes: [0,1,3] -> [[0,1],[3,3]].
 *
 * This is what lets a shared class span its members' lanes at any group size
 * without lying. Three of five people sharing a class is common, and if those
 * three sit in lanes 0, 1 and 3 then one wide block from 0 to 3 would paint
 * over lane 2 — announcing that a fourth person is in a class they are not in.
 * Two blocks say the same true thing and cover nobody else.
 */
function contiguousRuns(indices: number[]): Array<[number, number]> {
  const runs: Array<[number, number]> = [];
  for (const index of [...indices].sort((a, b) => a - b)) {
    const last = runs[runs.length - 1];
    if (last && index === last[1] + 1) last[1] = index;
    else runs.push([index, index]);
  }
  return runs;
}

export default function GroupGrid({
  people, classesByPerson, shared, days, freeByDay, selectedDay, onSelectDay,
}: Props) {
  const [selection, setSelection] = useState<Selection | null>(null);

  const allClasses = useMemo(
    () => people.flatMap((p) => classesByPerson[p.id] ?? []),
    [people, classesByPerson]
  );

  const axis = computeAxis(allClasses);
  const hours = axisHours(axis);
  const span = axis.endMinute - axis.startMinute;
  const gridHeight = (span / 60) * HOUR_HEIGHT_PX;

  const laneWidth = 100 / people.length;

  const sharersOf = (meetingId: string): string[] => {
    const entry = shared.find((s) => s.day === selectedDay && s.meetingIds.includes(meetingId));
    return entry ? entry.memberIds : [];
  };

  // At four lanes and up there is no room for a second line of text inside a
  // block; the name alone has to carry it, and the tap-for-detail panel below
  // the grid covers the rest.
  const dense = people.length >= 4;

  /**
   * Every shared class on this day, drawn once as a span across its members'
   * lanes rather than as a separate block in each — the treatment the 1:1 view
   * gives shared classes, generalised to any group size.
   *
   * A class everyone has spans the full width. A class some of them have spans
   * just their lanes, split into contiguous runs so nobody outside it is
   * covered.
   */
  const daySpans = useMemo(() => {
    const laneOf = new Map(people.map((p, index) => [p.id, index]));
    return shared
      .filter((s) => s.day === selectedDay)
      .map((entry) => ({
        entry,
        runs: contiguousRuns(
          entry.memberIds.map((id) => laneOf.get(id)).filter((i): i is number => i !== undefined)
        ),
      }));
  }, [shared, selectedDay, people]);

  const meetingsById = useMemo(() => {
    const map = new Map<string, ClassMeeting>();
    for (const list of Object.values(classesByPerson)) {
      for (const meeting of list) map.set(meeting.id, meeting);
    }
    return map;
  }, [classesByPerson]);

  // Their per-lane copies are suppressed so the full-width block is not drawn
  // on top of them.
  const spannedMeetingIds = useMemo(
    () => new Set(daySpans.flatMap(({ entry }) => entry.meetingIds)),
    [daySpans]
  );

  function renderBlock(block: PositionedBlock, person: GroupPerson, laneIndex: number) {
    const styles = CLASS_COLORS[block.meeting.color] ?? CLASS_COLORS.indigo;
    const widthPct = laneWidth / block.laneCount;
    const leftPct = laneIndex * laneWidth + block.lane * widthPct;
    // Never a shared class: those are drawn as spans below and removed from
    // this list, so anything reaching here belongs to one person only.
    const isSelected = selection?.meeting.id === block.meeting.id;

    return (
      <button
        key={`${person.id}-${block.meeting.id}`}
        type="button"
        onClick={() => setSelection(isSelected ? null : { personId: person.id, meeting: block.meeting })}
        aria-label={`${person.label}: ${block.meeting.name}, ${formatMinutes(block.meeting.startMinute)} to ${formatMinutes(block.meeting.endMinute)}`}
        className={`absolute overflow-hidden rounded-md border px-1 py-0.5 text-left ${styles.block} ${styles.text} ${
          isSelected ? 'ring-2 ring-inset ring-slate-900' : ''
        }`}
        style={{
          top: `${block.topPct}%`,
          height: `${block.heightPct}%`,
          left: `${leftPct}%`,
          width: `${widthPct}%`,
        }}
      >
        <span className={`block truncate font-semibold leading-tight ${dense ? 'text-[9px]' : 'text-[11px]'}`}>
          {block.meeting.name}
        </span>
        {!dense && (
          <span className="block truncate text-[10px] opacity-80">
            {formatMinutes(block.meeting.startMinute)}
          </span>
        )}
      </button>
    );
  }

  return (
    <>
      <DaySelector days={days} selected={selectedDay} onSelect={onSelectDay} />

      {/* Lane headers. The w-12 spacer matches HourLabels so each name sits
          over its own column. */}
      <div className="flex px-4">
        <div className="w-12 shrink-0" />
        <div className="flex flex-1">
          {people.map((person) => (
            <div key={person.id} className="min-w-0 px-0.5" style={{ width: `${laneWidth}%` }}>
              <p className="truncate text-center text-[10px] font-semibold text-slate-500">
                {person.label}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="flex px-4 pb-2">
        <HourLabels hours={hours} gridHeight={gridHeight} formatLabel={formatHourLabel} />

        <div className="relative flex-1" style={{ height: gridHeight }}>
          <HourRules hours={hours} />

          {(freeByDay[selectedDay] ?? []).map((window) => (
            <div
              key={`${window.start}-${window.end}`}
              className="absolute inset-x-0 bg-emerald-100/70"
              style={{
                top: `${((window.start - axis.startMinute) / span) * 100}%`,
                height: `${((window.end - window.start) / span) * 100}%`,
              }}
            >
              <span className="absolute right-1 top-1 text-[10px] font-medium text-emerald-800">
                All free
              </span>
            </div>
          ))}

          {/* Lane dividers, so an empty column still reads as somebody's. */}
          {people.slice(1).map((person, i) => (
            <div
              key={`divider-${person.id}`}
              className="absolute inset-y-0 border-l border-dashed border-slate-200"
              style={{ left: `${(i + 1) * laneWidth}%` }}
            />
          ))}

          <div className="absolute inset-0">
            {people.map((person, laneIndex) =>
              computeLayout(
                (classesByPerson[person.id] ?? []).filter((c) => !spannedMeetingIds.has(c.id)),
                [selectedDay],
                axis
              ).map((block) => renderBlock(block, person, laneIndex))
            )}

            {daySpans.flatMap(({ entry, runs }) => {
              const anchor = meetingsById.get(entry.meetingIds[0]);
              if (!anchor) return [];
              const styles = CLASS_COLORS[anchor.color] ?? CLASS_COLORS.indigo;
              const isSelected = selection?.meeting.id === anchor.id;
              const everyone = entry.memberIds.length === people.length;

              return runs.map(([from, to]) => (
                <button
                  key={`shared-${entry.name}-${entry.classStartMinute}-${from}`}
                  type="button"
                  onClick={() =>
                    setSelection(isSelected ? null : { personId: entry.memberIds[0], meeting: anchor })
                  }
                  aria-label={`${entry.name}, shared, ${formatMinutes(entry.classStartMinute)} to ${formatMinutes(entry.classEndMinute)}`}
                  className={`absolute overflow-hidden rounded-md border px-1 py-0.5 text-left ring-2 ring-inset ${styles.block} ${styles.text} ${
                    isSelected ? 'ring-slate-900' : 'ring-slate-900/40'
                  }`}
                  style={{
                    // classStartMinute, not startMinute — the latter is the
                    // window the members overlap, which sits later than the
                    // class whenever somebody's copy was read wrong.
                    top: `${((entry.classStartMinute - axis.startMinute) / span) * 100}%`,
                    height: `${((entry.classEndMinute - entry.classStartMinute) / span) * 100}%`,
                    left: `${from * laneWidth}%`,
                    width: `${(to - from + 1) * laneWidth}%`,
                  }}
                >
                  <span
                    className={`block truncate font-semibold leading-tight ${dense ? 'text-[9px]' : 'text-[11px]'}`}
                  >
                    {entry.name}
                    {everyone ? ' · shared' : ''}
                  </span>
                  {!dense && (
                    <span className="block truncate text-[10px] opacity-80">
                      {formatMinutes(entry.classStartMinute)}
                    </span>
                  )}
                </button>
              ));
            })}
          </div>
        </div>
      </div>

      <div className="px-4 pb-6">
        {selection ? (
          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <p className="font-semibold">{selection.meeting.name}</p>
            <p className="text-sm text-slate-600">
              {formatMinutes(selection.meeting.startMinute)}–{formatMinutes(selection.meeting.endMinute)}
              {selection.meeting.room && ` · ${selection.meeting.room}`}
              {selection.meeting.instructor && ` · ${selection.meeting.instructor}`}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              {(() => {
                const ids = sharersOf(selection.meeting.id);
                if (ids.length === 0) {
                  const person = people.find((p) => p.id === selection.personId);
                  return `Only ${person ? person.label.toLowerCase() : 'one person'}`;
                }
                const byId = new Map(people.map((p) => [p.id, p.label]));
                return `Together: ${ids.map((id) => byId.get(id) ?? id).join(', ')}`;
              })()}
            </p>
          </div>
        ) : (
          <p className="text-xs text-slate-500">
            Tap a block for details. A dark outline means more than one of you is in it.
          </p>
        )}
      </div>
    </>
  );
}
