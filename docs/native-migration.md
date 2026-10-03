# Native migration

## Step 1 — foundation and member entry

The Expo application now implements the invitation, email-entry validation and an explicitly labelled sign-in demonstration with native React Native controls. It uses Expo Router, safe-area insets and a keyboard-aware scrolling layout. Email exists only in component memory: no request, authentication, account creation or persistent storage occurs.

The demonstration confirms that no email was sent, then offers Continue to onboarding. Member screens will follow in subsequent steps. The web prototype remains independently runnable.

### Visual source

`design-system/tokens.css` is copied from the current Master App workspace design system, including its newer monochrome tokens. The earlier member-entry demo retains its teal/dark palette. Onboarding uses the user-confirmed Concept 2 monochrome design described below. The archived prototype under `prototypes/member-web` is preserved.

Run `npm run tokens:sync` after editing the canonical CSS. It resolves CSS aliases into `src/theme/tokens.generated.json`, consumed by NativeWind's `tailwind.config.js` and native component styles. `npm run typecheck` checks for token drift. Do not edit the generated JSON or hard-code alternate brand colours in components.

Native `AppButton`, `AppField`, `AppScreen` and `AppText` map the existing CSS component patterns to native controls. Commercial Proxima Nova and DINPro files are not bundled; documented sans-serif fallbacks are used. No custom font is claimed as installed.

### Accessibility and validation

The app permits both orientations, uses a 480-unit maximum content width, allows text scaling without a multiplier cap, uses touch targets of at least 48 units, exposes visible input labels and error announcements, and avoids transition animation. Actions scroll with the page, so a sticky footer does not cover form content.

Automated tests cover invitation navigation callbacks, invalid email handling, keyboard submission, the honest demo confirmation, editing the address and direct-link back navigation. These do not replace actual navigation/device and assistive-technology checks.

Release status: **development preview; real-device accessibility validation pending**. Complete `ACCESSIBILITY.md` on iOS and Android, including VoiceOver, TalkBack, switch input, 200% system font scale, high contrast, landscape and software-keyboard behaviour before declaring these screens complete.

### Verification on 23 September 2026

- TypeScript, token consistency, ESLint and all four native component/interaction tests pass.
- Expo production export produces iOS and Android Hermes bundles and static web routes. These are JavaScript bundles, not signed native binaries.
- The browser rendering of the native components was checked at 320×568, 360×800, 390×844, 430×932 and 844×390, across Invitation, Sign in and the confirmation state, at normal and simulated 200% text size: 30 scenarios.
- Those scenarios have no horizontal page overflow, clipped text width, touch targets below 48×48, or serious/critical axe accessibility findings. Actual browser routing, invalid-input focus, keyboard submission, editing and back navigation pass, with no JavaScript runtime errors.
- High-contrast browser rendering and landscape screenshots were reviewed. Enlarged-text simulation in a browser does not replace native Dynamic Type or Android system-font tests. VoiceOver/TalkBack, switch/voice input and real software-keyboard checks remain unverified because no device/simulator is configured in this environment.

## Step 2 — onboarding, editing and saved progress

### Source and scope

The visual source is the user-confirmed **Concept 2: Video + rotating envelope**, in the outer workspace `app/concepts/concepts.js`, `concepts.css`, `envelope.js`, `envelope.css` and associated media. This replaces the previous teal onboarding implementation. The validated seven-answer schema still follows `app/onboarding-model.js`; existing native saved answers are preserved.

The sequence is rotating envelope → name confirmation over the customer film → handwritten letter → introductory message → ownership intent → direction message → industry → role perspective → income/revenue → 12-month goal → challenge → skills → saved-answer review → Home. The review retains an Edit action for each answer. Its primary action is now Enter my empire.

The opening uses the original bundled 16.8-second silent customer montage and poster, the original Caveat Medium font and a native SVG/Animated rendition of the envelope. Rotation arrives at 5.9 seconds; explicit name confirmation opens the flap and lifts the letter. The video fades in at name confirmation, fades away after the letter opens, and pauses when hidden. The only animation control is **Replay invitation**, available throughout arrival, name confirmation, opening and the revealed letter. It restarts the envelope and film from the beginning, including when pressed during arrival, while retaining the entered name. Pause/play, skip and show-letter controls have been removed for the Phase 2 direction. Reduced motion shows the sealed envelope and poster immediately, then reveals the letter without animation after name confirmation; the video stays paused. Backgrounding or leaving the screen pauses playback. A video failure leaves the poster and the invitation usable. Names are session-only; the fixed 031 / 300 edition is reference artwork, not a live allocation counter.

