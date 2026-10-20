# Programme offboarding

## Outcome and entry

Requirements: OFF-*, ENQ-01, ENQ-03. A member can ask to discuss leaving their programme, express interest in digital access, and receive an honest request receipt. This journey begins only from an explicit **Leave my programme** action below membership access, or Support's **Membership & billing** topic. Payment status, inactivity and expiry do not automatically start this enquiry.

Source-driven wind-down and after-window access are separate requirements in [access and identity](features/access-identity.md). A leaving enquiry does not cancel membership, alter billing/access, issue a digital plan or delete the account.

## Journey and states

The journey offers an introduction, an optional reason/note, a digital-access alternative and callback details. The introduction includes a direct conversation path as well as Continue with leaving. Reasons can be skipped; declining the digital alternative proceeds to callback details. Do not invent a price or specific digital entitlement.

The callback request distinguishes discussing options, interest in digital access and leaving the programme. It requires a valid international phone number and permits a preferred time/timezone. Preferred times are requests, not booked slots. Validation is clear and retains entered information on failure.

In-flow Back and Android system Back preserve the draft. Leaving without submission creates no request. A failed submission retains inputs and prior saved state for retry. Repeated or concurrent submissions reuse the existing open request, including one that already has an agent reply. A resolved request permits a new journey.

An outstanding request changes the relevant membership/support shortcut to **View callback request**. Re-entry opens its receipt without repeating the retention offer. Receipts open the exact request conversation; navigation references must not expose phone numbers or reasons. A missing receipt target offers recovery rather than silently creating another request.

Resolving the conversation closes the request conversation only. Programme membership, access, billing and earned activity remain unchanged. Any later cancellation or digital-plan provisioning needs its own authorised operating process.

## Service boundary and acceptance

Delivery and identity follow [support/enquiry requirements](features/member-experiences.md#support-and-enquiries) and [authentication](features/authentication.md). Local demonstrations must clearly say when no callback is arranged and no team member has been contacted; an on-device receipt alone is not delivery evidence.

- Each of the three intents can be submitted with optional reason/note and valid callback details.
- Back, failed save and retry preserve the draft without creating duplicate requests or changing membership.
- Outstanding-request entry and receipts recover the correct conversation; closing it allows a fresh enquiry without changing account state.
- Member-scoped persistence prevents another account from reading callback details or reasons.
- The flow meets the [shared accessibility requirements](phase-2-visual-alignment.md#accessibility), including native Back, enlarged text, focus and keyboard visibility.

## Unresolved choices

D-09 requires agreement on programme exit policy, digital-access offers, CX callback fulfilment and the separate source-driven access windows. D-19 account deletion is a different product decision. The enquiry must remain usable and truthful without assuming those policies are settled.
