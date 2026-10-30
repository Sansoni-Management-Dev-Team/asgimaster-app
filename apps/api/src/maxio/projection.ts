import type { MaxioSnapshot } from './types.js';

// The caller supplies explicit, already-linked subscription references. Collection
// never links identities, selects in-scope products or interprets vendor states.
export function projectMaxioForResolver(
  snapshot: MaxioSnapshot,
  linkedReferences: ReadonlySet<string>,
) {
  return {
    source: `maxio:${snapshot.region}:${snapshot.site}`,
    asAt: snapshot.collectedAt,
    records: snapshot.members.flatMap((member) =>
      member.subscriptions
        .filter((subscription) => linkedReferences.has(subscription.reference))
        .map((subscription) => ({
          ref: subscription.reference,
          facts: {
            state: subscription.state,
            productId: subscription.productId,
            productHandle: subscription.productHandle,
            updatedAt: subscription.updatedAt,
          },
        })),
    ),
  };
}
