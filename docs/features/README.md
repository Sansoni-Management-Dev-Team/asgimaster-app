# Feature specifications

Start here for required member and staff behaviour. These specifications describe the intended product, including behaviour that may not yet be implemented. They are not statements of delivery status. Use the implementation, tests and delivery tracker to establish what works today.

| Specification                                                           | Canonical requirements                                                                                                            |
| ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| [Authentication, invitations and staff access](authentication.md)       | Eligibility, passwordless entry, invitation lifecycle, session isolation, staff permissions and invitation release gate           |
| [Member profile and onboarding](member-profile-onboarding.md)           | Member-owned profile and direction, first-run Home, questionnaire, editing, account persistence and membership presentation       |
| [Access and identity](access-identity.md)                               | Membership truth, identity assertions, capabilities, access states, rules, corrections, failure containment and conformance       |
| [Member experiences](member-experiences.md)                             | Learning, progress, events, support, enquiries, notifications and common offline behaviour                                        |
| [Programme offboarding](../offboarding.md)                              | Member-initiated leaving enquiry, retained draft and receipt; automatic membership transitions are defined in access and identity |
| [AaronAI workspace](../aaronai-ui.md)                                   | Conversation, Search/Deal Plan, evidence, history and reviewed human handoff                                                      |
| [Visual and accessibility requirements](../phase-2-visual-alignment.md) | Shared presentation, membership-card treatment and accessible interaction                                                         |

The [high-level designs](../hldd/README.md) explain the agreed platform and integration approach. [Architecture](../architecture.md) shows the system boundaries. [Linear access](../linear.md) describes how to select the correct delivery workspace.

## Reading and maintenance rules

Requirement IDs (`ACC-*`, `ENT-*`, etc.), decisions (`D-*`), constraints (`CON-*`) and dependencies (`DEP-*`) retain their meaning from the V1 requirements workbook. The workbook remains the source of requirement identity; keep any discovered conflict explicit rather than assuming a backlog entry changes an agreement. Do not invent missing workbook content.

Each behaviour has one canonical home in the table above. Link to it from designs and other features rather than copying it. Keep agreed requirements separate from proposed choices. Payloads, schemas, routes, package versions, configuration defaults and resource inventories belong to their authoritative implementation. Keep delivery plans, progress, dated handoffs and verification evidence in Linear, PRs or thread artifacts outside `docs/`.

Open choices are recorded with the feature or design they affect. An open choice is not permission to weaken an agreed invariant. Demonstrations must identify simulated behaviour and must not imply that a message, booking, payment change or membership change occurred.