Accepting the revealed invitation fades the letter and its controls smoothly to pure black over 750ms before the introduction begins. Accept and replay are disabled during the fade to prevent repeated navigation; reduced motion advances immediately.

All seven questions now enter in a sequence: the heading and its supporting copy lead, followed by each option with a 140ms stagger, then any text field and the navigation controls. Each part fades in with a small upward movement while keeping its layout space reserved. The first answer begins 420ms after the heading; reduced motion shows everything immediately. Unrevealed controls remain outside pointer, keyboard and accessibility interaction until visible. The sequence pauses in the background, restarts when returning to a question, and does not restart while typing or selecting an answer. The existing whole-screen exit fade is retained.

Question entrance verification: 15 onboarding tests cover all seven question sequences, reduced-motion readiness, stable entrances during answer changes, and the existing save/navigation flows. Browser frame sampling confirms heading-first staggered arrival for choice, industry and text-answer screens. The decision screen has no horizontal overflow or targets below 48px at 320×568, 360×800, 390×844, 430×932 and 844×390; keyboard focus reaches the selected answer. Native VoiceOver/TalkBack and 200% device text scaling still require device validation.

Questions use a black stage, centered copy, open text fields, text-only Continue/Back actions, and white selected options. The teal buttons, dashboard header, counters and bordered cards are removed from onboarding. Industry offers six shortcuts plus Other industry. Selecting a choice holds for 500ms before saving and advancing; selecting again resets the delay, and Back or custom-field focus cancels it. Keyboard focus alone does not advance. The introductory messages can be skipped, and route replacement prevents Back from looping through them. Existing concept-screen fades and reduced-motion alternatives are represented with native animations.

| Question                | Validation and behaviour                                                                             |
| ----------------------- | ---------------------------------------------------------------------------------------------------- |
| Ownership intent        | One of the four existing choices is required.                                                        |
| Industry                | Trimmed, nonempty text, maximum 120 characters. Unicode is accepted.                                 |
| Role perspective        | One of the five existing role choices is required.                                                   |
| Income/revenue          | Business owners choose annual revenue from four ranges; other roles choose annual income from three. |
| Goal, challenge, skills | Each requires nonempty text up to 1,000 characters. Multiline input is supported.                    |

Changing a role within the same income branch retains its range. Changing branches clears an incompatible range and requires a replacement. Valid goal, challenge and skills answers remain intact. Completion is derived from validated answers, never from a stale completion flag. Direct links cannot bypass missing prerequisites; the old occupation step maps to income.

### Navigation and persistence

- Back revisits the preceding question with its saved answer or session draft. Native stack navigation also gives system Back a previous screen during the forward journey.
- Edit opens the selected answer from the review; Cancel edit restores its saved value. Saving a valid edit returns to the review, unless the role change requires a new income answer.
- Valid automatic selections and Continue/Save changes write to AsyncStorage **before** committing state or advancing. Duplicate writes are blocked. A failed write leaves the draft and prior saved answers intact, displays an error and permits retry by reselecting or submitting again.
- Loading finishes before answers can be written. A failed read offers Retry loading progress and cannot overwrite unread data. Malformed records show a recovery notice; valid version-1 fields are sanitized on restoration.
- Submitted answers survive reload/relaunch. Unsubmitted drafts are session-only. Opening `/onboarding` resumes the earliest missing answer, or Home if all seven are valid. Home's View my direction opens the review explicitly with `step=complete&from=home`.
- The versioned storage key is `master-app.native.onboarding.v1`. AsyncStorage 2.2.0 matches the Expo SDK 57 bundled version. This is device-local, unencrypted demo storage, separate from the web prototype's storage. It does not automatically transfer existing browser data, authenticate a member or sync across devices. Before real accounts are enabled, scope/clear local state by member and connect appropriate backend persistence. Credentials must not be stored here.

The state/model and cinematic components live under `src/features/onboarding`; `src/app/onboarding.tsx` provides the route. The onboarding palette derives from the existing monochrome tokens, overriding the general teal guidance as explicitly requested. Controls use minimum 48-unit targets, scalable text, accessible field names, inline errors, radio state and save announcements. The browser rendering additionally supports Space/Enter, arrow-key radio selection, visible focus and live-region errors.

### Verification on 23 September 2026

