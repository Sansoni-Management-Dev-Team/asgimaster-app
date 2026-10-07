import { membershipFor } from "./home-model.js";
import { getLibrary, libraryCatalogue, contentState, requiredMembership } from "./library-model.js";

const escape = value => String(value).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
const icon = kind => `<svg class="home-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${{
  play: '<path d="m9 5 11 7-11 7Z"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  search: '<circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/>',
  book: '<path d="M12 5v15M3 4l9 2 9-2v14l-9 2-9-2Z"/>',
}[kind]}</svg>`;
const actionButton = (text, action, secondary = false) => `<button type="button" class="${secondary ? "text-button" : "ds-button ds-button--solid app-button"}" data-library-action="${action}">${escape(text)}</button>`;

export function createLibrary({ getMember, openLesson, openSheet, closeSheet, getRelatedEvents = () => "" }) {
  const screen = document.querySelector('[data-screen="library"]');
  const results = document.querySelector("#library-results");
  const status = document.querySelector("#library-status");
  const search = document.querySelector("#library-search");
  const collectionSelect = document.querySelector("#library-collection");
  const progressSelect = document.querySelector("#library-progress");
  const filters = { scope: "included", query: "", collection: "all", progress: "all" };
  let phase = "ready";
  let loaded = false;
  let loadingTimer;
  let searchTimer;
  let pinnedLoading = false;

  const announce = message => { status.textContent = message; };
  const model = () => getLibrary(getMember(), filters, phase === "empty" ? [] : libraryCatalogue);
  const scrollToResults = () => {
    document.querySelector("#library-result-title")?.focus({ preventScroll: true });
    results.scrollIntoView({ block: "start" });
  };

  function stateCard(title, detail, symbol, buttons = "") {
    return `<div class="library-empty">${icon(symbol)}<h2 id="library-result-title" tabindex="-1">${escape(title)}</h2><p>${escape(detail)}</p>${buttons}</div>`;
  }

  function collectionCard(group, member) {
    const locked = group.items.every(item => contentState(member, item) === "locked");
    const pending = !locked && !group.ready.length;
    const label = locked ? "Not included" : pending ? "Coming soon" : "Included";
    const detail = locked ? `${requiredMembership(group.items[0])} membership required` : pending ? "Recording being prepared" : `${group.ready.length} ${group.ready.length === 1 ? "lesson" : "lessons"} · ${group.ready.reduce((sum, item) => sum + item.minutes, 0)} min`;
    return `<button type="button" class="ds-card library-collection-card ${locked || pending ? "library-card--restricted" : ""}" id="collection-${group.id}" data-library-action="collection" data-collection="${group.id}">
      <span class="library-cover library-cover--${group.motif}" aria-hidden="true"><span class="ds-number">${group.number}</span><span>${icon(locked ? "lock" : pending ? "clock" : "book")}</span></span>
      <span class="library-collection-copy"><span class="library-card-meta">${icon(locked ? "lock" : pending ? "clock" : "check")}${label}</span><strong>${escape(group.title)}</strong><span class="library-description">${escape(group.description)}</span><span class="library-card-footer"><span>${escape(detail)}</span><span aria-hidden="true">↗</span></span>
      ${!locked && !pending ? `<span class="library-completion"><span class="lesson-track" aria-hidden="true"><span style="width:${group.completed / group.ready.length * 100}%"></span></span><span>${group.completed} of ${group.ready.length} complete</span></span>` : ""}</span></button>`;
  }

  function lessonCard(item, member) {
    const state = contentState(member, item);
    const position = Math.floor((member.positions[item.id] || 0) / 60);
    const description = state === "locked" ? `Locked · ${requiredMembership(item)} membership required` : state === "unavailable" ? "Unavailable · Recording being prepared" : state === "completed" ? "Completed · Watch again" : state === "in-progress" ? `Continue · ${Math.min(position, item.minutes)} of ${item.minutes} min watched` : "Included · Ready to start";
    return `<button class="library-lesson ds-card" type="button" id="library-item-${item.id}" data-library-action="lesson" data-lesson="${item.id}">
      <span class="library-lesson-icon" aria-hidden="true">${icon(state === "locked" ? "lock" : state === "unavailable" ? "clock" : state === "completed" ? "check" : "play")}</span>
      <span class="library-lesson-copy"><span class="ds-eyebrow">${escape(item.course)} · ${item.minutes} min</span><strong>${escape(item.title)}</strong><span class="library-item-state">${escape(description)}</span>${state === "in-progress" ? `<span class="lesson-track" aria-hidden="true"><span style="width:${Math.min(100, (member.positions[item.id] || 0) / (item.minutes * 60) * 100)}%"></span></span>` : ""}</span><span aria-hidden="true">›</span></button>`;
  }

  function render({ notify = false } = {}) {
    const member = getMember();
    const d = model();
    filters.collection = d.collection;
    document.querySelector("#library-membership").textContent = `${membershipFor(member).name} access`;
    const accessSummary = document.querySelector("#library-access-summary");
    accessSummary.innerHTML = phase === "empty" ? "Your collections will appear here." : `${d.includedCount} included<span class="ds-visually-hidden"> lessons</span>${d.comingSoonCount ? ` · ${d.comingSoonCount} coming soon` : ""}`;
    // Keep the search input in place while updating results so typing never loses focus.
    if (search.value !== filters.query) search.value = filters.query;
    document.querySelector("#library-clear-search").hidden = !search.value;
    collectionSelect.innerHTML = `<option value="all">All collections</option>${d.options.map(item => `<option value="${item.id}">${escape(item.title)}</option>`).join("")}`;
    collectionSelect.value = d.collection;
    progressSelect.value = d.progress;
    screen.querySelectorAll("[data-library-scope]").forEach(button => button.setAttribute("aria-pressed", String(button.dataset.libraryScope === d.scope)));
    const filtered = Boolean(filters.query.trim()) || d.collection !== "all" || d.progress !== "all";
    document.querySelector("#library-reset").hidden = !filtered;
    results.setAttribute("aria-busy", String(phase === "loading"));

    if (phase === "loading") {
      results.innerHTML = `<h2 class="library-section-title" id="library-result-title" tabindex="-1">Loading your library</h2><p class="library-result-note">Getting your collections ready.</p><div class="library-skeletons" aria-hidden="true">${Array.from({length: 3}, () => '<div class="ds-card library-skeleton"><span></span><span></span><span></span></div>').join("")}</div>${pinnedLoading ? `<p class="demo-caption">Loading-state preview · no network request is running.</p>${actionButton("Finish loading preview", "finish-loading")}` : ""}`;
      if (notify) announce("Loading your library.");
      return;
    }
    if (phase === "error") {
      results.innerHTML = stateCard("Couldn't load", "Your progress is safe. Try loading the library again.", "book", actionButton("Try again", "retry"));
      if (notify) announce("Couldn't load the library. Try again.");
      return;
    }
    if (phase === "empty") {
      results.innerHTML = stateCard("A fresh start", "There aren't any collections here yet. Your consultant can help you find your starting point.", "book", `<button class="ds-button ds-button--solid app-button" type="button" data-home-action="support">Contact support</button>${actionButton("Reload library", "retry", true)}`);
      if (notify) announce("Your library is empty. Contact support for help.");
      return;
    }
    if (!d.items.length) {
      results.innerHTML = stateCard("No matches", filters.query.trim() ? `Nothing matches “${filters.query.trim()}” with these filters. Try another topic or clear your filters.` : "No lessons match these filters. Try another collection or progress status.", "search", actionButton("Clear filters", "reset"));
      if (notify) announce("No matching lessons. Try another search or clear your filters.");
      return;
    }
    const title = d.overview ? (d.scope === "included" ? "Your collections" : "All collections") : (d.collection !== "all" ? d.options.find(item => item.id === d.collection).title : "Your results");
    results.innerHTML = `${!d.overview ? '<button type="button" class="library-back" data-library-action="reset">← Back to collections</button>' : ""}
      <div class="library-results-heading"><h2 class="library-section-title" id="library-result-title" tabindex="-1">${escape(title)}</h2><span>${d.overview ? d.groups.length : d.items.length} ${d.overview ? (d.groups.length === 1 ? "collection" : "collections") : d.items.length === 1 ? "lesson" : "lessons"}</span></div>
      ${d.scope === "all" ? '<p class="library-result-note">Locked content needs a different membership. Unavailable content is not ready to watch.</p>' : ""}
      <div class="${d.overview ? "library-collections" : "library-lessons"}">${d.overview ? d.groups.map(group => collectionCard(group, member)).join("") : d.items.map(item => lessonCard(item, member)).join("")}</div>
      ${d.overview && d.scope === "included" && d.lockedCount ? `<button class="library-explore" type="button" data-library-scope="all" aria-pressed="false"><span>Looking for more?<strong>Explore the full library</strong></span><span aria-hidden="true">↗</span></button>` : ""}`;
    results.insertAdjacentHTML("beforeend", getRelatedEvents(d.items.map(item => item.id)));
    if (notify) announce(`${d.items.length} matching ${d.items.length === 1 ? "lesson" : "lessons"} in ${d.groups.length} ${d.groups.length === 1 ? "collection" : "collections"}.`);
  }

  function load() {
    clearTimeout(loadingTimer);
    phase = "loading"; pinnedLoading = false;
    render({ notify: true });
    // Simulated local loading only. Production will use the catalogue API here.
    loadingTimer = setTimeout(() => { phase = "ready"; loaded = true; if (!screen.hidden) render({ notify: true }); }, 650);
  }

  function enter() {
    if (!loaded && !pinnedLoading && phase !== "empty" && phase !== "error") load();
    else render({ notify: true });
  }

  function leave() {
    clearTimeout(loadingTimer); clearTimeout(searchTimer);
    status.textContent = "";
    if (phase === "loading" && !pinnedLoading) loaded = false;
  }
  function refresh() { if (!screen.hidden) render({ notify: true }); }

  function openPreview() {
    openSheet("library-preview", "Library preview", `<p>Try the library's loading, empty, and error states. These are local demos; your learning progress won't change.</p><label class="ds-field__label" for="library-preview-state">Library state</label><select class="ds-input" id="library-preview-state"><option value="ready">Ready · sample catalogue</option><option value="loading">Loading · hold the preview</option><option value="empty">Empty · no collections</option><option value="error">Error · try again</option></select>`, actionButton("Apply preview", "apply-preview") + actionButton("Back to library", "close", true));
    document.querySelector("#library-preview-state").value = phase;
  }

  function openItem(id) {
    const item = libraryCatalogue.find(entry => entry.id === id);
    if (!item || phase !== "ready") return;
    const state = contentState(getMember(), item);
    if (state === "locked") {
      openSheet("library-locked", "Not included", `<p class="sheet-eyebrow">${escape(item.course)}</p><h3 class="library-detail-title">${escape(item.title)}</h3><p>This lesson needs ${requiredMembership(item)} membership. It isn't included in your current access.</p><p>Your included lessons are still available.</p>`, '<button class="ds-button ds-button--solid app-button" type="button" data-home-action="membership">View membership</button>' + actionButton("Back to library", "close", true));
    } else if (state === "unavailable") {
      openLesson(id);
    } else openLesson(id);
  }

  function reset() {
    filters.query = ""; filters.collection = "all"; filters.progress = "all";
    render({ notify: true }); search.focus();
  }

  document.addEventListener("click", event => {
    const scope = event.target.closest("[data-library-scope]");
    if (scope) {
      filters.scope = scope.dataset.libraryScope; render({ notify: true });
      if (!scope.isConnected) screen.querySelector(`[data-library-scope="${filters.scope}"]`).focus();
      return;
    }
    const button = event.target.closest("[data-library-action]");
    if (!button) return;
    switch (button.dataset.libraryAction) {
      case "collection": filters.collection = button.dataset.collection; render({ notify: true }); scrollToResults(); break;
      case "lesson": openItem(button.dataset.lesson); break;
      case "clear-search": filters.query = ""; render({ notify: true }); search.focus(); break;
      case "reset": reset(); break;
      case "preview": openPreview(); break;
      case "close": closeSheet(); break;
      case "retry": load(); document.querySelector("#library-result-title").focus(); break;
      case "finish-loading": phase = "ready"; pinnedLoading = false; loaded = true; render({ notify: true }); scrollToResults(); break;
      case "apply-preview": {
        const chosen = document.querySelector("#library-preview-state").value;
        if (!["ready", "loading", "empty", "error"].includes(chosen)) break;
        clearTimeout(loadingTimer); phase = chosen; pinnedLoading = chosen === "loading"; loaded = true;
        closeSheet(); render({ notify: true });
        break;
      }
    }
  });
  search.addEventListener("input", () => {
    filters.query = search.value; render(); clearTimeout(searchTimer);
    searchTimer = setTimeout(() => { if (!screen.hidden) render({ notify: true }); }, 250);
  });
  document.querySelector("#library-search-form").addEventListener("submit", event => { event.preventDefault(); clearTimeout(searchTimer); render({ notify: true }); scrollToResults(); });
  collectionSelect.addEventListener("change", () => { filters.collection = collectionSelect.value; render({ notify: true }); });
  progressSelect.addEventListener("change", () => { filters.progress = progressSelect.value; render({ notify: true }); });
  return { enter, leave, refresh };
}
