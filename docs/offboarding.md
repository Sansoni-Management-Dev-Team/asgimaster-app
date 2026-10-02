# Programme off-boarding

The Phase 2 flow starts only from an explicit **Leave my programme** action below membership access, or from Support's **Membership & billing** topic. There are no automatic expiry, payment-status or inactivity triggers. It concerns leaving the programme, with optional interest in keeping digital app access.

## Journey

`/offboarding` holds four internal steps: introduction, optional reason/note, digital-access alternative and callback details. The introduction offers a direct conversation path and a centred Continue with leaving action. Back returns to membership. Reasons can be skipped. Declining the digital alternative advances directly to callback details. The in-flow Back action and Android system Back preserve the draft; leaving without submitting creates no request.

The callback form records one of `discuss`, `digital-access` or `leave-programme`. It requires an international phone number (8–15 digits after the plus sign), accepts a preferred time/timezone up to 160 characters and retains the optional reason and note up to 400 characters. Preferred times are requests, not booked slots. No price or specific digital entitlement is invented.

Submission and receipt clearly identify this as a local prototype: no callback is arranged and no team member is contacted. Programme membership, access, billing, card ID/expiry and earned activity are unchanged. Resolving the Support conversation only closes that conversation.

## Persistence and handoff

Support conversations remain the canonical request records. Optional `offboarding` metadata records intent, reason, note, normalised phone, preferred time and a snapshot of the programme name, membership status and card reference. Existing conversations load unchanged; malformed optional metadata is discarded without losing their messages.

The shared local store now has an awaited `commit` operation. It queues the storage write, locks concurrent changes, publishes the new state only after success and retains prior state on failure. Callback forms retain their inputs for retry. A second submission reuses an existing open request, including a request with an agent reply. Resolved requests permit a new journey.

Membership details and the account-support shortcut show **View callback request** while an open request exists. Re-entry opens its receipt, without repeating the retention offer. Receipts link to the exact Support conversation; routes contain only request IDs, never phone numbers or reasons. Missing receipt links show a recovery action rather than submitting or silently starting another request.

Real callback delivery, scheduling, authenticated member-scoped storage, programme cancellation and digital-plan provisioning require future backend integration. The current request is not an authorization to perform any of those actions.

## Verification

- 120 automated tests pass, including all three intents, optional reasons, phone/length validation, Back preservation, failed writes/retry, concurrency guards, duplicate prevention, metadata restoration, legacy compatibility and member/card/access preservation through request resolution.
- Browser verification covers membership entry, reason selection, the digital option, form validation, keyboard submission, receipt, Support handoff, persisted reload, outstanding-request re-entry and the account-topic shortcut.
- All five flow screens pass 25 layout audits across 320×568, 360×800, 390×844, 430×932 and 844×390: no horizontal overflow, clipped leaf text or controls smaller than 48×48. Headings receive focus on step changes; keyboard focus is visible and scrolls into view. Screens use static transitions, including under reduced-motion preferences.
- TypeScript/token consistency and lint are checked. Browser validation exposed and fixed empty-string rendering in shared form fields and stray whitespace in the Support composer container.
- Device VoiceOver/TalkBack, software keyboard and 200% native text scaling remain unverified. The in-app browser did not apply zoom shortcuts. The accessible browser tree and layout checks do not replace a device accessibility sign-off.

Screenshots are saved under `.expo/qa/offboarding-*.png`.
