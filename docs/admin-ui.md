# Admin UI quick start

Build a working server-rendered page first, then enhance its links and forms with htmx. The server owns permissions, validation and saved state; the shared browser script handles focus, announcements and native dialogs.

Follow the [README](../README.md#getting-started) for local startup and a fixed browser origin. Required behaviour lives in the [staff interface specification](features/staff-admin-ui.md) and [authentication specification](features/authentication.md).

## Start from these examples

- [Page helpers](../apps/api/src/admin-page.ts): document shell, navigation and full/partial response selection.
- [Staff management](../apps/api/src/admin-staff.ts) and [role service](../apps/api/src/staff-management.ts): admin-only directory, reason forms and atomic permission changes.
- [Member views](../apps/api/src/admin-members.ts): URL-based search, paging and details.
- [Invitation views](../apps/api/src/admin-invitations.ts) and [handlers](../apps/api/src/admin.ts): native form pages, dialog fragments, validation and mutations.
- [Browser script](../apps/api/public/staff/admin.js), [stylesheet](../apps/api/public/staff/admin.css) and [asset handler](../apps/api/src/admin-assets.ts): shared behaviour, appearance and packaged assets.

Use those sources for exact attributes, event payloads and response headers; keep executable examples there.

## Views and requests

Give each replaceable region a stable identity. Keep filters and paging in the URL, and keep search inputs outside the replaced results. Search and paging share a replacement queue so obsolete results cannot win. Mutations use a separate queue that drops duplicate submissions without cancelling a save.

Our htmx integration uses explicit inheritance: check each request's target, swap and queue rather than assuming it inherits them. Match the server's full/partial selection and safe-error policy. Fragment headers select presentation, never permission. See the [htmx docs](https://four.htmx.org/docs/) for the library API.

## Row actions and reason dialogs

1. Show available actions as compact, labelled links directly in the row. Include the record in each link's accessible name. Reserve native `details` for supplementary information.
2. Give each action a GET destination that renders a complete form page. Enhance the link to load that form into the shared dialog host, independently of the navigation queue and without adding a history entry.
3. Open the native dialog after insertion. Keep its outer element stable; replace only its content. The external script remembers the opener, calls `showModal()` and manages dismissal and focus restoration.
4. Identify the record and operation, explain the consequence and request the reason. Submit a real POST form with CSRF protection. Reuse the form's scoped error response to retain entries and show validation inside the dialog. Form replacements skip attribute settling so focused inputs retain their displayed values.
5. After confirmed success, close the dialog and announce the outcome. The invitation handlers refresh the staff view through enhanced navigation; they do not update only the row. Without JavaScript, submission redirects to a complete page.

Allow Escape and Cancel before submission. During a save, keep keyboard navigation usable, explain pending state and block ordinary dismissal until the request settles. A browser-forced close must release the page lock; it does not cancel the mutation. Restore close/recovery controls after failure. An uncertain outcome calls for reviewing current records, not automatically replaying the mutation.

The [htmx modal example](https://htmx.org/examples/modal-custom/) illustrates loading server HTML. Use our native dialog and external-script approach rather than copying its overlay or inline Hyperscript. [Pico](https://picocss.com/docs/modal) supplies styling, not behaviour.

## Styling and stable loading

Use vendored Pico with small application overrides. Retain its licence; Pico is [unmaintained](https://picocss.com/docs/maintenance), so we own compatibility fixes. Keep tables compact and diagnostics separate from the main task.

Both normal and pending button labels occupy the same grid cell and contribute to intrinsic size. Switch visibility and disable the submitted button; do not resize it. Keep routine loading announcements out of document flow and suppress generic busy spinners on whole regions. Preserve existing content while requests run.

## Before submitting a change

Check real emitted headers and focus behaviour as well as HTTP tests. Exercise slow requests, errors, stale forms, session expiry and repeated actions. Measure control dimensions during loading. Test complete pages with scripts disabled, populated tables at narrow widths and dialog keyboard behaviour. Keep evidence in the PR or thread artifacts.

Reuse existing auth/CSRF and safe-HTML handling. Keep authentication as full browser navigation, scripts external and protected HTML out of persistent browser caches. Use the README's fixed-origin setup for previews.
