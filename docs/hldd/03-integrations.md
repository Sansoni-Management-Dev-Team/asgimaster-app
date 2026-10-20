# HLDD 03 — Integrations

## Scope and boundary

This design owns vendor choices and integration responsibilities. Required learning/events/support/enquiry behaviour is in [member experiences](../features/member-experiences.md), identity/access policy in [access and identity](../features/access-identity.md), and AaronAI interaction in [its feature specification](../aaronai-ui.md). Durable writes and retries follow [HLDD 01](01-platform-api-admin.md#durable-member-work-and-outbound-delivery).

Integration secrets remain in the API (CON-03). Native Intercom messaging and protected Mux playback are scoped app-side integrations; neither embeds a general vendor service credential. An integration failure is contained to the affected experience.

## HubSpot

Requirements: ENT-02, ENQ-02, DAT-01, OFF-05, ONB-04. Read linked contact facts needed for access; the exact properties depend on DEP-27 in [access and identity](../features/access-identity.md#unresolved-choices).

D-04 proposes an app-owned property group containing last-watched and inactivity values, updated in batches. Because vendor permissions are broader than individual properties, an application allowlist must constrain activity writes to the approved fields. Missing HubSpot links are skipped rather than inferred. Contact write permission still requires client confirmation.

The selected enquiry design uses HubSpot Forms submissions to trigger CX workflows. Because Forms associates by email and does not provide a native idempotency key, durable local duplicate protection and a policy for uncertain delivery are required. This choice conflicts with proposed CON-24, described below; do not silently invent a different integration or create contacts without agreement.

## Maxio

Requirements: ENT-02, ENT-08, OFF-02. The API uses read-only access and verified webhooks, including the relevant AU/NZ membership sources. It never writes membership changes. Source collection feeds the resolver; refresh/completeness semantics are canonical in [access and identity](../features/access-identity.md#refresh-and-failure-containment).

## Intercom

Requirements: SUP-01–SUP-04, AAI-06. The native SDK provides the messenger. The API signs a short-lived verified member identity; support replies use the native platform notification token, coordinated with app notifications. Intercom's HubSpot app is selected for conversation logging (D-17), subject to plan capabilities and the contact-creation restriction below. Reviewed AaronAI handoff should open the messenger with only the approved snapshot if supported; the vendor handoff contract remains open.

## Mux and catalogue

Requirements: LIB-01–LIB-08, EVT-03, PRO-02, PRO-03. The application owns the published catalogue and ordering; Mux owns video assets, durations, playback, captions and generated chapter suggestions. The client supplies the content/course structure (DEP-05). Staff can correct catalogue/chapter metadata without an app release (D-07, D-22). Generated chapters are editable suggestions, not immutable source truth.

The API signs short-lived, entitlement-checked playback, thumbnail and storyboard access. Mux asset events update availability/duration; unavailable assets must not be represented as ready content. Operational import formats and catalogue schemas belong in implementation, not this design.

## Events calendars

Requirements: EVT-01, EVT-02. D-08 selects one client-maintained feed per membership audience, associated with a capability. Import reconciles stable event identity across feeds and retains the last successful result on failure. Feed parsing details and scheduling belong in implementation once the format is agreed.

## AaronAI

Requirements: AAI-02, AAI-03. D-12 selects an API proxy that checks capability, uses server-side credentials, applies per-member throttling and streams replies. Conversation/plan ownership depends on the AaronAI service contract: prefer its member-keyed history if supported; otherwise application-owned persistence needs explicit agreement. Inference location and retention must be verified for the privacy policy; earlier assumptions about a provider or region are not approval.

## Engagement and client data

Requirements: DAT-01, DAT-03. D-18 leaves the collection boundary open: video progress alone, or additional app-open/feature-use events. This determines what “inactivity” can truthfully mean. The selected approach excludes a third-party product analytics platform. Client read access is governed by [HLDD 01](01-platform-api-admin.md#client-read-access).

## Unresolved integration choices

- D-04: authorisation for HubSpot activity write scope, constrained app properties and who creates the approved properties/forms (DEP-28).
- CON-24/D-34: contact-ID-only HubSpot writes and synthetic test members without HubSpot IDs are proposed. Forms attaches by email and can create contacts. Decide whether unlinked-member enquiries may create contacts, or whether a contact-keyed note/task design replaces Forms with the necessary approved scope. Until resolved, preserve the CX inbox route and do not imply upstream delivery.
- DEP-21: client Intercom plan, HubSpot logging capability and whether sync can create unwanted contacts for unlinked or synthetic members.
- D-08: event feed format, audience feeds and ownership.
- D-12: AaronAI API/auth/streaming, member-keyed history/plan storage, inference residency and retention; AAI-06 human handoff contract.
- D-18: engagement collection boundary and associated inactivity semantics.

Kajabi runtime integration, upstream membership writes and marketing campaigns are outside this design.