- TypeScript, token consistency, ESLint and all 34 unit/native component tests pass. Tests cover choices, text limits, branching, legacy record handling, route guards, hydration, save failure/retry, duplicate submissions, persistence, edit cancellation and routing callbacks, including the latest-choice delay and cancelling pending choices with Back.
- The final Expo production export passes for iOS and Android Hermes bundles and all static web routes. These are JavaScript bundles, not signed or device-tested native binaries.
- Browser checks confirm the actual muted looping video is decoding and advancing, video/envelope pause and resume work, empty names are rejected, the letter precedes its CTA, and the name is not persisted. The journey covers both interludes, all seven questions, white automatic selections, focus without navigation, Back with draft preservation, refresh, editing/cancellation, income invalidation, save failure/retry and completion restoration. Reduced motion and blocked-video fallback were also exercised.
- The name-confirmation screen, revealed letter, all seven questions and the review passed 100 browser layout/accessibility scenarios: 320×568, 360×800, 390×844, 430×932 and 844×390, each at normal and simulated 200% text. No horizontal page overflow, clipped text width, sub-48×48 controls, WCAG-tagged axe findings or JavaScript runtime errors were found. Opening, letter and question screenshots were compared with the original Concept 2 reference.
- Native-device VoiceOver/TalkBack, switch/voice input, system text scaling, high contrast and software-keyboard checks remain pending. Browser tests and Hermes exports do not certify a native binary or WCAG conformance.

The opening alignment was subsequently corrected: both envelope faces rotate around their center without the original web prototype's left-pivot horizontal compensation, and the approach animation and controls are vertically centered. Frame-by-frame browser checks of the full rotation pass at all five viewport sizes above without horizontal clipping; the revealed letter remains centered. Pause/skip controls remain usable at simulated 200% text on the smallest portrait and landscape sizes. TypeScript, ESLint and iOS/Android/web exports pass after this correction.

The closed envelope now renders its front and flap as one SVG surface during the spin. The reverse applies its local 180-degree flip after the shared rotation, keeping both faces in the same plane. This fixes intersecting faces and the flap showing through the back. Before/after animation captures reproduce and verify the correction; projected face bounds match throughout the rotation, and the layered flap/letter animation begins only after name confirmation.

Stage changes now move the envelope from its current displayed position to its measured layout destination with a 700ms ease. The layout slot and artwork are separate so mounting the name form, beginning the opening, and revealing the letter cannot snap the artwork into a new position. Interrupted transitions continue from the current position; reduced motion applies the destination immediately. Frame sampling checks arrival/opening handoffs across the five viewport sizes, including rapid skip/confirm. Landscape checks account for the existing focus-driven scroll to the letter. The invitation and letter also pass 20 normal/enlarged-text layout/accessibility scenarios, and the onboarding journey and iOS/Android/web exports pass.

Accepting the envelope reserves the full final action area immediately, including the actual CTA height at larger text sizes. The single replay control stays in the same row throughout opening and reveal; the CTA is invisible, disabled and excluded from accessibility until the letter is revealed. Revealing it changes visibility only, so the letter and envelope do not need to move again to make room for the button. Earlier pause/skip verification above describes the previous controls.

## Step 3 — enter Home after onboarding

**Phase 2 first-run update (September 29):** The current entry opens Home, including for new and partially set-up members. Empty Home launches/resumes onboarding. Completed responses now populate the Home direction and default 52-week plan and guide lesson recommendations; saved activity and custom plan edits are preserved. New data starts with zero learning activity. The older guarded-entry and separate sample consultation-plan behaviour described below is historical. Profile and membership now have distinct finished layouts, accurate entitlement/status explanations and a non-destructive empty Home preview. See `phase-2-visual-alignment.md` for current behaviour and validation.

The review now offers **Enter my empire**. It clears the native question stack and opens `/home`. A session entry guard redirects stale browser question history to Home. On relaunch, entry is derived from the seven validated saved answers; no new persisted completion flag can become inconsistent with the answers. Incomplete progress resumes its first missing question; failed reads offer retry without bypassing onboarding. Explicit `/onboarding?step=welcome` replays the full invitation and question flow, including for members with completed saved answers. Its onward routes carry `replay=1` so accepting the invitation or reloading a question cannot trigger the normal returning-member Home redirect. Saved answers remain available to review and change; Home opens from the final Enter my empire action.

Profile → **View my direction** opens the existing review with `from=home`, preserving that context through edits and any replacement income question. The primary review action then reads **Back to Home**. The consultation plan shown on Home is separate from the onboarding direction, as in the original app. **View my plan** opens its own persistent goal, success outcome and timeframe editor.

