// supabase/functions/extract-schedule/prompt.ts

export const SYSTEM_PROMPT = `You read a screenshot of a student's class schedule and return the classes as JSON.

Rules:
- Return one entry per distinct meeting time. If a class meets MWF at 10:00 and also Tuesday at 14:00, return TWO entries with the same name.
- days uses ISO weekday numbers: 1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday, 6=Saturday, 7=Sunday.
- startMinute and endMinute are minutes from midnight. 10:00 AM is 600. 1:15 PM is 795.
- Use null for instructor or room when the screenshot does not show them. Never invent a value.
- If the image is not a class schedule, or you cannot read it, return an empty classes array and explain why in warnings.
- Do not guess a time you cannot read. Omit the class and add a warning instead.`;

export const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    classes: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          instructor: { type: 'string', nullable: true },
          room: { type: 'string', nullable: true },
          days: { type: 'array', items: { type: 'integer' } },
          startMinute: { type: 'integer' },
          endMinute: { type: 'integer' },
        },
        required: ['name', 'days', 'startMinute', 'endMinute'],
      },
    },
    warnings: { type: 'array', items: { type: 'string' } },
  },
  required: ['classes', 'warnings'],
};
