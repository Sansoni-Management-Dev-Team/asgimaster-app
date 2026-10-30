import { setTimeout as sleep } from 'node:timers/promises';
import { z } from 'zod';
import type { MaxioRegion, MaxioResult, MaxioSnapshot, MaxioMember } from './types.js';

// Official contract: https://developers.maxio.com/http/advanced-billing-api/api-endpoints/subscriptions/list-subscriptions
// Authentication: https://developers.maxio.com/http/getting-started/authentication
// Rate handling: https://developers.maxio.com/http/getting-started/about-the-api/error-handling-rate-limiting
const id = z.number().int().positive().safe().transform(String);
const rowSchema = z.object({
  subscription: z.object({
    id,
    state: z.string().trim().min(1),
    updated_at: z.iso.datetime({ offset: true }),
    customer: z.object({
      id,
      email: z
        .string()
        .nullish()
        .transform((value) => value ?? null),
    }),
    // The new Maxio catalogue permits subscriptions with no associated product.
    product: z.object({ id, handle: z.string().nullable() }).nullable(),
  }),
});
export type MaxioSiteConfig = { subdomain?: string; apiKey?: string };
export type MaxioTransport = (
  url: URL,
  init: {
    method: 'GET';
    headers: Record<string, string>;
    signal: AbortSignal;
    redirect: 'error';
  },
) => Promise<Response>;
export type MaxioOptions = {
  transport?: MaxioTransport;
  timeoutMs?: number;
  runTimeoutMs?: number;
  retries?: number;
  maxPages?: number;
  pageSize?: number;
  maxRetryDelayMs?: number;
  now?: () => Date;
  wait?: (ms: number) => Promise<void>;
};
class PullError extends Error {
  constructor(
    readonly code: 'unavailable' | 'rate_limited' | 'malformed' | 'incomplete' | 'empty',
  ) {
    super(code);
  }
}
function bounded(value: number, min: number, max: number) {
  return Number.isInteger(value) && value >= min && value <= max;
}
export function createMaxioAdapter(
  region: MaxioRegion,
  config: MaxioSiteConfig = {},
  options: MaxioOptions = {},
) {
  const timeoutMs = options.timeoutMs ?? 10_000;
  const runTimeoutMs = options.runTimeoutMs ?? 300_000;
  const retries = options.retries ?? 2;
  const maxPages = options.maxPages ?? 1000;
  const pageSize = options.pageSize ?? 200;
  const maxRetryDelayMs = options.maxRetryDelayMs ?? 30_000;
  const now = options.now ?? (() => new Date());
  const wait = options.wait ?? ((ms) => sleep(ms));
  const transport = options.transport ?? fetch;
  const configured = Boolean(config.subdomain?.trim() && config.apiKey?.trim());
  const valid =
    /^[a-z0-9][a-z0-9-]*$/.test(config.subdomain ?? '') &&
    !/[:\r\n]/.test(config.apiKey ?? '') &&
    bounded(timeoutMs, 1, 60_000) &&
    bounded(runTimeoutMs, 1, 900_000) &&
    bounded(retries, 0, 5) &&
    bounded(maxPages, 1, 10_000) &&
    bounded(pageSize, 1, 200) &&
    bounded(maxRetryDelayMs, 0, 60_000);

  async function collect(): Promise<MaxioResult> {
    if (!configured) return { status: 'failed', region, code: 'not_configured' };
    if (!valid) return { status: 'failed', region, code: 'invalid_configuration' };
    const deadline = Date.now() + runTimeoutMs;
    const site = config.subdomain!;
    const source = `maxio:${region}:${site}`;
    const members = new Map<string, MaxioMember>();
    const seen = new Set<string>();
    async function page(number: number): Promise<unknown> {
      const url = new URL(`https://${site}.chargify.com/subscriptions.json`);
      url.search = new URLSearchParams({
        page: String(number),
        per_page: String(pageSize),
        sort: 'signup_date',
        direction: 'asc',
      }).toString();
      for (let attempt = 0; attempt <= retries; attempt++) {
        const remaining = deadline - Date.now();
        if (remaining <= 0) throw new PullError('incomplete');
        const abort = new AbortController();
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
          // The race also bounds non-cooperative stub transports and stalled body reads.
          const result = await Promise.race([
            (async () => {
              const response = await transport(url, {
                method: 'GET',
                redirect: 'error',
                signal: abort.signal,
                headers: {
                  Accept: 'application/json',
                  Authorization: `Basic ${Buffer.from(`${config.apiKey}:X`).toString('base64')}`,
                },
              });
              if (response.status === 429 || response.status >= 500) {
                const retryAfter = response.headers.get('retry-after');
                await response.body?.cancel();
                if (attempt === retries)
                  throw new PullError(response.status === 429 ? 'rate_limited' : 'unavailable');
                const seconds =
                  retryAfter && /^\d+(\.\d+)?$/.test(retryAfter) ? Number(retryAfter) * 1000 : NaN;
                const dateDelay = retryAfter ? Date.parse(retryAfter) - now().getTime() : NaN;
                const delay = retryAfter
                  ? Number.isFinite(seconds)
                    ? seconds
                    : dateDelay
                  : 500 * 2 ** attempt;
                // Do not retry earlier than a vendor requested delay to fit our budget.
                if (
                  !Number.isFinite(delay) ||
                  delay > maxRetryDelayMs ||
                  delay >= deadline - Date.now()
                )
                  throw new PullError('rate_limited');
                return { retryDelay: Math.max(0, delay) };
              }
              if (response.status !== 200) {
                await response.body?.cancel();
                throw new PullError('unavailable');
              }
              try {
                return { data: (await response.json()) as unknown };
              } catch {
                throw new PullError('malformed');
              }
            })(),
            new Promise<never>((_, reject) => {
              timer = setTimeout(
                () => {
                  abort.abort();
                  reject(new Error('timeout'));
                },
                Math.min(timeoutMs, remaining),
              );
            }),
          ]);
          if (timer) clearTimeout(timer);
          if ('retryDelay' in result) {
            await wait(result.retryDelay!);
            continue;
          }
          return result.data;
        } catch (error) {
          if (error instanceof PullError) throw error;
          if (attempt === retries) throw new PullError('unavailable');
          const delay = Math.min(500 * 2 ** attempt, maxRetryDelayMs);
          if (delay >= deadline - Date.now()) throw new PullError('incomplete');
          await wait(delay);
        } finally {
          if (timer) clearTimeout(timer);
          abort.abort();
        }
      }
      throw new PullError('unavailable');
    }
    try {
      for (let number = 1; number <= maxPages; number++) {
        const data = await page(number);
        if (!Array.isArray(data) || data.length > pageSize) throw new PullError('malformed');
        if (!data.length) {
          if (!seen.size) throw new PullError('empty');
          const snapshot: MaxioSnapshot = {
            region,
            site,
            collectedAt: now().toISOString(),
            members: [...members.values()]
              .sort((a, b) => a.reference.localeCompare(b.reference))
              .map((member) => ({
                ...member,
                subscriptions: member.subscriptions.sort((a, b) =>
                  a.reference.localeCompare(b.reference),
                ),
              })),
            evidence: {
              pages: number,
              subscriptions: seen.size,
              terminalEmptyPage: true,
              // Diagnostics only: syntax never gates collection or establishes identity.
              missingEmails: [...members.values()].filter((member) => !member.email?.trim()).length,
              emailSyntaxReview: [...members.values()].filter(
                (member) => member.email?.trim() && !z.email().safeParse(member.email).success,
              ).length,
            },
          };
          return { status: 'complete', snapshot };
        }
        for (const raw of data) {
          const parsed = rowSchema.safeParse(raw);
          if (!parsed.success) throw new PullError('malformed');
          const row = parsed.data.subscription;
          if (seen.has(row.id)) throw new PullError('incomplete');
          seen.add(row.id);
          const reference = `${source}:customer:${row.customer.id}`;
          const member = members.get(reference) ?? {
            reference,
            customerId: row.customer.id,
            email: row.customer.email,
            subscriptions: [],
          };
          if (member.email !== row.customer.email) throw new PullError('incomplete');
          member.subscriptions.push({
            reference: `${source}:subscription:${row.id}`,
            id: row.id,
            state: row.state,
            productId: row.product?.id ?? null,
            productHandle: row.product?.handle ?? null,
            updatedAt: row.updated_at,
          });
          members.set(reference, member);
        }
      }
      throw new PullError('incomplete');
    } catch (error) {
      // Never emit vendor errors, request headers, response bodies or member values.
      return {
        status: 'failed',
        region,
        code: error instanceof PullError ? error.code : 'unavailable',
      };
    }
  }
  return { region, collect };
}
