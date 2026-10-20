# AaronAI acquisition workspace

## Outcome and scope

Requirements: AAI-01–AAI-06. The coaching workspace pairs a conversation with a Search Plan or Deal Plan, so the member can see what was learned, what remains unknown and what to do next. D-33 includes AaronAI in the intended member experience; the release boundary remains D-26 in [member experiences](features/member-experiences.md#unresolved-choices). Service integration and history ownership remain D-12 in [HLDD 03](hldd/03-integrations.md#aaronai).

## Conversation and plan

Opening choices start an empty search or business conversation. Chat and Plan show one full-width view at a time. Chat has a labelled multiline composer; switching to Plan hides it without discarding its draft. Starting a new conversation preserves earlier history; deleting a conversation requires confirmation.

Assistant replies use open text with an A avatar; member messages use compact bubbles. A reply can include a summary and links to changed plan sections. A link opens its parent section/category, scrolls to the relevant content and moves keyboard/accessibility focus there. Opening Plan clears its update badge.

Search Plan carries search stage, known industry/location, Buy Box and evidence. Deal Plan adds journey progress, price, applicable checklists, direction, strategies, risks and health categories. The journey recognises the pitch stage between funding and due diligence. Missing facts stay unknown; member notes must not be transformed into invented prices, scores, confidence or assessments. Evidence distinguishes a member's unverified note from a verified finding.

“What Aaron is carrying” exposes the current facts in a sheet. Summaries support copying with announced success and a selectable-text fallback if clipboard access fails. Stop/retry, access restrictions and readable history remain available. Failed, stopped, duplicate or no-longer-authorised replies must not introduce phantom plan findings.

## Persistence and human handoff

Saved history remains readable even if optional acquisition metadata is absent or malformed; losing optional plan metadata must not destroy valid messages or invent a plan. Drafts remain associated with their own conversation. Account isolation and logout follow [authentication](features/authentication.md).

A human handoff is explicitly reviewed. Sharing is off by default; only the reviewed snapshot is included in the resulting support conversation. It must not silently transmit the entire history or create an implied consultant booking. Service availability and the approved vendor handoff contract determine whether a live handoff can be delivered.

Demonstrations must be explicitly fictional and separate from live member findings. A demo reply or saved local plan must not claim real AI assessment or contact with a human. Demo settings are not part of the required production experience.

## Acceptance criteria

- Both entry choices start an honest empty conversation; Chat/Plan switching and history navigation preserve the correct drafts and history.
- Search and Deal Plans display known evidence and unknown sections without fabricated assessments.
- Update links and sheets expose understandable focus, expanded state and announced actions under the [shared accessibility requirements](phase-2-visual-alignment.md#accessibility).
- Stop, failure, retry and access loss cannot duplicate replies or add findings that never completed.
- A reviewed handoff shares exactly the selected snapshot, with consent, and reports actual submission state truthfully.
- Another account cannot read the conversation, plan or draft.

## Unresolved choices

D-12 covers API/auth/streaming, member-keyed history/plan ownership and inference residency/retention. D-13 covers product name; AAI-05 requires copy that can follow the approved name without embedding an unapproved brand. AAI-06 covers the live human-handoff contract. Existing UI design does not settle any of those service/privacy choices.

## Design references

The [source main screen](https://github.com/MLAI-AUS-Inc/aaron-ai-project/blob/master/frontend/app/page.tsx), [conversation](https://github.com/MLAI-AUS-Inc/aaron-ai-project/blob/master/frontend/components/Conversation.tsx) and [plan panel](https://github.com/MLAI-AUS-Inc/aaron-ai-project/blob/master/frontend/components/Panel.tsx) are visual references, not this app's backend contract or evidence of a live integration.
