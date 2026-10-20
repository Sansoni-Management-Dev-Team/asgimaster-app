# High-level design

Read the [feature specifications](../features/README.md) first for required outcomes, invariants, user states and acceptance criteria. These designs explain how the selected platform meets those requirements; they do not record delivery status or replace the workbook's requirement identities.

| Design                                                        | Responsibility                                                                   |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| [01 — Platform, API and admin](01-platform-api-admin.md)      | Platform choices, staff/member boundary, durable writes, operations and recovery |
| [02 — Entitlements and identity](02-entitlements-identity.md) | Resolver boundary, provenance and source-refresh design                          |
| [03 — Integrations](03-integrations.md)                       | External-system ownership, integration choices and unresolved vendor contracts   |
| [04 — Member app](04-member-app.md)                           | App/API boundary, device state and native service integration                    |

[Architecture](../architecture.md) shows the system boundaries. Schemas, routes, dependencies, configured resources and automation are authoritative in the implementation, not duplicated here. Open product choices remain with their canonical feature; open technical choices remain with their design. A selected design is not evidence that its implementation is complete.
