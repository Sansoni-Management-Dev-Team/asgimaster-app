# AaronAI acquisition workspace

AaronAI now pairs a conversation with a Search Plan or Deal Plan inside the native Coach feature. The existing shared header, mobile frame, typography, tokens, sheets and bottom navigation remain in use.

## Scope

- The opening choices start an empty search or business conversation.
- Chat and Plan show one full-width view at a time. Chat retains its labelled multiline composer; Plan hides it without discarding the draft.
- Replies use an A avatar, open assistant text, compact user bubbles, optional summaries and links to changed plan sections.
- Update links open their parent section and nested category, scroll to the target and move keyboard/accessibility focus there. Opening Plan clears its update badge.
- Search Plan contains the search stage, known industry/location, Buy Box and evidence. Deal Plan adds journey progress, price, applicable checklists, direction, strategies, risks and health categories.
- Facts are available in the “What Aaron is carrying” sheet. Summaries use Expo Clipboard, with announced success and a selectable-text fallback after failure.
- History, stop/retry, access restrictions and reviewed local human handoffs remain available. Starting another conversation preserves previous chats.

This phase makes no backend or public API changes. A normal demo reply stores the member's literal note in evidence as unverified; it does not infer industry, price, scores, confidence or an assessment. Empty sections state what is still unknown.

## Demo scenarios

Open **AaronAI options → Demo settings**. Search, Pre-meeting, Assessment, Funding, Due diligence, Completion and Walked away each create a separate conversation with explicitly fictional details. Existing conversations are retained. Rich summaries and category update links are demonstrated in these examples. The main screen uses one Demo indicator; technical switches remain in Options.

The acquisition model also recognises the pitch stage between funding and due diligence, matching the source journey.

## Persistence

The existing `master-app.native.coach.v1` store gains optional acquisition metadata and optional reply-linked updates/summaries. Legacy saved chats remain readable without fabricated acquisition context or a Plan tab. Valid empty entry selections are saved too. Malformed optional metadata is dropped without discarding valid message history. Drafts retain the existing in-memory, per-conversation lifecycle.

`acquisition.ts` owns local scenario data, literal-note replies and metadata validation; `acquisition-ui.tsx` owns the entry, plan, facts and summary components. The existing model applies plan updates only when a pending reply successfully resolves, so failures, cancellations, lost access and duplicate replies cannot add phantom findings.

## Source references

- [DealMate main screen](https://github.com/MLAI-AUS-Inc/aaron-ai-project/blob/master/frontend/app/page.tsx): entry choices and mobile Chat/Plan switch.
- [Conversation](https://github.com/MLAI-AUS-Inc/aaron-ai-project/blob/master/frontend/components/Conversation.tsx): assistant presentation, plan update links and summaries.
- [Panel](https://github.com/MLAI-AUS-Inc/aaron-ai-project/blob/master/frontend/components/Panel.tsx): current rendered search/deal plan structure and memory sheet.

## Verification — 30 September 2026

- `npm test -- --runInBand`: 14 suites / 153 tests passed. Includes 17 acquisition model/screen tests covering entry paths, legacy restoration, persistence, seven scenarios, drafts, update links, expansion, copy success/failure, stop/retry, restricted access and reviewed handoffs.
- `npm run typecheck`: passed, including generated-token consistency.
- `npm run lint`: passed.
- `npx expo export --platform all --output-dir .expo/aaronai-build-check`: web, iOS and Android bundles exported successfully. This is bundling validation, not a native-device run.
- Browser interaction checks: both entry paths; Chat/Plan and draft preservation; evidence/Numbers link expansion, scrolling and focus; summary copy feedback; facts-sheet focus restoration; all deal stages; history restoration after reload; New conversation.
- Browser layout checks: 320×568, 360×800, 390×844, 430×932, and 844×390. Entry, chat/summary/composer, Search Plan and expanded Deal Plan had no horizontal overflow or measured interactive targets below 48×48. Shared layout lets the footer flow with content on short screens.
- Palette calculation across the background endpoints and used surfaces: normal text minimum 17.58:1; muted text 8.11:1; essential control border 3.93:1; focus indicator 17.58:1. Status meanings also have text or symbols.
- Browser semantics checked for labelled inputs, selected tabs, expanded disclosures, progress text and modal naming. Tab/progress ARIA values are explicit alongside native accessibility properties.

### Device release checks still required

The preview browser ignored zoom shortcuts, so no 200% text-scaling pass is claimed. This Windows session did not provide iOS/Android devices or screen readers. Before declaring accessibility complete, run `ACCESSIBILITY.md` on both platforms, including:

- 200% system font scaling and high-contrast settings across entry, chat, both plans, sheets, summaries and handoffs.
- VoiceOver/TalkBack reading order, selected/expanded values, async announcements and modal/update-link focus restoration.
- Software keyboard visibility with multiline drafts, errors and Send; portrait/landscape and safe-area changes.
- Hardware keyboard, switch input, voice control, reduced motion and grayscale checks.
- An automated accessibility scan with no serious/critical issues; browser DOM checks and token ratios alone are not a full accessibility audit.
