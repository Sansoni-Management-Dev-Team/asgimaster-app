# Master App web prototype

This is the existing mobile-first browser prototype, imported on `codex_shan`
as a self-contained design and interaction reference. The repository's native
Expo app remains in `src/`; no native screen is replaced or wired to a WebView.

[Live onboarding preview](https://master-app-onboarding.drsamdonegan.chatgpt.site/app/#onboarding)

## Run locally

From the repository root, using the repository's Node 22+ runtime:

```sh
npm run prototype:web
npm run prototype:web:test
```

Open `http://127.0.0.1:4173/app/#onboarding`. If that port is already in use,
run `node prototypes/member-web/app/server.js 4174` instead and use port 4174.
The server listens on loopback only and serves files from this prototype's
`app/` and `design-system/` directories, with media byte-range support.
There is no npm install or build step for the prototype.

## Included

- `app/`: browser UI, local state models, Node regression tests and preview server.
- `app/assets/video/`: six original silent gradient placeholder videos, captions
  and poster. These are not course recordings. They total about 5.5 MB.
- `design-system/`: the exact shared CSS palette, typography and components used
  by the prototype. Licensed commercial font files are not included; sans-serif
  fallbacks remain in use.
- `ACCESSIBILITY.md`: mobile implementation and device-release checklist.

The main surfaces are onboarding, Home, Library and video playback, events,
AaronAI demo coaching, support conversations and profile/membership settings.
The preview uses hash routes, such as `#home`, `#library`, `#coach`, `#events`,
`#support` and `#profile` after `/app/`.

### Onboarding

Stage 1 asks for industry, a free-text role/job title, work type (Employee or
Business owner), and a conditional annual income range. Stage 2 separately asks
for a tangible 12-month goal, the biggest challenge, and skills to develop.
Each screen presents one question. Back/edit and reload preserve local answers;
changing work type clears an incompatible income answer. Completion opens an
editable goals summary and then Home.

Question entrances respect reduced motion. Full-width primary buttons reuse the
same solid teal pill component throughout the prototype. The message composer
keeps an accessible label without a visible caption.

## Integration boundaries

- This import does **not** port the prototype to React Native or change Expo
  Router, NativeWind, providers, EAS configuration or native dependencies.
- Authentication, AI replies, support delivery, payments and member identity
  are demo behavior, not connected production services.
- Answers and other prototype state stay in the visitor's browser storage.
  No real customer records, browser profiles or stored answers are in this repo.
- Keep native implementation work within the root `AGENTS.md` conventions.
  Use this prototype to review flows and visual intent before porting features.
- The existing live preview is hosted separately. Pushing this GitHub branch
  does not publish or replace that site.

## Safe import scope

The import contains app source, runnable tests, preview tooling and required
runtime assets only. It excludes original business documents and design PDFs,
meeting records, temporary QA output and machine-specific browser scripts,
dependency caches, environment secrets, the separate Sites checkout, deployment
archives and nested Git history. Browser QA from the original workspace is not
claimed as a portable test command here.

The Node regression suite is isolated from native Jest. Native ESLint and root
Prettier also exclude this directory so importing plain browser JavaScript does
not change the native toolchain. There are no imports from `src/` to this folder.
Real-device screen-reader, text-scaling and keyboard checks remain release
requirements; this prototype is not a WCAG conformance certificate.

## Import verification

Verified on 10 September 2026:

- Native `npm run lint` and `npm run typecheck` pass.
- Native `npm test -- --runInBand` passes its existing screen test and does not
  discover the prototype's Node tests.
- `npm run prototype:web:test` passes all 125 regression tests.
- All 63 imported source/asset files match their local originals byte-for-byte.
- A local HTTP smoke check passes for app assets, media byte ranges and blocking
  access to repository files outside the prototype's served directories.
- `src/`, native build configuration and the dependency lockfile are unchanged.
