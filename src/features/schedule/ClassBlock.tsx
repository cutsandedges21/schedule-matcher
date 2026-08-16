// src/features/schedule/ClassBlock.tsx
import { CLASS_COLORS } from '@/domain/color';
import { formatMinutes } from '@/domain/time';
import { HOUR_HEIGHT_PX } from '@/components/HourGrid';
import type { PositionedBlock } from '@/domain/layout';

// Approximate rendered line heights at leading-tight, used only to decide how
// many *optional* detail lines fit — name and time always render (matching
// prior behaviour); room/instructor are added progressively so a short block
// (a 50-minute class is ~53px tall) never has more text than it has room for.
const NAME_LINE_PX = 15; // text-xs leading-tight
const DETAIL_LINE_PX = 13; // text-[10px] leading-tight
const BLOCK_CHROME_PX = 10; // py-1 padding + border, top and bottom

export default function ClassBlock({ block }: { block: PositionedBlock }) {
  const styles = CLASS_COLORS[block.meeting.color] ?? CLASS_COLORS.indigo;
  const widthPct = 100 / block.laneCount;

  // Block height in px depends only on the meeting's own duration (see
  // domain/layout.ts: heightPct * gridHeight cancels the axis span out to
  // duration/60 * HOUR_HEIGHT_PX), so it can be computed directly here
  // without threading the axis through as a prop.
  const durationMinutes = block.meeting.endMinute - block.meeting.startMinute;
  const heightPx = (durationMinutes / 60) * HOUR_HEIGHT_PX;
  const spareForDetails = heightPx - BLOCK_CHROME_PX - NAME_LINE_PX - DETAIL_LINE_PX;
  const extraLines = Math.max(0, Math.min(2, Math.floor(spareForDetails / DETAIL_LINE_PX)));

  // Instructor is the detail the user specifically asked to see, so when only
  // one extra line fits, it wins over room.
  const showInstructor = extraLines >= 1 && !!block.meeting.instructor;
  const showRoom =
    !!block.meeting.room && (extraLines >= 2 || (extraLines >= 1 && !block.meeting.instructor));

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
      {showRoom && (
        <p className="truncate text-[10px] leading-tight opacity-80">{block.meeting.room}</p>
      )}
      {showInstructor && (
        <p className="truncate text-[10px] leading-tight opacity-80">{block.meeting.instructor}</p>
      )}
    </div>
  );
}
