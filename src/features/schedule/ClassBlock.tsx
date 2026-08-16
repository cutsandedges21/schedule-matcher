// src/features/schedule/ClassBlock.tsx
import { CLASS_COLORS } from '@/domain/color';
import { formatMinutes } from '@/domain/time';
import type { PositionedBlock } from '@/domain/layout';

export default function ClassBlock({ block }: { block: PositionedBlock }) {
  const styles = CLASS_COLORS[block.meeting.color] ?? CLASS_COLORS.indigo;
  const widthPct = 100 / block.laneCount;

  return (
    <div
      className={`absolute overflow-hidden rounded-lg border px-2 py-1 ${styles.block} ${styles.text}`}
      style={{
        top: `${block.topPct}%`,
        height: `${block.heightPct}%`,
        left: `${block.lane * widthPct}%`,
        width: `${widthPct}%`,
      }}
    >
      <p className="truncate text-xs font-semibold leading-tight">{block.meeting.name}</p>
      <p className="truncate text-[10px] leading-tight opacity-80">
        {formatMinutes(block.meeting.startMinute)}
      </p>
      {block.meeting.room && (
        <p className="truncate text-[10px] leading-tight opacity-80">{block.meeting.room}</p>
      )}
    </div>
  );
}
