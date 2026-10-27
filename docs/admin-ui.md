# Admin UI quick start

The staff website is HTML rendered by the API. Start with a working link or form; use htmx to replace the relevant part of the page. The server owns permissions, validation and saved state. Small browser behaviours belong in the shared external script.

For local startup and a fixed browser origin, follow the [repository setup](../README.md#getting-started). Required behaviour is canonical in the [staff interface specification](features/staff-admin-ui.md); invitation and permission rules belong to [authentication](features/authentication.md).

## Find an example

- **Page shell and navigation:** [page helpers](../apps/api/src/admin-page.ts). Reuse the shell rather than returning a second document inside a fragment.
- **Search, paging and detail pages:** [member views](../apps/api/src/admin-members.ts). Keep search inputs outside the replaced results so typing retains focus.
- **Forms, values and field errors:** [invitation views](../apps/api/src/admin-invitations.ts).
- **Authorisation, CSRF, response selection and mutations:** [admin handlers](../apps/api/src/admin.ts). Reuse the domain services rather than implementing business rules in templates.
- **Browser events, recovery and announcements:** [shared script](../apps/api/public/staff/admin.js).
- **Appearance and asset packaging:** [stylesheet](../apps/api/public/staff/admin.css) and [asset handler](../apps/api/src/admin-assets.ts).

Read those examples directly for exact attributes, event payloads and response headers. Keep executable examples in source, rather than copying them into this guide.

## Styling approach

Use locally vendored [Pico CSS](https://picocss.com/docs) as the semantic foundation, with a small application stylesheet for compact tables, toolbars and action controls. Retain its licence and attribution. Pico is [no longer maintained](https://picocss.com/docs/maintenance), so vendoring means owning compatibility and accessibility fixes. The package choice does not replace the interaction requirements in the feature specification.

Prefer ordinary HTML elements and a few shared layout classes. Tune component spacing deliberately: large form controls should not dictate table-row height. Keep technical diagnostics and long explanatory content outside the primary working table.

Loading is a state of the existing interface. Keep button labels in the same grid cell so both labels contribute to intrinsic width, changing visibility rather than removing a label from layout. Disable the submitted button with htmx's request lifecycle. Keep routine announcements out of document flow, and suppress generic framework spinners on whole content regions. Test dimensions while a request is deliberately delayed, rather than relying on a fast local response.

## Recipe: add a view or search

Build the complete GET page first. Represent filters and paging in its URL, so a copied link or reload returns the same view. Render member text through the existing escaping template helpers.

Give the replaceable region a stable identity. Enhance the link or form with a request, target and swap strategy. The handler must deliberately select a full document or the corresponding fragment. Use the response-selection and variation conventions in the page helpers; fragment headers select presentation, never permission.

For search, share the existing replacement queue with paging, preserve the input, and let a newer query supersede an older one. For a mutation, use an independent queue that drops duplicate submissions rather than allowing a search or navigation request to cancel a save.

## Recipe: row action → reason dialog

Use this composition for contextual staff actions:

1. Show compact, labelled action links directly in the row. Each link identifies both the action and its record for assistive technology. Use native `details` for supplementary explanations, such as source connection information.
2. Each action has a real GET destination that renders a complete form page. Choosing an action only loads a form; it must not mutate anything.
3. Enhance that link to load the form into a dedicated dialog host. Keep this request separate from the main view's search/navigation queue and avoid adding a history entry just for opening a dialog.
4. Use native `dialog` and `showModal()` for the modal layer. Remember the opener and open the dialog after its content is inserted. Put this glue in the external script. Do not add inline handlers, injected scripts or Hyperscript attributes.
5. Show the record, chosen operation, required reason and any consequence. Submit a real POST form with the normal CSRF field. Cancel and close controls must not submit it.
6. Replace the form content on validation or recoverable failure, keeping the dialog open and retaining entries. Reuse the existing safe-HTML response policy; a new fragment target must be recognised by both server and browser handling.
7. After confirmed success, close the dialog, update the affected information and announce the outcome through the shared persistent live region. Restore focus to the opener, or a sensible nearby control if that row disappeared. The native form path redirects to the resulting complete page.

Keep one dialog host, outside replaceable table rows. Replace its inner form content rather than replacing an open dialog element and losing its modal state. Handle Escape, Cancel and explicit close through the same cleanup path. Allow dismissal before submission; while a save is pending, prevent dismissal while keeping keyboard navigation within the form usable, explain the pending state, and restore dismissal when it settles. After an uncertain network outcome, keep the entered values and offer review rather than automatically resubmitting.

The [htmx custom-modal example](https://htmx.org/examples/modal-custom/) demonstrates loading server HTML into a modal. Adapt the concept to our native dialog, external-script CSP and installed htmx API; do not copy its custom overlay or inline scripting. [Pico's dialog](https://picocss.com/docs/modal) provides styling, not the request lifecycle.

## Recipe: handle a response

Follow the existing invitation handlers for successful enhanced navigation, ordinary redirects, validation and stale-token recovery. Keep status codes meaningful. Only explicitly approved staff HTML may replace an error target; a generic API error or sign-in document must not appear inside a dialog.

Our htmx configuration uses explicit inheritance. Do not assume a parent's target, boost, swap or queue applies automatically. Use the installed API's event names and Fetch context, and the server's matching target representation. The [htmx documentation](https://four.htmx.org/docs/) explains requests and swaps; the shared script is authoritative for our integration.

Authentication navigation stays a complete browser navigation. Do not weaken origin or token checks for development: use the fixed-origin setup in the README. Do not introduce a protected-page history cache to make dialogs or Back navigation work.

## Check a new interaction

Exercise the actual browser path as well as HTTP tests: emitted headers and inheritance, keyboard opening/closing, focus after errors and success, repeated actions, slow responses, timeout, session expiry and stale forms. Check the native full-page path with scripts disabled. For actions inside scrollable tables, check narrow layouts; for dialogs, check zoom, focus containment and accessible names. Use populated tables with several actionable rows, not only an empty state.

Keep verification results with the PR or thread artifacts. Keep this guide focused on reusable development conventions.
