# HLDD 04 — Member app

## Scope and design approach

The native app uses the existing approved experience as its visual reference while modules consume the member API. Required behaviour belongs in the [feature specifications](../features/README.md), including [onboarding/profile](../features/member-profile-onboarding.md), [access/identity](../features/access-identity.md) and [member experiences](../features/member-experiences.md). The app targets iOS and Android (PLT-01, PLT-02); browser previews do not certify native behaviour.

## App/API boundary

The API is authoritative for member identity, resolved access and account-owned data. A shared validated contract keeps mobile and server aligned without importing server secrets or auth internals into the bundle. Exact payloads, routes, generated types and dependency versions belong in implementation.

Use the selected Expo/React Native architecture and repository conventions. TanStack Query owns server state; Zustand owns session/UI state. A shared API client supplies secure bearer credentials, member-scoped conditional reads and retry-safe write identity. Native auth credentials use SecureStore. No screen reconstructs tier rules or upstream membership logic.

Persist the query cache in a member-keyed device namespace; MMKV is the selected design. Cache restoration must wait for identity before showing account data. Durable mutations and recoverable drafts support intermittent connectivity under [common device behaviour](../features/member-experiences.md#common-device-behaviour). A cache failure is not permission to manufacture content or overwrite unread work.

## Native integrations

Expo Router handles native navigation, verified app links and notification destinations. Expo video plays signed Mux media; the Intercom native SDK supplies support. Expo notifications coordinate application push registration with Intercom's platform token needs. Server integration responsibilities are in [HLDD 03](03-integrations.md).

Server-supplied configuration is the proposed mechanism for product copy, support topics, feature availability and the AaronAI product name without a store release. Only usable features should be exposed; remote configuration cannot replace server authorisation.

EAS Build is selected for native distribution and EAS Update is proposed for compatible over-the-air changes (CON-12). Native changes require a store build. Store builds must use the intended environment and review account; synthetic test members do not justify exposing real member data. Concrete build profiles, channels and application association files belong in configuration.

## Quality and compliance boundary

Requirements: PLT-01–PLT-03, DEL-08, CMP-01–CMP-03, DES-01, DES-02. [Visual/accessibility requirements](../phase-2-visual-alignment.md) are canonical for accessible interaction. PII-scrubbed error reporting is proposed alongside platform observability in [HLDD 01](01-platform-api-admin.md#operations-and-security).

Native-device accessibility, media lifecycle, software keyboard and session/link behaviour must be exercised before release. JavaScript exports and browser layout checks alone are insufficient native release evidence. In-app purchase (CMP-01), staff features in the member app (ADM-06) and offline downloads (LIB-09) are outside scope.

## Open choices

Account deletion (D-19), profile/card ownership (D-20/D-21), Home extras (D-10), offboarding (D-09), AaronAI naming/service integration (D-12/D-13) and cache fallback thresholds (D-37) remain with their linked feature/design. D-26's agreed release scope is canonical in the [feature index](../features/README.md#release-scope). Over-the-air update policy, remote configuration ownership, error-reporting approval and minimum supported OS policy require operating/release agreement; configured defaults do not constitute product approval.
