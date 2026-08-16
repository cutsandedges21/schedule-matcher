// src/domain/layout.ts
import { DAY_START_MINUTE, DAY_END_MINUTE } from './constants';
import type { AxisRange, ClassMeeting } from './types';

export interface PositionedBlock {
  meeting: ClassMeeting;
  day: number;
  topPct: number;
  heightPct: number;
  lane: number;
  laneCount: number;
}

/**
 * The axis is fixed at 08:00–18:00 so every schedule renders at one scale.
 * A class outside that window extends the axis outward to the nearest hour
 * rather than being clipped — silently hiding a night class would be data
 * loss the student cannot see.
 */
export function computeAxis(classes: ClassMeeting[]): AxisRange {
  let startMinute = DAY_START_MINUTE;
  let endMinute = DAY_END_MINUTE;

  for (const c of classes) {
    if (c.startMinute < startMinute) startMinute = Math.floor(c.startMinute / 60) * 60;
    if (c.endMinute > endMinute) endMinute = Math.ceil(c.endMinute / 60) * 60;
  }

  return { startMinute, endMinute };
}

/** Greedy lane assignment within each cluster of transitively-overlapping blocks. */
function assignLanes(
  items: ClassMeeting[]
): Array<{ meeting: ClassMeeting; lane: number; laneCount: number }> {
  const sorted = [...items].sort(
    (a, b) => a.startMinute - b.startMinute || a.endMinute - b.endMinute
  );

  const out: Array<{ meeting: ClassMeeting; lane: number; laneCount: number }> = [];
  let cluster: Array<{ meeting: ClassMeeting; lane: number }> = [];
  let laneEnds: number[] = [];
  let clusterMaxEnd = -Infinity;

  const flush = () => {
    const laneCount = laneEnds.length;
    for (const entry of cluster) out.push({ ...entry, laneCount });
    cluster = [];
    laneEnds = [];
    clusterMaxEnd = -Infinity;
  };

  for (const meeting of sorted) {
    if (cluster.length > 0 && meeting.startMinute >= clusterMaxEnd) flush();

    let lane = laneEnds.findIndex((end) => end <= meeting.startMinute);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(meeting.endMinute);
    } else {
      laneEnds[lane] = meeting.endMinute;
    }

    cluster.push({ meeting, lane });
    clusterMaxEnd = Math.max(clusterMaxEnd, meeting.endMinute);
  }

  if (cluster.length > 0) flush();
  return out;
}

export function computeLayout(
  classes: ClassMeeting[],
  days: number[],
  axis: AxisRange
): PositionedBlock[] {
  const span = axis.endMinute - axis.startMinute;
  if (span <= 0) return [];

  const blocks: PositionedBlock[] = [];

  for (const day of days) {
    const onThisDay = classes.filter((c) => c.days.includes(day));
    for (const { meeting, lane, laneCount } of assignLanes(onThisDay)) {
      blocks.push({
        meeting,
        day,
        topPct: ((meeting.startMinute - axis.startMinute) / span) * 100,
        heightPct: ((meeting.endMinute - meeting.startMinute) / span) * 100,
        lane,
        laneCount,
      });
    }
  }

  return blocks;
}

/** Hour marks for the axis gutter, inclusive of both ends. */
export function axisHours(axis: AxisRange): number[] {
  const hours: number[] = [];
  for (let m = axis.startMinute; m <= axis.endMinute; m += 60) hours.push(m);
  return hours;
}