The Home migration was rebuilt against the running original at `app/#home`, its `home.js`, `home.css`, `home-model.js`, member navigation and related lesson/event models, plus the supplied screenshot. Native components under `src/features/home` now preserve:

- Today and the profile avatar; course, learning and weekly-action rings with accessible progress summaries.
- Membership/support cards and membership notices; My day, Your next move, conditional Continue watching, included/registered next event, goal-ranked recommendations, weekly actions and AaronAI guidance.
- The original learning action and five navigation tabs. The footer stays fixed on ordinary portrait screens and flows with the content on short or enlarged-text layouts.
- Progress details, weekly focus/reflection validation, editing/cancellation, saved state and failed-write retry. Notes accept 1–400 trimmed characters. Plan and lesson changes also update Home.

The initial returning-member fixture matches the original: 2 of 6 lessons complete, 26 learning minutes and 1 of 3 weekly actions. Its half-watched blueprint produces **Continue learning**. Removing that partial position gives the supplied screenshot's **Start learning** state with the same rings; both are tested. Profile's demo settings can preview other membership/progress states.

At this step, Home actions opened native entry views for Library, lessons, Events, Coach, Support, Profile/Membership and the plan editor. Step 4 below replaces the first four entry views with their complete prototype workflows. The six bundled videos are copied unchanged from the original: silent decorative previews, not spoken lessons. The SDK 57 web readiness event is handled separately because its player does not emit `sourceLoad`. The local static preview server must support HTTP byte ranges for seeking.

Member progress uses `master-app.native.member.v1`; sample conversations use separate versioned native keys. Writes are serialized, failed note/plan saves keep the previous saved data, and failed reads require retry. Existing current-week notes from the earlier `master-app.native.weekly-focus.v1` preview are carried forward. As with the web prototype, demo weekly activity is not connected to a live reporting calendar. This is device-local demo storage, not authenticated or synced. Existing web storage is not automatically imported, and no real event booking, consultant request or support message is sent.

### Verification

- TypeScript, token consistency, ESLint and all 56 unit/component tests pass, covering entry routing, stack reset, returning/incomplete members, deliberate review, original dashboard rules, access, recommendations, event priority, note/plan validation, progress persistence, storage failure/retry and a pending completion write during player navigation.
- Final Expo exports pass for iOS and Android Hermes bundles and all static web routes. These are JavaScript bundles, not signed or device-tested native binaries.
- Browser end-to-end checks cover actual question completion → **Enter my empire** → Home, browser Back, direct Home guards, reload/relaunch, review/edit/return, focus/reflection saves and failed-write retry, lesson resume/play/pause/seek/completion, event reservation/cancellation, membership/support handoffs, plan edits and all five tabs.
- Home, the progress panel and weekly-focus form pass 30 layout/accessibility scenarios: 320×568, 360×800, 390×844, 430×932 and 844×390, each at normal and simulated 200% text. Eight linked entry views also pass baseline phone checks. No horizontal page overflow, clipped text widths, sub-48×48 app controls, WCAG-tagged axe violations or runtime errors. Keyboard activation, dialog focus containment/return and browser high contrast were checked.
- Home screenshots were compared against the running original at phone widths. The lesson media remains placeholder content; native playback, captions for real lesson media, fullscreen and device lifecycle behavior need device validation.
- VoiceOver/TalkBack, native system scaling, switch/voice input and device software-keyboard checks remain pending; browser checks and native JavaScript exports do not certify a release build.

## Step 4 — Library, Events, Coach and Support

The running original `app/#library`, `#events`, `#coach` and `#support`, their CSS, model and controller files are the reference. Their collection artwork, header hierarchy, dark surfaces, teal accents, fixed navigation, request/chat cards and panel patterns are implemented with React Native components. Controls are phone-first, at least 48 units, keyboard accessible in the web preview, and scroll at enlarged text sizes and in landscape.

The pure business-rule modules from `app/library-model.js`, `events-model.js`, `coach-model.js` and `support-model.js` are retained as JavaScript with TypeScript declarations under their corresponding `src/features/` directories. JavaScript is supported natively by React Native; these modules contain no DOM rendering. Native stores provide explicit storage adapters to their loaders, replacing browser persistence with AsyncStorage. The UI does not use a WebView or embed the original HTML.

