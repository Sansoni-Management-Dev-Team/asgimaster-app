# Member app visual and accessibility requirements

## Visual direction

DES-01 selects the approved monochrome onboarding direction across the native member app: near-black background, charcoal surfaces, white primary actions with dark text, restrained borders and clear typography. Preserve the brand's semantic colour distinctions rather than redefining a named colour to mean white. Use canonical [design-system tokens](../apps/mobile/design-system/tokens.css); generated values, spacing, typography and component geometry belong in the implementation.

The shared theme covers Home, Library, Events, Coach, Support, profile/membership, lesson controls, forms and panels. Shared tab headers align title and controls consistently; contextual status follows the title. Detail screens retain named Back actions. Navigation selection, progress and status use text/programmatic state as well as visual treatment.

Use clear labels for actions without decorative arrows or chevrons. The onboarding stage uses open fields, white selection, text navigation and generous hierarchy. The completion review uses a crown motif, a beginning message and editable goal/challenge/growth rows before the Home action. Full questionnaire behaviour is canonical in [member profile/onboarding](features/member-profile-onboarding.md).

## Membership card

Home's compact membership shortcut and Profile's landscape card use brushed graphite, a restrained diagonal reflection, a metallic rim and the crown. Decorative finishes stay static and hidden from assistive technology. The card grows with enlarged text; names and plan labels wrap rather than clipping.

The Profile card shows authoritative plan, status and supplied member identity. Where approved source data exists, expiry appears at bottom left and card reference at bottom right, with accessible descriptions even when visible labels are omitted. The whole card opens membership details alongside the separate account action. The card must not include sample identity or onboarding answers. Production identifier/expiry semantics remain D-20 in [the profile specification](features/member-profile-onboarding.md#unresolved-choices); local demo issuance is not a production identity policy.

## Accessibility

DES-02 requires usable iOS and Android experiences with VoiceOver/TalkBack, enlarged system text, high contrast, reduced motion, software keyboards, hardware keyboards, switch and voice input. Follow the [accessibility procedure](../apps/mobile/ACCESSIBILITY.md) for verification; browser measurements and JavaScript bundles do not establish native conformance.

- Controls have adequate touch targets, visible labels and perceivable focus. Inputs expose names, validation errors and save status to assistive technology.
- Text can grow without a scaling cap or clipped controls. Content reflows in portrait, landscape and short screens; actions and focused fields remain reachable above keyboards and navigation.
- Dialogs/sheets have accessible names and predictable focus containment/return. Route and async updates move or announce focus where needed without hiding member context.
- Selection, expansion, status and progress expose programmatic state and do not rely on colour alone.
- Reduced motion provides immediate usable states. Backgrounded or hidden media pauses; decorative motion never blocks completion or traps focus.

Visual changes must preserve the feature specifications' account, access and persistence rules. Screenshots, audit counts and release sign-offs belong outside `docs/`.
