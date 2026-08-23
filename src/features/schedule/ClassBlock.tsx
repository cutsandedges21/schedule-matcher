// src/features/schedule/ClassBlock.tsx
import { CLASS_COLORS } from '@/domain/color';
import { formatMinutes, formatMinutesCompact } from '@/domain/time';
import { WEEKDAY_LABELS } from '@/domain/constants';
import { HOUR_HEIGHT_PX } from '@/components/HourGrid';
import type { PositionedBlock } from '@/domain/layout';

// Approximate rendered line heights at leading-tight, used only to decide how
// many *optional* detail lines fit — name and time always render (matching
// prior behaviour); room/instructor are added progressively so a short block
// (a 50-minute class is ~53px tall) never has more text than it has room for.
const NAME_LINE_PX = 15; // text-xs leading-tight
const DETAIL_LINE_PX = 13; // text-[10px] leading-tight
const BLOCK_CHROME_PX = 10; // py-1 padding + border, top and bottom

interface Props {
  block: PositionedBlock;
  /** Edit mode only. When given, the block becomes a real button. */
  onSelect?: () => void;
  /**
   * Which grid this block is sitting in.
   *
   * 'week' is the every-day-at-once layout, where a column is around 55px wide
   * on a phone. Below `lg` that variant shrinks its type and drops room and
   * instructor entirely: at that width they truncate to two or three characters,
   * which is noise rather than detail. At `lg` a week column is wide again and
   * the two variants render identically.
   */
  variant?: 'day' | 'week';
}

export default function ClassBlock({ block, onSelect, variant = 'day' }: Props) {
  const styles = CLASS_COLORS[block.meeting.color] ?? CLASS_COLORS.indigo;
  const week = variant === 'week';
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

  const positioning = {
    top: `${block.topPct}%`,
    height: `${block.heightPct}%`,
    left: `${block.lane * widthPct}%`,
    width: `${widthPct}%`,
  };

  // One constant, so the div and button branches cannot drift apart.
  const className = `absolute overflow-hidden rounded-lg border text-left ${
    week ? 'px-1 py-0.5 lg:px-2 lg:py-1' : 'px-2 py-1'
  } ${styles.block} ${styles.text}`;

  // The narrow-week sizes only ever shrink what the day variant shows, so the
  // vertical fit computed above still holds.
  const detailClass = `truncate leading-tight opacity-80 ${
    week ? 'text-[9px] lg:text-[10px]' : 'text-[10px]'
  }`;

  const content = (
    <>
      <p
        className={`truncate font-semibold leading-tight ${week ? 'text-[10px] lg:text-xs' : 'text-xs'}`}
      >
        {block.meeting.name}
      </p>
      <p className={detailClass}>
        {week ? (
          <>
            <span className="lg:hidden">
              {formatMinutesCompact(block.meeting.startMinute)}
            </span>
            <span className="hidden lg:inline">{formatMinutes(block.meeting.startMinute)}</span>
          </>
        ) : (
          formatMinutes(block.meeting.startMinute)
        )}
      </p>
      {showRoom && (
        <p className={`${detailClass} ${week ? 'hidden lg:block' : ''}`}>{block.meeting.room}</p>
      )}
      {showInstructor && (
        <p className={`${detailClass} ${week ? 'hidden lg:block' : ''}`}>
          {block.meeting.instructor}
        </p>
      )}
    </>
  );

  // `data-class-block` marks a block whether or not it is interactive. It is
  // read by ScheduleGrid's long-press handler to tell "pressed a class" from
  // "pressed empty space" — a distinction that does not depend on whether this
  // particular block happens to be tappable.
  if (!onSelect) {
    return <div data-class-block="" className={className} style={positioning}>{content}</div>;
  }

  return (
    <button
      type="button"
      data-class-block=""
      onClick={onSelect}
      // A class meeting twice a week puts two identical blocks on screen at
      // once in the week grid, so the day is what tells them apart. The day
      // grid shows one day at a time and has nothing to disambiguate against.
      aria-label={
        week
          ? `Edit ${block.meeting.name}, ${WEEKDAY_LABELS[block.day]}`
          : `Edit ${block.meeting.name}`
      }
      className={className}
      style={positioning}
    >
      {content}
    </button>
  );
}
