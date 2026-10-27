# Staff admin interface

## Outcome and boundary

Authorised staff can find members, understand their records and complete member operations through a clear browser interface. This specification owns presentation and interaction conventions, including behaviour required of features not yet delivered. It does not establish delivery status.

The admin uses server-rendered semantic HTML, a shared CSS stylesheet and progressive enhancement with htmx. The server owns validation, authorisation and durable state. The interface should remain straightforward to develop and operate as member-management workflows grow. Concrete routes, templates, assets and library versions belong in [the API implementation](../../apps/api/).

Required authentication and invitation behaviour is canonical in [authentication](authentication.md). Member records, source truth, identity and access policy are canonical in [access and identity](access-identity.md). The platform boundary is in [HLDD 01](../hldd/01-platform-api-admin.md).

## Presentation

- Use one consistent staff layout with a clear page title, primary navigation, current-location indication and an accessible sign-out action. Sign-in uses a simpler version of the same visual language.
- Use a compact, table-oriented presentation: readable typography, restrained colour, subtle borders, clear grouping and generous enough spacing to distinguish records and actions. Prefer useful information density over decorative dashboard cards.
- Style native headings, links, buttons, labels, inputs, tables, captions and description lists through a small shared stylesheet. Use reusable server-side view helpers where they remove repetition; avoid a parallel client-side component/state framework.
- Distinguish primary, secondary and consequential actions. Explain status in text; colour may reinforce it. Keep operational source state separate from member access and login state.
- Tables have associated headers and remain usable at narrow widths and enlarged text. Long names, email addresses and references must remain accessible. Any necessary horizontal table scrolling stays within its labelled region.
- Empty results, unconfigured sources, unavailable data and validation failures have concise explanations and a useful next action. Staff-facing language describes the operation rather than its implementation.

## Navigation, search and paging

- Normal links and forms provide complete working pages without JavaScript. Direct links, reload and browser Back/Forward preserve the selected view and search/page parameters.
- Enhance ordinary admin navigation with htmx where it preserves these semantics. Update the relevant content region without duplicating the document shell or losing the page title/current-location state.
- Member search supports explicit submission and a debounced typed-search enhancement. A new search starts at the first page. Clearing the search resets the filter and page. Paging retains the current filter.
- Search and paging use server-rendered result fragments. Cancel or supersede obsolete requests so an older result cannot replace a newer search. Keep stable input identity and preserve typing focus/caret during result updates.
- Represent completed search and paging state in the canonical URL. Avoid creating a browser-history entry for each keystroke. Restore a complete consistent view on history navigation.
- Keep the current usable content visible while a request is pending. Announce loading, result changes and recoverable failures without repeatedly interrupting typing or stealing focus.

## Forms and recovery

- Use htmx to enhance existing invitation actions and other staff forms where it improves the workflow. Keep sign-in, verification and sign-out as ordinary browser navigation unless their authentication semantics are explicitly preserved and verified.
- Preserve entered values on validation or temporary server failure. Associate field errors with inputs and provide a visible summary where useful. Never swap raw API error JSON into the page.
- Disable the submitted action while its request is pending; provide a visible pending state and restore a usable action after failure. Existing server-side idempotency and concurrency protections remain authoritative.
- A successful mutation displays the saved outcome and updates the affected information. A failed request does not imply a successful invitation, identity change or access change. Existing mandatory reasons and confirmation/preview requirements remain in force.
- Expired form security tokens reject the action without saving. Keep same-origin entries and provide a fresh form for an explicit retry; the interface must explain that nothing was saved.
- Network failures offer a retry path while retaining the form and surrounding context. Do not blindly replay consequential mutations whose outcome is uncertain.
- Session expiry during an enhanced request takes the entire browser to sign-in rather than inserting a sign-in document into a result panel. Back navigation after sign-out cannot restore usable protected content.

## Accessibility

- Use landmark regions, a skip link, named navigation, meaningful headings and visible keyboard focus. Native controls retain their expected semantics and keyboard behaviour.
- Partial updates expose loading and result/error announcements to assistive technology. Keep typing focus during search; deliberate navigation and validation move focus only when needed to explain the changed context.
- Maintain sufficient contrast, reduced-motion behaviour and usable layouts under zoom and enlarged text. Requests and failures must be understandable without animation or colour alone.

## Security and delivery

- Serve pinned htmx and admin CSS from the application's own packaged assets. The admin must not require a runtime CDN connection. Public asset responses contain no staff or member information.
- Use a restrictive Content Security Policy compatible with the selected htmx configuration. Avoid inline event-handler expressions, evaluated attributes and injected scripts; place any necessary event glue in a small same-origin asset.
- All complete pages, fragments and mutations retain the same staff authentication, permission and CSRF boundaries. Request headers selecting a fragment are presentation hints, never authority.
- Protected HTML is not stored in htmx's browser history snapshot cache or other application-controlled persistent browser storage. History restoration revalidates the staff session. Sensitive responses retain private no-store semantics.
- Escape member-supplied text consistently in documents and fragments. Distinguish complete-document and fragment representations correctly, including history-restore requests and relevant response variation headers.
- Static assets are available in the packaged runtime and remain independent of database or vendor availability. Health probes retain their existing independent behaviour.

## Acceptance

- Staff can sign in, search and page through saved members, open details, return to results and use invitation controls with and without JavaScript.
- Enhanced requests update the intended region, preserve appropriate focus and show loading, validation and recovery states. Rapid searches cannot display stale results.
- Search URLs, direct navigation, reload and Back/Forward restore a consistent view and page title. Expired or signed-out sessions cannot recover protected HTML from an application history cache.
- Staff boundaries, CSRF, escaping and invitation semantics hold for both enhanced and ordinary requests. Missing vendor configuration remains recoverable under the access specification.
- Keyboard use, narrow screens and enlarged text remain usable. The packaged runtime serves the required assets and pages under its actual security headers.
