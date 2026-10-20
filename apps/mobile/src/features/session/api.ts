import {
  MeResponseSchema,
  OnboardingRecordSchema,
  type OnboardingRecord,
  type MeResponse,
} from '@mlai-sansoni/contracts';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
  }
}
export type Transport = (path: string, init?: RequestInit) => Promise<Response>;
export async function responseJSON(response: Response): Promise<unknown> {
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error = body && typeof body === 'object' && 'error' in body ? body.error : body;
    const message =
      response.status === 401
        ? 'Your session has expired. Sign in again.'
        : response.status === 403
          ? 'Member access is not available for this account.'
          : response.status === 429
            ? 'Too many attempts. Please wait before trying again.'
            : 'The request could not be completed. Please try again.';
    const code =
      error && typeof error === 'object' && 'code' in error && typeof error.code === 'string'
        ? error.code
        : undefined;
    throw new ApiError(message, response.status, code);
  }
  return body;
}
function validated<T>(
  schema: { safeParse(value: unknown): { success: boolean; data?: T } },
  value: unknown,
): T {
  const result = schema.safeParse(value);
  if (!result.success)
    throw new ApiError('Member services returned an invalid response. Please try again.', 502);
  return result.data as T;
}
export function memberAPI(request: Transport) {
  return {
    async me(signal?: AbortSignal) {
      return validated<MeResponse>(
        MeResponseSchema,
        await responseJSON(await request('/v1/me', { signal })),
      );
    },
    async saveOnboarding(record: OnboardingRecord, idempotencyKey: string) {
      const body = OnboardingRecordSchema.parse(record);
      return validated<OnboardingRecord>(
        OnboardingRecordSchema,
        await responseJSON(
          await request('/v1/me/onboarding', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
            body: JSON.stringify(body),
          }),
        ),
      );
    },
  };
}
