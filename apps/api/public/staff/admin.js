/* htmx 4 event glue: the library owns requests, synchronization and history. */
(() => {
  const dialog = document.getElementById('staff-dialog');
  let dialogOpener;
  let dialogPath;
  const restoreFocus = () => {
    const replacement = Array.from(document.querySelectorAll('[data-dialog-open]')).find(
      (link) => link.getAttribute('href') === dialogPath,
    );
    const control = dialogOpener?.isConnected ? dialogOpener : replacement;
    (control ?? document.querySelector('main h1'))?.focus();
  };
  const closeDialog = () => {
    if (!dialog?.open) return;
    dialog.close();
    delete dialog.dataset.pending;
    document.documentElement.classList.remove('modal-is-open');
    document.getElementById('staff-dialog-content').replaceChildren();
    status('');
    restoreFocus();
  };
  dialog?.addEventListener('cancel', (event) => {
    event.preventDefault();
    if (!dialog.dataset.pending) closeDialog();
  });
  document.addEventListener(
    'click',
    (event) => {
      const link = event.target.closest?.('[data-dialog-open]');
      if (
        link &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.shiftKey &&
        !event.altKey &&
        event.button === 0
      ) {
        dialogOpener = link;
        dialogPath = link.getAttribute('href');
      }
      if (event.target.closest?.('[data-dialog-close]') && dialog?.open) {
        event.preventDefault();
        event.stopPropagation();
        if (!dialog.dataset.pending) closeDialog();
      }
    },
    true,
  );
  const status = (message) => {
    const region = document.getElementById(dialog?.open ? 'dialog-status' : 'request-status');
    if (region) {
      region.textContent = message;
      region.dataset.error = /^(Unable|Request timed out|Connection failed)/.test(message)
        ? 'true'
        : 'false';
    }
  };
  const recovery = (ctx) =>
    status(
      ctx.request.method === 'GET'
        ? 'Unable to load this view. Your current results are still shown. Retry Search or the link.'
        : 'Unable to confirm this action. Your entries are kept. Review invitations before trying again.',
    );
  let activeViewRequest;
  let activeDialogRequest;
  const superseded = new WeakSet();
  document.addEventListener('input', (event) => {
    if (event.target.id === 'member-search') {
      if (activeViewRequest) {
        superseded.add(activeViewRequest);
        // htmx owns the queue; abort through the current request's source.
        window.htmx.trigger(activeViewRequest.sourceElement, 'htmx:abort');
      }
    }
  });
  document.addEventListener('htmx:before:request', (event) => {
    const { ctx } = event.detail;
    // Requests for navigation, search and paging share the replace queue. Mark
    // the prior request before its abort rejection is delivered; timeouts have
    // no replacement and therefore still announce a recoverable failure.
    if (['staff-view', 'member-results'].includes(ctx.target.id)) {
      if (activeViewRequest) superseded.add(activeViewRequest);
      activeViewRequest = ctx;
    }
    if (ctx.target.id === 'staff-dialog-content') {
      if (activeDialogRequest) superseded.add(activeDialogRequest);
      activeDialogRequest = ctx;
    }
    ctx.target.setAttribute('aria-busy', 'true');
    if (dialog?.open && ctx.request.method === 'POST' && dialog.contains(ctx.sourceElement)) {
      dialog.dataset.pending = 'true';
      dialog.querySelector('[data-dialog-close]')?.setAttribute('aria-disabled', 'true');
    }
    if (ctx.sourceElement.closest('nav[aria-label="Member pages"]')) {
      const search = document.getElementById('member-search');
      if (search)
        search.value = new URL(ctx.request.action, location.href).searchParams.get('q') ?? '';
    }
    status(ctx.request.method === 'GET' ? 'Loading…' : 'Saving…');
  });
  document.addEventListener('htmx:before:response', (event) => {
    const { ctx } = event.detail;
    const { headers, status: code } = ctx.response;
    if (headers.has('HX-Redirect') || headers.has('HX-Location') || code === 204) return;
    // v4 swaps errors by default. Only our specifically marked staff HTML may
    // replace a form/view; API JSON, CSRF/auth errors and search failures stay out.
    const html = headers.get('Content-Type')?.startsWith('text/html');
    const safeError =
      headers.get('X-Staff-Form') === ctx.target.id ||
      (ctx.target.id === 'staff-view' && headers.get('X-Staff-View') === 'true');
    const safeDialog =
      ctx.target.id !== 'staff-dialog-content' || headers.get('X-Staff-Dialog') === 'true';
    if (!html || !safeDialog || (code >= 400 && !safeError)) {
      event.preventDefault();
      recovery(ctx);
    }
  });
  document.addEventListener('htmx:before:swap', (event) => {
    // v4 has no allowScriptTags option. Fragments never need scripts; remove
    // them before insertion while the CSP independently blocks inline execution.
    for (const task of event.detail.tasks) {
      task.fragment?.querySelectorAll('script').forEach((script) => script.remove());
    }
  });
  document.addEventListener('htmx:finally:request', (event) => {
    const { ctx } = event.detail;
    if (
      !activeViewRequest ||
      activeViewRequest === ctx ||
      activeViewRequest.target.id !== ctx.target.id
    )
      ctx.target?.removeAttribute('aria-busy');
    if (activeViewRequest === ctx) activeViewRequest = undefined;
    if (activeDialogRequest === ctx) activeDialogRequest = undefined;
    if (ctx.request.method === 'POST' && dialog?.dataset.pending) {
      delete dialog.dataset.pending;
      dialog.querySelector('[data-dialog-close]')?.removeAttribute('aria-disabled');
    }
  });
  document.addEventListener('htmx:error', (event) => {
    // A superseded search is expected; connection/timeout failures are actionable.
    const { ctx } = event.detail;
    if (ctx && !superseded.has(ctx)) {
      const failure = ctx.request.signal.aborted ? 'Request timed out.' : 'Connection failed.';
      status(
        ctx.request.method === 'GET'
          ? `${failure} Your current results are still shown. Retry Search or the link.`
          : `${failure} Your entries are kept. Review invitations before repeating this action.`,
      );
    }
  });
  document.addEventListener('htmx:after:swap', (event) => {
    const { ctx } = event.detail;
    const target = document.getElementById(ctx.target.id) ?? ctx.target;
    if (target.id === 'staff-dialog-content') {
      dialog.showModal();
      document.documentElement.classList.add('modal-is-open');
      target.querySelector('input:not([type="hidden"])')?.focus();
      status('');
    }
    const error = target.querySelector('.error-summary');
    if (error) {
      status('Please review the form.');
      error.focus();
    } else if (target.id === 'member-results')
      status(target.querySelector('[data-results-summary]')?.textContent ?? 'Results updated.');
    else if (target.id === 'staff-view') {
      const wasOpen = dialog?.open;
      closeDialog();
      status(target.querySelector('.notice')?.textContent?.trim() ?? '');
      if (!wasOpen) target.querySelector('h1')?.focus();
    }
  });
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) location.reload();
  });
})();
