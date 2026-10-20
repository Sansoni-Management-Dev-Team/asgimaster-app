# Member experiences

These are intended product behaviours, including integrations that may not yet be implemented. Identity and access decisions belong in [access and identity](access-identity.md); architecture and vendor boundaries belong in [HLDD 03](../hldd/03-integrations.md) and [HLDD 04](../hldd/04-member-app.md).

## Learning library and progress

Requirements: LIB-01–LIB-08, LIB-10; PRG-*; PRO-02, PRO-03, PRO-04; EVT-03. Members browse and search their included collections, open published lessons and resume learning. Empty collections and non-actionable entries are not offered as included content. Locked “Not included”/“Explore all” prototype upsells are outside the agreed included-content experience.

Playback requires current entitlement to the collection and uses protected video, thumbnails and storyboards. Lessons provide captions; chapters offer navigable sections that staff can correct without a store release. Event recordings can be associated with their event. Missing media or a playback failure offers recovery without breaking the rest of the catalogue.

Progress belongs to the member, persists across sessions/devices and survives leaving and returning. Retain furthest position, last watched and first completion. A lesson completes at the agreed 90% threshold; seek/background time must not be fabricated as learning time. Collection roll-ups derive from lesson activity. Pausing, backgrounding and returning preserve progress without duplicate effects or automatically starting an unrelated lesson. Onboarding completion never counts as earned learning.

Offline video downloads are excluded (LIB-09). A consumption/booking ledger is excluded (CON-13).

## Events

Requirements: EVT-01–EVT-04, EVT-06. Members see an event when they hold any of its membership-audience capabilities. The same event appearing in several audience calendars appears once. Event details explain time, location/online access and available preparation/recording context. A failed calendar import retains the last good import.

In-app registration, cancellation, QR admission, wallet/offline passes, check-in and attendance tracking are outside the agreed calendar/list/detail experience. Prototype demonstrations of these actions must not imply a real reservation or admission credential.

## Support and enquiries

Requirements: SUP-01–SUP-04, ENQ-01–ENQ-04. Support topics open the member's Intercom messenger with relevant topic context. Identity is verified against the member account, and sign-out ends that support association. If messenger is unavailable, show a usable alternative contact route.

An enquiry is retained against the member account and routed to the CX inbox. Submission acknowledges receipt rather than promising a booked appointment or completed membership change. Repeated submissions/retries must not duplicate the request. Failed submission retains the draft and offers retry. Upstream delivery is asynchronous; third-party failure must not lose a saved request or block unrelated screens. Staff can inspect failed delivery and retry safely.

HubSpot enquiry/activity writes and Intercom conversation logging are intended integrations subject to the unresolved permissions and contact-creation choices in [HLDD 03](../hldd/03-integrations.md#unresolved-integration-choices). A member without HubSpot remains able to make an enquiry through the CX route. Prototype local conversations and simulated replies are not proof of delivery.

## Notifications and links

Requirements: NOT-01–NOT-03. Request notification permission at a moment of value, never simply on first open. Preferences must be understandable and respected. Support replies can notify the member; tapping a notification opens the intended permitted destination. Member identity, sensitive content and credentials must not appear in push payloads.

Invitation, lesson, event and support links must handle missing installation, invalid destinations and lost access safely. A link does not bypass authentication or entitlement checks.

## Common device behaviour

Requirements: CON-01, CON-02, CON-07, CON-08, CON-11, CON-12. Previously loaded member data renders promptly while refresh happens in the background. Failed refreshes preserve the last good result without a generic staleness warning or a live-billing claim. Long-outage fallback retains library access while hiding events/coaching; the trust duration remains D-37 in [access and identity](access-identity.md#unresolved-choices).

Device data is scoped by member and cleared on sign-out. Unread data cannot be overwritten by a failed load. Recoverable drafts and queued writes must survive transient failure; progress and enquiry retries are safe and do not duplicate effects. Live-only actions such as chat and enquiry submission explain failure and allow retry. An offline draft is not represented as delivered. Shared devices must never expose another member's cached work.

## Acceptance criteria

- Only included actionable content is shown, and the server independently checks access to protected playback and data.
- Captions, resume and accurate progress work without awarding activity for onboarding or lost/duplicated requests.
- Audience overlaps do not duplicate events; import failure preserves the last good schedule.
- A support/enquiry failure preserves a recovery path and any unsent draft; successful saved requests remain visible despite upstream delivery failure.
- Account switching and sign-out clear member data and vendor associations; notifications and links cannot reveal or open another member's information.
- Loaded data remains usable during outages and retries preserve member work, within the agreed long-outage policy.

## Unresolved choices

- D-11: confirm disposition of prototype-only features and fixtures; they must not be mistaken for supported live services.
- D-18 and D-08: see the [canonical engagement and calendar integration choices](../hldd/03-integrations.md#unresolved-integration-choices).
- D-26: confirm the final release boundary across the intended features. Delivery sequencing belongs in Linear, not this specification.
