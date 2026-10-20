import { z } from 'zod';

const text = (limit: number) => z.string().trim().min(1).max(limit);
const ownerRanges = ['0-100k', '100-500k', '500k-1m', '1m+'];
const employeeRanges = ['100-200k', '200-300k', '300k+'];

// A record may be a partial draft. Retain historical role/occupation fields and
// later answers when editing an earlier step clears a dependent answer.
export const OnboardingRecordSchema = z
  .strictObject({
    version: z.literal(1),
    name: text(80)
      .transform((value) => value.replace(/\s+/g, ' '))
      .optional(),
    answers: z.strictObject({
      ownershipIntent: z
        .enum(['find-business', 'buy-specific', 'grow-business', 'explore-options'])
        .optional(),
      industry: text(120).optional(),
      rolePerspective: z
        .enum([
          'run-business',
          'make-decisions',
          'advise-business',
          'build-business',
          'preparing-owner',
        ])
        .optional(),
      incomeRange: text(20).optional(),
      goal12Months: text(1000).optional(),
      challenge: text(1000).optional(),
      skills: text(1000).optional(),
      role: text(120).optional(),
      occupation: z.enum(['employee', 'business-owner']).optional(),
    }),
  })
  .superRefine(({ answers }, ctx) => {
    if (answers.incomeRange === undefined) return;
    const incomeType = answers.rolePerspective
      ? answers.rolePerspective === 'run-business'
        ? 'business-owner'
        : 'employee'
      : answers.occupation;
    const ranges =
      incomeType === 'business-owner'
        ? ownerRanges
        : incomeType === 'employee'
          ? employeeRanges
          : [];
    if (!ranges.includes(answers.incomeRange))
      ctx.addIssue({
        code: 'custom',
        path: ['answers', 'incomeRange'],
        message: 'Choose an income range for your role.',
      });
  });
export type OnboardingRecord = z.infer<typeof OnboardingRecordSchema>;

export const MeResponseSchema = z.strictObject({
  member: z.strictObject({ id: z.string().min(1), displayName: z.string(), email: z.email() }),
  access: z.strictObject({
    state: z.literal('none'),
    planLabel: z.null(),
    capabilities: z.array(z.never()).max(0),
    sourceAsAt: z.null(),
    rulesVersion: z.null(),
    hash: z.null(),
  }),
  onboarding: OnboardingRecordSchema,
});
export type MeResponse = z.infer<typeof MeResponseSchema>;
