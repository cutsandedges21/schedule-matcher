// src/domain/schema.ts
import { z } from 'zod';

export const usernameSchema = z
  .string()
  .min(3, 'At least 3 characters')
  .max(20, 'At most 20 characters')
  .regex(/^[a-z0-9_]+$/, 'Lowercase letters, numbers and underscores only');

export const extractedClassSchema = z
  .object({
    name: z.string().min(1).max(120),
    instructor: z.string().max(120).nullish().transform((v) => v ?? null),
    room: z.string().max(60).nullish().transform((v) => v ?? null),
    days: z.array(z.number().int().min(1).max(7)).min(1).max(7),
    startMinute: z.number().int().min(0).max(1439),
    endMinute: z.number().int().min(1).max(1440),
  })
  .refine((c) => c.endMinute > c.startMinute, {
    message: 'End time must be after start time',
    path: ['endMinute'],
  });

export const extractionResponseSchema = z.object({
  classes: z.array(extractedClassSchema),
  warnings: z.array(z.string()).default([]),
});

export type ExtractionResponse = z.infer<typeof extractionResponseSchema>;