| Tab | Migrated behavior |
| --- | --- |
| Library | Five collections and eight catalogue entries; Included/Explore all; token search; collection/progress filters; counts and completion; locked/unavailable states; related events; loading/error/empty previews. |
| Player | Six original media previews; Play/Pause/Resume; explicit seek and +/-10 seconds; playback speed; platform fullscreen plus accessible web fallback; missing-recording recovery; visual description; collection-bounded Previous/Next; saved resume; actual watched time excluding seeks/background time; explicit or end-of-media completion without automatic next playback. |
| Events | Upcoming/My events; formats/months; details, plan, preparation and agenda; local registration; cancellation confirmation and pass revocation; new pass revision on re-registration; in-person sample QR/online access; calendar, wallet and offline previews; simulated check-in; retained attendance and rolling future cohorts. Attendance updates Home/plan progress separately from lessons. |
| Coach | Original scripted guidance and entitlement-checked lesson links; saved history/new/delete confirmation; no daily prompt, message-count or conversation-count cap; 2,000-character messages; pending/stop/fail/retry; interrupted request recovery; waitlist/unavailable/read-only states; demo waitlist; editable, reviewed handoff with sharing off by default. Only the reviewed snapshot is included in the resulting Support thread. |
| Support | Topics and consultant access; validation and failed-send draft retention; current/history inbox; request IDs and direct links; replies/status/unread state; resolution confirmation/reopening; original request/message capacity checks; simulated agent replies; saved push/reply preferences and generic in-app notification previews that open the exact thread. |

Selectors expand inside existing panels rather than presenting a second native modal. In the web preview, focus returns to the initiating control and checked/selected/expanded states use explicit ARIA counterparts. Native screen-reader and platform keyboard behavior still require device validation.

### Data and service boundaries

- `master-app.native.member.v1` continues to store Home, plan and lesson progress. Existing onboarding data is unchanged.
- `master-app.native.events.v1` imports earlier `member.v1` local reservations once, retaining their event IDs. Existing cancellations are not re-imported after the new store is created.
- `master-app.native.coach.v1` and `master-app.native.support.v1` import the earlier `*.home-preview.v1` conversations once. The old records are retained. Support assistant messages become explicitly labelled sample agent messages.
- `master-app.native.notifications.v1` stores the independent push/reply preview preferences. Unsent message drafts, filters and demo availability switches are session-only, matching the prototype's local behavior.
- Writes are serialized. Unread storage blocks mutations until retry. Failed conversation/event saves keep changes in memory, show a visit-only warning and offer Retry saving. Successful retry clears the warning; no claim of cross-device sync is made.
- Media remains silent placeholder footage, with no speech or caption cues. Production lesson videos, captions and native fullscreen playback must be validated with real media.
- No real AI, consultant, support agent, registration, QR admission, calendar, wallet, push subscription or account service has been enabled. These screens preserve the original prototype's demo boundaries. Authenticated server access checks and member-scoped persistence remain future work.

### Verification

- TypeScript, token consistency, ESLint and 74 Jest tests pass, including original onboarding/Home tests, full module business rules, unlimited Coach history, exact handoff snapshots, attendance separation, save ordering/retry and earlier native data migration.
- Full browser journeys exercise Library filtering/access, player resume/seek/speed/fullscreen/fallback/error recovery/completion, event cancellation/re-registration/check-in, Coach history/retry/stop/waitlist/deletion/handoff, and Support validation/failure/reload/resolution/notifications.
- Main screens and panels pass 64 layout/axe checks across 320×568, 360×800, 390×844, 430×932 and 844×390 at normal and simulated 200% text. Detail and expanded-panel checks additionally cover event passes, Coach and Support threads, playback options, notification preferences, handoff review and selectors. Checked: width clipping, page overflow, 48-unit targets, keyboard focus containment/return and high-contrast browser rendering.
- Expo exports compile iOS and Android Hermes bundles and static web routes. These are production JavaScript exports, not signed device binaries. VoiceOver/TalkBack, real system text scaling, switch/voice input, native fullscreen and software-keyboard checks remain pending on devices; this is a development preview, not accessibility release certification.

## Next increments

1. Inspect and migrate the remaining Profile/account-management workflows beyond the current Home handoffs.
2. Connect authentication and backend services; enforce membership access on the server and replace demo fixtures with production data and captioned media.
3. Complete device accessibility, end-to-end tests and release builds.

Work on one reviewable increment at a time. A successful browser preview or JavaScript bundle is not evidence of a tested native binary.
