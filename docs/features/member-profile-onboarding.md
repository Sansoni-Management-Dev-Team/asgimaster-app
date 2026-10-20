# Member profile and onboarding

## Outcome and scope

A member sees their own identity, membership and direction, can complete or edit onboarding, and keeps that work across sessions and devices. New members see an honest starting point without fictional activity or identity.

Requirements: ONB-03, ONB-04, PRO-01, PRO-04, HOM-*, DES-01. See [authentication](authentication.md) for account boundaries, [access and identity](access-identity.md) for membership truth, [member experiences](member-experiences.md) for earned learning progress, and [visual requirements](../phase-2-visual-alignment.md) for presentation.

## Member states and Home

After authentication, new and returning members enter Home. Incomplete onboarding produces an intentional empty Home with an explanation and a start/resume action. It must not force a fictional name, goal, completed lesson, learning time or weekly activity into the account. Access that is still being configured is shown independently of onboarding completion.

Completed answers populate the member's direction and default plan context. The twelve-month outcome informs the plan; challenge and growth priorities appear on Home; industry, role and direction inform lesson recommendations. Editing those answers updates that context while preserving earned activity and explicitly customised plans. Completing a questionnaire never awards learning progress or changes access.

## Onboarding journey

The invitation follows the approved Concept 2 envelope, customer film, name confirmation and letter experience. The edition marking is reference artwork, never a live allocation counter. Replay preserves the entered name. Reduced motion provides an immediate usable invitation; unavailable video leaves the poster and invitation usable. Hidden or unrevealed controls cannot receive interaction or accessibility focus. Media pauses when hidden or backgrounded.

The questionnaire captures seven areas: ownership intent, industry, role perspective, income/revenue, twelve-month goal, challenge and skills/growth priorities. Revenue is asked of business owners; other roles use income. Changing role across these branches requires a compatible range and preserves valid unrelated answers. Industry supports an answer beyond the offered shortcuts. Text answers support meaningful multiline input and validation feedback. Introductory messages may be skipped without bypassing required answers.

A member can return to previous questions, resume at the first missing valid answer, review all answers and edit an individual answer. Cancelled edits preserve the saved answer. A role edit that invalidates income requires its replacement before completion. Completion derives from valid answers rather than an independent completion flag. Direct navigation cannot bypass a missing prerequisite. Final review enters Home; review opened from Home returns there after editing.

The confirmed invitation name is saved with completed onboarding. Unsubmitted drafts remain available within the active journey. Do not infer that a name change in this flow updates upstream identity records; that ownership is unresolved below.

## Persistence and profile

Empty and unfinished onboarding are valid account states. Valid partial answers can be saved and restored, including compatible historical answers; editing an earlier field retains later answers except where the current branch makes an answer incompatible. Submitted profile/onboarding changes belong to the authenticated member's account. They survive sign-out/sign-in and a different device. A failed save retains the member's inputs, preserves the previous saved record and offers retry; it must not claim success or advance as though the write succeeded. Loading failures cannot overwrite unread account data. Repeated submissions must not duplicate or lose changes. Existing valid answers and earned progress must survive compatible updates.

Profile shows the member's supplied identity, direction summary, membership entry points and grouped account actions. Both the membership card and membership details action open the same membership explanation. Status and available learning/guidance/support come from authoritative access data; do not invent prices, renewal dates, billing records, card IDs or expiry dates. Displaying or editing onboarding never changes membership.

## Acceptance criteria

- A new authenticated member reaches empty Home with no fabricated identity or earned activity, then starts or resumes onboarding.
- Every required answer can be entered, reviewed and edited, with compatible income/revenue handling and no prerequisite bypass.
- The confirmed name and saved answers survive a new session and device; another member sees none of them.
- Failed loads and writes retain prior saved work and recoverable drafts. A retry completes the intended write without duplicate effects.
- Answer changes refresh direction and recommendations while preserving learning history and customised plans.
- Profile and membership explanations are consistent with resolved access, including payment issues and access being set up.
- Invitation, questionnaire and review remain usable with reduced motion, enlarged text and assistive technology under the [shared accessibility requirements](../phase-2-visual-alignment.md#accessibility).

## Unresolved choices

- D-21: confirm the business use of onboarding answers and any intended HubSpot mapping. Persistence does not imply permission to write upstream.
- D-20: production membership card identifier, expiry semantics and their authoritative service. Prototype card issuance/conversion is not a product identity contract.
- D-10: whether weekly actions, personal notes and an editable plan are included in the released product. Preserve valid existing member work while that boundary is decided.
- DEP-19: approve any missing member-facing designs for new access/account states rather than inferring them from demonstration screens.
- Which profile fields members may edit independently of onboarding, and how those changes relate to HubSpot identity facts, need product confirmation.
