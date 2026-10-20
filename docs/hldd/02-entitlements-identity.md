# HLDD 02 — Entitlements and identity

## Design boundary

The application owns the access resolver and staff-managed rules under D-01. [Access and identity](../features/access-identity.md) is the canonical specification for source authority, identity precedence, capabilities, states, rule/correction policy, refresh, safeguards and acceptance. [Authentication](../features/authentication.md) owns login eligibility and session-to-member isolation. Do not duplicate those policies here.

The resolver accepts a member's upstream snapshots, a versioned rule set, applicable corrections and an explicit evaluation time. It performs no network I/O and does not use an implicit clock or randomness. Canonical serialisation and hashing allow stable comparisons and provenance. Separate retained resolution history from the current member view, so staff can explain a change without recomputing against changed inputs.

Derived upstream associations are rebuildable; human assertions remain durable audit evidence. Treat login linkage as its own authority boundary rather than a side effect of source matching. Source refresh gathers complete current inputs before it asks the resolver for a result. Webhook delivery is a prompt to refresh, not an authoritative subscription delta.

Validation and the removal brake surround resolution and publication. A failed input check cannot publish an empty result as a successful downgrade. Keep resolution-run evidence distinct from member engagement events: a held run is a data-health event, not a crash or member action.

The client retains its reference implementation and conformance suite. Integration into CI must preserve that ownership and pinned acceptance boundary; the canonical acceptance conditions and unresolved suite format are in [the feature specification](../features/access-identity.md#acceptance-and-conformance). Technical schemas and fixtures belong in implementation and the client-owned suite.
