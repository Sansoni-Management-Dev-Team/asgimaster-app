# Mobile Accessibility Standard

## Target

Every production screen targets WCAG 2.2 Level AA. For native or hybrid implementations, apply the W3C WCAG2Mobile and WCAG2ICT interpretation: a mobile screen or view is the equivalent evaluation unit to a web page.

This file is a build and release checklist, not a conformance certificate. The completed application must be tested with real content, device settings, and assistive technologies.

## Perceivable

- Provide text alternatives for meaningful images and hide decorative images from assistive technology.
- Provide captions for prerecorded and live video where applicable, plus audio description or an equivalent media alternative when visual information is essential.
- Preserve meaningful reading order and relationships programmatically; visual placement alone is not enough.
- Do not lock the app to portrait or landscape unless that orientation is essential.
- Keep normal text at or above 4.5:1 contrast and large text at or above 3:1.
- Keep essential control boundaries, focus indicators, chart marks, and selected states at or above 3:1 against adjacent colors.
- Never use color as the only status cue. Pair it with text, an icon, a pattern, or a programmatic state.
- Support text scaling to 200% without clipping, overlap, hidden controls, or lost functionality.
- Support increased text spacing and reflow without two-dimensional scrolling at a 320 CSS-pixel-wide viewport, except for content that genuinely requires two dimensions.
- Provide an accessible text summary or data table for every chart that communicates information not already present nearby.

## Operable

- Make the full app usable with keyboard, switch control, voice control, and screen-reader gestures.
- Keep focus order aligned with the visual and logical reading order.
- Keep the focused control fully visible when headers, bottom navigation, sheets, dialogs, or the software keyboard are present.
- Use at least 48 by 48 CSS pixels for web touch targets. Map this to the platform's accessible touch-target unit in native implementations.
- Separate adjacent targets sufficiently to prevent accidental activation.
- Do not require dragging, swiping, drawing a path, device motion, or multiple fingers without an equivalent single-pointer control.
- Trigger actions on release/click rather than initial touch-down where the platform allows cancellation.
- Do not introduce keyboard traps. Modals and sheets must return focus to their trigger when dismissed.
- Respect reduced-motion preferences. Do not use flashing content above the WCAG threshold.
- Give each screen a unique, descriptive title and expose visible section headings semantically.

## Understandable

- Use persistent visible labels for inputs. Placeholder text is supplementary, never the only label.
- Keep the accessible name consistent with the visible label so voice users can activate controls by speaking what they see.
- Identify required fields before submission and associate hints and errors with their fields.
- Describe errors in text and provide a specific correction. Do not rely on a red outline alone.
- Do not change context automatically when a control receives focus or a value changes unless the user was warned.
- Keep repeated navigation, help, and identification patterns consistent across screens.
- Avoid authentication steps that require memory, transcription, puzzles, or cognitive-function tests when an accessible alternative is available. Support password managers and paste.
- Do not ask users to re-enter information already provided in the same process unless necessary for security or correctness.

## Robust

- Prefer native semantic controls over custom gesture surfaces.
- Expose every control's accessible name, role, value, state, position, and available actions.
- Announce asynchronous status changes such as loading completion, validation failures, saves, and connection loss without unexpectedly moving focus.
- Keep hidden and disabled content out of the accessibility tree when it cannot be used.
- Test screen-reader reading order separately from visual order.
- When embedding web content in a native shell, test both the web semantics and the native-to-web focus transition.

## Platform mapping

| Requirement | Web or hybrid | Native mobile |
| --- | --- | --- |
| Name, role, value | Semantic HTML first; ARIA only when needed | Platform accessibility label, role/trait, value, state, and actions |
| Text scaling | Relative units; zoom enabled; reflow at 320 CSS px | Dynamic Type or platform font scaling with reflow |
| Status updates | `aria-live` or an appropriate live region | Platform accessibility announcement APIs used sparingly |
| Focus | DOM order; visible focus; focus management in dialogs | Logical accessibility traversal order and restored focus |
| Reduced motion | `prefers-reduced-motion` | Platform reduce-motion setting |
| Contrast modes | `forced-colors` and `prefers-contrast` | Platform high-contrast and color-filter settings |
| Touch targets | At least 48x48 CSS px in this system | At least the equivalent platform-recommended accessible target |

## Release gate for every screen

1. Automated semantic and contrast scan has no serious or critical issues.
2. No horizontal overflow at 320, 360, 390, and 430 CSS pixels.
3. Content and controls remain usable at 200% text scaling.
4. Portrait and landscape both work unless orientation is essential.
5. Every action works with keyboard or switch-style sequential focus.
6. Voice-control activation matches visible labels.
7. Screen-reader order, labels, values, errors, and announcements are correct on both iOS VoiceOver and Android TalkBack when both platforms are supported.
8. All touch targets are at least 48x48 and remain separated.
9. Color-blindness and grayscale checks preserve every meaning.
10. Reduced motion removes non-essential animation without removing information.
11. The software keyboard does not cover the active field, error, or primary action.
12. Charts have an equivalent accessible summary or table.

## Current palette contrast guardrail

Against the darkest background endpoint (`#101518`), every semantic palette color exceeds 4.5:1. Against the lighter endpoint (`#283339`), strain blue (`#0093E7`) is approximately 3.90:1 and low-recovery red (`#FF0026`) is approximately 3.25:1. Therefore:

- Use these two colors for non-text indicators that require 3:1 contrast.
- Keep small status text white.
- Do not place small text in these colors over the lighter gradient endpoint.
- Recheck contrast whenever opacity, overlays, photography, or a new surface color is introduced.
