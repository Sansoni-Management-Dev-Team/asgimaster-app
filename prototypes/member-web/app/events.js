import { loadEvents, persistEvents, eventCatalogue, canAttend, eventStatus, selectEvents, eventProgress, nextEvent, isEventDay, eventDate, eventTime, eventMonth, ticketLabel, registrationFor, relatedLessons, registerEvent, cancelRegistration, simulateCheckIn, parseEventRoute } from "./events-model.js";

const escape = value => String(value).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
const symbols = { calendar: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4m10-4v4M3 11h18m-14 4h3m4 0h3"/>', arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>', check: '<path d="m5 12 4 4L19 6"/>', online: '<rect x="2" y="4" width="20" height="14" rx="2"/><path d="M8 22h8m-4-4v4m-2-14 6 4-6 4Z"/>', pin: '<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2"/>' };
const icon = kind => `<svg class="home-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${symbols[kind] || symbols.calendar}</svg>`;
const labels = { open: "Open", registered: "Registered", attended: "Attended", full: "Fully booked", cancelled: "Cancelled", ended: "Ended" };
const action = (label, name, { id = "", secondary = false, attrs = "" } = {}) => `<button type="button" id="events-action-${name}${id ? `-${escape(id)}` : ""}" class="${secondary ? "text-button" : "ds-button ds-button--solid app-button"}" data-events-action="${name}" ${id ? `data-event-id="${escape(id)}"` : ""} ${attrs}>${escape(label)}</button>`;

// A decorative, deliberately non-functional code; never an admission credential.
function sampleCode() {
  let cells = "";
  for (let y = 0; y < 25; y++) for (let x = 0; x < 25; x++) {
    if ((x < 8 && y < 8) || (x > 16 && y < 8) || (x < 8 && y > 16)) continue;
    if ((x * 17 + y * 13 + x * y * 3) % 7 < 3) cells += `<rect x="${x + 3}" y="${y + 3}" width="1" height="1"/>`;
  }
  for (const [x, y] of [[3, 3], [21, 3], [3, 21]]) cells += `<rect x="${x}" y="${y}" width="7" height="7"/><rect class="event-code-gap" x="${x + 1}" y="${y + 1}" width="5" height="5"/><rect x="${x + 2}" y="${y + 2}" width="3" height="3"/>`;
  return `<svg class="event-code" viewBox="0 0 31 31" aria-hidden="true" focusable="false">${cells}</svg>`;
}

export function createEvents({ getMember, getGoal, getIdentity, navigate, openSheet, closeSheet, openLesson, openProgress, onChange }) {
  const state = loadEvents();
  const screen = document.querySelector('[data-screen="events"]');
  const body = document.querySelector("#events-body");
  const footer = document.querySelector("#events-actions");
  const nav = screen.querySelector("[data-member-nav]");
  const live = document.querySelector("#events-status");
  const warning = document.querySelector("#events-storage-warning");
  let route = { view: "list", mine: false };
  let format = "all", phase = "ready", loaded = false, timer, pinnedLoading = false;
  let previewStatus = null;
  let lastMine = false;
  let notice = "";
  let pendingAnnouncement = "";
  warning.hidden = persistEvents(state);
  const catalogue = () => eventCatalogue(state);
  const find = id => catalogue().find(event => event.id === id);
  const current = () => { const event = find(route.id); return event && previewStatus ? { ...event, ...(previewStatus === "ended" ? { end: Date.now() - 1 } : { status: previewStatus }) } : event; };
  const announce = text => { live.textContent = text; };
  const go = (id = "", view = "") => { closeSheet(); navigate(`events${id ? `/${id}` : ""}${view ? `/${view}` : ""}`); };
  const meta = event => `${eventDate(event)} · ${eventTime(event)}`;
  const formatName = event => event.format === "online" ? "Online" : "In person";
  const record = event => registrationFor(state, event.id);
  const commit = message => { warning.hidden = persistEvents(state); onChange(); pendingAnnouncement = `${message}${warning.hidden ? " Saved in this browser." : " Changes will be lost when this page closes."}`; announce(pendingAnnouncement); };
  function eventCard(event, compact = false) {
    const status = eventStatus(getMember(), event, state);
    const day = new Intl.DateTimeFormat("en-AU", { timeZone: event.timezone, day: "2-digit" }).format(event.start);
    const month = new Intl.DateTimeFormat("en-AU", { timeZone: event.timezone, month: "short" }).format(event.start);
    return `<button type="button" class="ds-card event-card ${compact ? "event-card--compact" : ""}" data-events-action="open" data-event-id="${event.id}"><span class="event-date-tile" aria-hidden="true"><span>${month}</span><strong>${day}</strong></span><span class="event-card-copy"><span class="event-card-top"><span>${formatName(event)}</span><span class="event-badge ${["registered", "attended"].includes(status) ? "event-badge--positive" : ""}">${labels[status]}</span></span><strong>${escape(event.title)}</strong><span>${escape(meta(event))}</span><span>${escape(event.location)}</span></span><span aria-hidden="true">›</span></button>`;
  }
  function summaryHtml() {
    const progress = eventProgress(getMember(), state);
    return `<section class="event-progress" aria-label="Events in your plan"><h3 class="sheet-section-title">Events in your plan</h3><p>Registrations are upcoming commitments. Attendance is recorded separately from lessons.</p><h4>Upcoming · ${progress.upcoming.length}</h4>${progress.upcoming.length ? progress.upcoming.map(event => eventCard(event, true)).join("") : "<p>No upcoming registrations.</p>"}<h4>Attended · ${progress.attended.length}</h4>${progress.attended.length ? progress.attended.map(event => eventCard(event, true)).join("") : "<p>No attendance recorded yet.</p>"}<button type="button" class="event-link" data-events-action="browse">Browse events ${icon("arrow")}</button></section>`;
  }
  function homeCard() {
    const event = nextEvent(getMember(), state);
    if (!event) return "";
    const registered = record(event)?.status === "registered";
    const today = registered && isEventDay(event);
    return `<section class="home-section event-home" aria-label="Your next event"><div class="home-section-heading"><h2 class="home-section__label">${registered ? "Your next event" : "Included events"}</h2><button type="button" class="home-inline-link" data-events-action="browse">View all <span aria-hidden="true">↗</span></button></div>${eventCard(event)}${today ? `<button type="button" class="event-link" data-events-action="ticket" data-event-id="${event.id}">Today · ${ticketLabel(event)} ${icon("arrow")}</button>` : ""}</section>`;
  }
  function relatedHtml(lessonIds) {
    const eligible = selectEvents(getMember(), state).filter(event => event.status !== "cancelled" && relatedLessons(getMember(), event).some(lesson => lessonIds.includes(lesson.id))).slice(0, 2);
    return eligible.length ? `<section class="event-related" aria-labelledby="library-event-title"><h2 class="library-section-title" id="library-event-title">Put it into practice</h2><p>Included events connected to this learning.</p>${eligible.map(event => eventCard(event, true)).join("")}</section>` : "";
  }
  const header = title => `<header class="events-header">${route.view !== "list" ? '<button type="button" class="event-link" data-events-action="back" id="events-back">← Events</button>' : '<span class="ds-eyebrow">Master App</span>'}<button class="library-options" type="button" id="events-options" data-events-action="preview" aria-label="Events demo options">•••</button><h1 id="events-title" tabindex="-1">${title}</h1></header>`;
  const empty = (title, text, buttons = "") => `<div class="event-empty">${icon("calendar")}<h2>${title}</h2><p>${text}</p>${buttons}</div>`;
  const agenda = event => `<section class="event-section"><h3>On the day</h3><ol class="event-agenda">${event.agenda.map(item => `<li><time>${escape(eventTime(event, event.start + item.minutes * 60000))}</time><span>${escape(item.title)}</span></li>`).join("")}</ol></section>`;
  const overview = event => `<div class="event-overview"><span class="ds-eyebrow">${formatName(event)} · ${event.hours} ${event.hours === 1 ? "hour" : "hours"}</span><h2>${escape(event.title)}</h2><p>${escape(meta(event))}</p><p>${icon(event.format === "online" ? "online" : "pin")} ${escape(event.location)}</p></div>`;
  function list() {
    const items = selectEvents(getMember(), state, { format, mine: route.mine });
    const mineCount = selectEvents(getMember(), state, { mine: true }).length;
    let html = `<div class="events-scope" aria-label="Event lists"><button type="button" id="events-all" data-events-action="browse" aria-pressed="${!route.mine}">Upcoming</button><button type="button" id="events-mine" data-events-action="mine" aria-pressed="${route.mine}">My events (${mineCount})</button></div><div class="events-filters" aria-label="Event format">${[["all", "All"], ["in-person", "In person"], ["online", "Online"]].map(([value, label]) => `<button type="button" id="events-filter-${value}" data-events-format="${value}" aria-pressed="${format === value}">${label}</button>`).join("")}</div>`;
    if (phase === "loading") return html + `<div aria-busy="true">${empty("Loading events", "Getting your included events ready.")}<div class="events-skeleton" aria-hidden="true"></div></div>${pinnedLoading ? action("Finish loading preview", "finish-loading") : ""}`;
    if (phase === "error") return html + empty("Couldn't load events", "Your saved registrations are unchanged. Try again.", action("Try again", "retry"));
    if ((phase === "empty" && !route.mine) || !items.length) return html + empty(route.mine ? "No events yet" : "Nothing scheduled", route.mine ? "Your registrations and attended events will appear here." : phase === "empty" ? "Empty catalogue preview. Your saved registrations are unchanged and remain in My events." : "No included events match this view. Check back later or change the format.", action("Show all upcoming", "reset") + action("Contact support", "support", { secondary: true }));
    let month;
    for (const event of items) {
      const nextMonth = eventMonth(event);
      if (nextMonth !== month) { if (month) html += "</div></section>"; month = nextMonth; html += `<section class="event-month"><h2>${escape(month)}</h2><div class="event-list">`; }
      html += eventCard(event);
    }
    return html + (month ? "</div></section>" : "");
  }
  function render({ focus = false } = {}) {
    if (screen.hidden) return;
    const activeId = body.contains(document.activeElement) ? document.activeElement.id : null;
    const event = current();
    let view = route.view;
    if (view !== "list" && (!event || !canAttend(getMember(), event))) view = "unavailable";
    const status = view !== "unavailable" && event ? eventStatus(getMember(), event, state) : null;
    const titles = { list: "Events", detail: "Event details", confirmed: "You're registered", ticket: event?.format === "online" ? "Online access" : "My ticket", "checked-in": "Attendance recorded", unavailable: "Not available" };
    let html = "", actions = "";
    if (view === "list") html = list();
    else if (view === "unavailable") html = empty("Event not available", "This link is invalid or isn't available with your current access.", action("Back to events", "back") + action("Contact support", "support", { secondary: true }));
    else if (["confirmed", "ticket", "checked-in"].includes(view) && !(view === "checked-in" ? status === "attended" : ["registered", "attended"].includes(status))) {
      html = empty("Access not available", "A current registration is required. This event or registration may have ended or been cancelled.");
      actions = action("View event details", "open", { id: event.id });
    } else if (view === "detail") {
      const related = relatedLessons(getMember(), event);
      html = `<div class="event-art" aria-hidden="true">${icon(event.format === "online" ? "online" : "calendar")}</div>${overview(event)}<span class="event-badge">${labels[status]}</span><p class="event-description">${escape(event.description)}</p>
        <section class="event-section"><h3>In your plan</h3><div class="ds-card event-plan-card"><strong>${escape(getGoal().name)}</strong><p>${escape(event.goalNote)}</p><p>Registration adds an upcoming commitment. Attendance is separate from lesson completion.</p></div></section>
        ${related.length ? `<section class="event-section"><h3>Before the event</h3>${related.map(lesson => `<button type="button" class="event-lesson" data-events-action="lesson" data-event-id="${event.id}" data-lesson="${lesson.id}">${icon("online")}<span><strong>${escape(lesson.title)}</strong><span>${getMember().completed.includes(lesson.id) ? "Completed" : "Included"} · ${lesson.minutes} min</span></span><span aria-hidden="true">›</span></button>`).join("")}</section>` : ""}
        <section class="event-section"><h3>Come prepared</h3><p>${escape(event.preparation)}</p><p>Hosted by ${escape(event.host)} · fictional demo event.</p></section>${agenda(event)}`;
      actions = status === "open" ? action("Register", "register", { id: event.id }) : status === "registered" ? action(ticketLabel(event), "ticket", { id: event.id }) : status === "attended" ? action("View attendance", "attendance", { id: event.id }) : `<p class="event-action-note">${status === "full" ? "Fully booked. Registration is closed." : status === "cancelled" ? "This event has been cancelled." : "This event has ended."}</p>${action("Browse events", "back")}`;
      if (record(event)?.status === "registered") actions += action("Cancel registration", "cancel", { id: event.id, secondary: true });
    } else if (view === "confirmed") {
      html = `<div class="event-success-mark" aria-hidden="true">${icon("check")}</div>${overview(event)}<section class="event-section"><h3>Added to your plan</h3><div class="ds-card event-plan-card"><strong>${escape(getGoal().name)}</strong><p>${status === "attended" ? "Attendance has already been recorded in this demo." : "An upcoming commitment. It becomes an attended event only after check-in."}</p></div></section><section class="event-section"><h3>Before the day</h3><p>${escape(event.preparation)}</p><p>Demo only. No reminder will be sent.</p></section><button type="button" id="events-calendar-preview" class="event-link" data-events-action="calendar" data-event-id="${event.id}">Preview calendar reminder ${icon("arrow")}</button>`;
      actions = action(ticketLabel(event), "ticket", { id: event.id }) + (status !== "attended" ? action("Cancel registration", "cancel", { id: event.id, secondary: true }) : "");
    } else if (view === "ticket") {
      const identity = getIdentity();
      html = `${overview(event)}<div class="ds-card event-pass">${event.format === "in-person" ? `${sampleCode()}<p class="event-demo-label">Demo QR · not valid for admission</p>` : `<div class="event-online-mark">${icon("online")}</div><h3>Join from your device</h3><p>A meeting link will appear here in the live app.</p>`}<strong>${escape(identity.fullName)}</strong>${identity.company ? `<p>${escape(identity.company)}</p>` : ""}<p class="event-pass-id">${escape(record(event).passId)}</p><p class="event-demo-label">${status === "attended" ? "Attendance already recorded" : "Sample registration"}</p></div><p class="event-demo-note">Saved data is local to this browser when storage is available. This is not a real admission pass or guaranteed offline access.</p><div class="event-preview-links">${action("Offline preview", "offline", { id: event.id, secondary: true })}${event.format === "in-person" ? action("Wallet preview", "wallet", { id: event.id, secondary: true }) : ""}</div>`;
      actions = status === "attended" ? action("View attendance", "attendance", { id: event.id }) : event.format === "online" ? action("Preview joining", "join", { id: event.id }) : action("Back to events", "back");
      if (status !== "attended") actions += `<details class="event-demo-controls"><summary>Demo controls</summary><p>No agent or scanner is connected. This records fictional attendance, even before the event date.</p>${action(event.format === "online" ? "Simulate attendance" : "Simulate staff check-in", "check-in", { id: event.id, secondary: true })}</details>`;
    } else if (view === "checked-in") {
      html = `<div class="event-success-mark" aria-hidden="true">${icon("check")}</div><p class="event-demo-label">Simulated attendance</p>${overview(event)}<section class="event-section"><h3>Added to your record</h3><div class="ds-card event-plan-card"><strong>${escape(getGoal().name)}</strong><p>Attendance recorded for ${escape(getIdentity().fullName)}.</p><p>${escape(eventDate({ ...event, start: record(event).checkedInAt }))} · ${escape(eventTime(event, record(event).checkedInAt))}</p><p>${eventProgress(getMember(), state).attended.length} attended event(s). Lesson completion is unchanged.</p></div></section>${agenda(event)}`;
      actions = action("View my progress", "progress") + action("Back to events", "back", { secondary: true });
    }
    body.innerHTML = `${header(titles[view])}${notice ? `<p class="event-notice">${escape(notice)}</p>` : ""}${html}<p class="event-demo-note">Demo · sample events, no live registration.</p>`;
    footer.innerHTML = actions; footer.hidden = !actions;
    nav.hidden = !["list", "checked-in", "unavailable"].includes(view);
    document.title = `${titles[view]} - Master App`;
    if (focus) body.querySelector("h1").focus();
    else if (activeId) document.getElementById(activeId)?.focus({ preventScroll: true });
  }
  function load() {
    clearTimeout(timer); phase = "loading"; pinnedLoading = false; render(); announce("Loading your included events.");
    timer = setTimeout(() => { loaded = true; phase = "ready"; render(); announce("Your included events are ready."); }, 450);
  }
  function preview() {
    openSheet("events-preview", "Events preview", `<p>Local demo states only. Registrations and learning progress will not be changed.</p><label class="ds-field__label" for="events-preview-state">Screen state</label><select class="ds-input" id="events-preview-state"><option value="ready">Upcoming events</option><option value="loading">Loading</option><option value="error">Loading error</option><option value="empty">Empty list</option><option value="full">Fully booked event</option><option value="cancelled">Cancelled event</option><option value="ended">Ended event</option><option value="unavailable">Inaccessible link</option></select>`, action("Apply preview", "apply-preview"));
  }
  function previewSheet(kind, event) {
    const content = {
      calendar: ["Calendar preview", `${escape(meta(event))}<br>${escape(event.location)}<p>In the live app, you could add this event to your calendar. No calendar item or reminder has been created.</p>`],
      offline: ["Offline preview", `<p class="event-notice">Simulated offline state · no connectivity change.</p>${overview(event)}${event.format === "in-person" ? `${sampleCode()}<p class="event-demo-label">Demo QR · not valid for admission</p><p>${escape(getIdentity().fullName)}<br><span class="event-pass-id">${escape(record(event).passId)}</span></p>` : "<p>Joining an online event needs an internet connection. No meeting can be started from this preview.</p>"}<p>In the live app, a previously saved pass would show its last sync time. This prototype does not cache the app for offline reopening or guarantee access without a connection.</p>`],
      wallet: ["Wallet preview", "<p>Apple Wallet and Google Wallet passes are planned for a future integration.</p><p>No pass has been generated, downloaded or added to a wallet.</p>"],
      join: ["Joining preview", "<p>This would open the registered event's meeting in the live app.</p><p>No call has started. Opening this preview does not mark attendance.</p>"],
    }[kind];
    openSheet(`event-${kind}`, content[0], content[1], action("Close preview", "close", { secondary: true }));
  }
  document.addEventListener("click", click => {
    const filter = click.target.closest("[data-events-format]");
    if (filter) { format = filter.dataset.eventsFormat; render(); announce(`${filter.textContent} events shown.`); return; }
    const trigger = click.target.closest("[data-events-action]");
    if (!trigger) return;
    const name = trigger.dataset.eventsAction;
    const id = trigger.dataset.eventId;
    const event = id === route.id ? current() : find(id);
    if (id && (!event || !canAttend(getMember(), event))) { go(id); return; }
    if (["register", "cancel", "confirm-cancel", "check-in", "calendar", "offline", "wallet", "join", "lesson"].includes(name) && !event) return;
    switch (name) {
      case "open": go(id); break;
      case "browse": phase = "ready"; go(); break;
      case "back": phase = "ready"; go(route.mine ? "mine" : ""); break;
      case "mine": go("mine"); break;
      case "ticket": go(id, "ticket"); break;
      case "attendance": go(id, "checked-in"); break;
      case "register": {
        const result = registerEvent(getMember(), state, event);
        if (result.ok) { commit("Registration confirmed."); go(id, "confirmed"); } else { notice = result.reason; render({ focus: true }); announce(notice); }
        break;
      }
      case "cancel": openSheet("event-cancel", "Cancel registration?", `<p>${escape(event.title)}</p><p>Your upcoming commitment will be removed and this sample pass will no longer be valid.</p>`, action("Cancel registration", "confirm-cancel", { id }) + action("Keep registration", "close", { secondary: true })); break;
      case "confirm-cancel": {
        const result = cancelRegistration(getMember(), state, event);
        if (result.ok) { commit("Registration cancelled. Sample pass invalidated."); go(id); }
        else { closeSheet(); notice = result.reason; render({ focus: true }); announce(notice); }
        break;
      }
      case "check-in": {
        const result = simulateCheckIn(getMember(), state, event);
        if (result.ok) { commit("Simulated attendance recorded. Lesson completion is unchanged."); go(id, "checked-in"); } else { notice = result.reason; render({ focus: true }); announce(notice); }
        break;
      }
      case "lesson": if (relatedLessons(getMember(), event).some(lesson => lesson.id === trigger.dataset.lesson)) { closeSheet(); openLesson(trigger.dataset.lesson); } break;
      case "calendar": case "offline": case "wallet": case "join":
        if (["registered", "attended"].includes(eventStatus(getMember(), event, state))) previewSheet(name, event);
        else { notice = "A current registration is required."; render({ focus: true }); announce(notice); } break;
      case "progress": closeSheet(); openProgress(); break;
      case "support": closeSheet(); navigate("support"); break;
      case "preview": preview(); break;
      case "close": closeSheet(); break;
      case "retry": load(); body.querySelector("h1").focus(); break;
      case "reset": format = "all"; phase = "ready"; go(); break;
      case "finish-loading": pinnedLoading = false; phase = "ready"; loaded = true; render({ focus: true }); announce("Events loaded."); break;
      case "apply-preview": {
        const choice = document.querySelector("#events-preview-state")?.value;
        if (!["ready", "loading", "error", "empty", "full", "cancelled", "ended", "unavailable"].includes(choice)) break;
        clearTimeout(timer); loaded = true; closeSheet();
        if (["full", "cancelled", "ended"].includes(choice)) {
          const candidate = catalogue().find(item => canAttend(getMember(), item) && !record(item) && (choice === "ended" ? item.end <= Date.now() : item.end > Date.now()));
          if (!candidate) { announce("All sample events have registrations. Use the calendar to review them."); break; }
          navigate(`events/${candidate.id}`);
          // Keep the preview scoped to this route; never persist an event-status override.
          route = { id: candidate.id, view: "detail" }; previewStatus = choice; notice = `${labels[choice]} state preview · sample only.`;
          render({ focus: true });
        } else if (choice === "unavailable") go("missing-2000-01-01");
        else { phase = choice; pinnedLoading = choice === "loading"; go(); }
        break;
      }
    }
  });
  return {
    enter(hash) {
      const next = parseEventRoute(hash);
      if (next.id !== route.id || next.view !== route.view) { previewStatus = null; notice = ""; }
      route = next;
      if (route.view === "list") lastMine = route.mine;
      else route.mine = lastMine;
      if (route.view === "list" && !loaded && !pinnedLoading) load(); else render();
      if (pendingAnnouncement) { announce(pendingAnnouncement); pendingAnnouncement = ""; }
    },
    leave(destination) {
      clearTimeout(timer); live.textContent = "";
      if (phase === "loading" && !pinnedLoading) loaded = false;
      if (destination !== "events") { phase = "ready"; pinnedLoading = false; previewStatus = null; notice = ""; }
    },
    refresh() { render(); }, homeCard, summaryHtml, relatedHtml,
  };
}
