// src/components/HourGrid.tsx
//
// Shared rendering for the hour gutter/rules used by both ScheduleGrid and
// CompareGrid. `axisHours` is inclusive of both endpoints (11 marks for an
// 08:00-18:00 axis), while the grid itself only has 10 rows of height. These
// components position every mark absolutely, by pixel offset, inside a
// container sized to exactly `gridHeight` — so all the marks (including the
// last, legitimate boundary mark) render without adding a phantom extra row
// past the bottom of the grid.

export const HOUR_HEIGHT_PX = 64;

interface HourLabelsProps {
  hours: number[];
  gridHeight: number;
  formatLabel: (minute: number) => string;
}

export function HourLabels({ hours, gridHeight, formatLabel }: HourLabelsProps) {
  return (
    <div className="relative w-12 shrink-0" style={{ height: gridHeight }}>
      {hours.map((minute, i) => (
        <span
          key={minute}
          className="absolute right-2 -translate-y-1/2 text-[10px] text-slate-400"
          style={{ top: i * HOUR_HEIGHT_PX }}
        >
          {formatLabel(minute)}
        </span>
      ))}
    </div>
  );
}

export function HourRules({ hours }: { hours: number[] }) {
  return (
    <>
      {hours.map((minute, i) => (
        <div
          key={minute}
          className="absolute inset-x-0 border-t border-slate-200"
          style={{ top: i * HOUR_HEIGHT_PX }}
        />
      ))}
    </>
  );
}
