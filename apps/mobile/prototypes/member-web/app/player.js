import { playerContext, formatTime, resumePosition, watchedSeconds } from "./player-model.js";
import { requiredMembership } from "./library-model.js";
import { createPlayerPresentation } from "./player-presentation.js";

const escape = value => String(value).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
const icon = name => `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${{
  play: '<path d="m9 5 11 7-11 7Z"/>', pause: '<path d="M9 5v14M16 5v14"/>',
  back: '<path d="M10 5 3 12l7 7M3 12h18"/>', next: '<path d="m14 5 7 7-7 7M21 12H3"/>',
  expand: '<path d="M9 3H3v6m12-6h6v6M3 15v6h6m6 0h6v-6"/>',
  check: '<path d="m5 12 4 4L19 6"/>', warning: '<path d="m12 3 10 18H2Z"/><path d="M12 9v5m0 3v1"/>',
}[name]}</svg>`;

export function createPlayer({ getMember, recordPosition, markComplete, saveProgress, openLesson, openLibrary, openSheet }) {
  const screen = document.querySelector('[data-screen="player"]');
  const body = document.querySelector("#content-player-body");
  const footer = document.querySelector("#player-lesson-actions");
  const status = document.querySelector("#player-announcement");
  let context, video, timer, lastTime = 0, lastWall = 0, lastSave = 0, initialized = false, active = false;
  let savedPosition = 0, error = false, seeking = false, rate = 1, captions = true;
  let memberSnapshot, membershipSnapshot;
  let storageWarned = false;
  const find = selector => screen.querySelector(selector) || document.querySelector("#home-dialog").querySelector(selector);
  const announce = message => { status.textContent = message; if (presentation.isExpanded() && find("#player-live")) find("#player-live").textContent = message; };
  const presentation = createPlayerPresentation({ getMedia: () => find("#player-media"), getVideo: () => video, announce });

  function save() {
    const saved = saveProgress();
    const note = find("#player-save-note");
    if (note) note.textContent = saved ? "Progress saved on this browser." : "Storage unavailable. Progress lasts for this visit only.";
    if (!saved && !storageWarned) announce("Progress couldn't be saved on this browser. You can keep learning, but progress will be lost when this visit ends.");
    storageWarned = !saved;
    return saved;
  }

  function sample() {
    if (!active || !video || !initialized || error) return;
    const now = performance.now();
    const elapsed = !seeking && !video.seeking && !video.paused ? watchedSeconds(lastTime, video.currentTime, (now - lastWall) / 1000, video.playbackRate) : 0;
    recordPosition(context.lesson.id, video.currentTime, elapsed);
    lastTime = video.currentTime; lastWall = now;
    update();
    if (now - lastSave >= 2000) { save(); lastSave = now; }
  }

  function pause() {
    if (!video) return;
    sample(); video.pause(); save();
  }

  function clearLoading() { clearTimeout(timer); }
  function loading(message) {
    if (!active || error) return;
    find("#player-media").setAttribute("aria-busy", "true");
    find("#player-media-state").textContent = message;
    announce(message);
    clearLoading();
    timer = setTimeout(() => fail("The video is taking too long to load. Check your connection and try again."), 15000);
  }

  function fail(message) {
    if (!active || !video) return;
    clearLoading();
    // Some failures reset currentTime to zero. Preserve the last good sample in that case.
    if (video.readyState > 0) sample();
    error = true; video.pause(); save();
    find("#player-media").setAttribute("aria-busy", "false");
    find("#player-error").hidden = false;
    find("#player-error-copy").textContent = message;
    find("#player-media-state").textContent = "Playback unavailable";
    find("#player-controls").inert = true;
    find("#player-controls").setAttribute("aria-disabled", "true");
    find("#player-complete").disabled = true;
    if (find("#player-controls").contains(document.activeElement)) find("#player-error-title").focus();
    announce(`Playback error. ${message} Your saved progress is unchanged.`);
  }

  function update() {
    if (!video || !initialized) return;
    const duration = video.duration;
    const position = Math.min(duration, video.currentTime);
    const percent = Math.min(100, Math.floor(position / duration * 100));
    const range = find("#player-position");
    if (range && document.activeElement !== range) range.value = position;
    range?.setAttribute("aria-valuetext", `${formatTime(position)} of ${formatTime(duration)}`);
    find("#player-time").textContent = `${formatTime(position)} / ${formatTime(duration)}`;
    if (find("#player-options-time")) find("#player-options-time").textContent = `${formatTime(position)} / ${formatTime(duration)} · ${percent}%`;
    const playLabel = video.ended ? "Replay" : video.paused ? (position ? "Resume" : "Play") : "Pause";
    find("#player-play").innerHTML = icon(video.paused ? "play" : "pause");
    find("#player-play").setAttribute("aria-label", playLabel);
    find("#player-play").setAttribute("title", playLabel);
    const complete = getMember().completed.includes(context.lesson.id);
    find("#player-completion").textContent = complete ? "✓ Lesson complete" : position > 0 ? "In progress" : "Not started";
    find("#player-completion").classList.toggle("is-complete", complete);
    find("#player-complete").innerHTML = `${icon("check")}<span>${complete ? "Lesson complete" : "Mark complete"}</span>`;
    find("#player-complete").disabled = complete || error;
  }

  function complete() {
    if (!initialized || error || !video || context.state !== "ready") return;
    pause();
    markComplete(context.lesson.id);
    // Keep the actual last viewing position; completion is an independent explicit state.
    recordPosition(context.lesson.id, video.currentTime, 0);
    const saved = save(); update();
    announce(`Lesson complete. Home and Library progress updated.${saved ? " Saved on this browser." : " Progress is kept for this visit only."}${context.next ? " Next lesson is ready when you are." : " This is the last lesson in this collection."}`);
  }

  function setCaptions() {
    if (!video) return;
    for (const track of video.textTracks) track.mode = captions ? "showing" : "hidden";
    find("#player-captions")?.setAttribute("aria-pressed", String(captions));
  }

  function attachMedia() {
    video = find("#lesson-video");
    // Two named overlay controls replace the browser's inline control bar.
    // The controls attribute remains as a native fallback before JS initializes.
    video.controls = false;
    video.playbackRate = rate;
    const currentVideo = video;
    const listen = (event, callback) => currentVideo.addEventListener(event, () => {
      if (active && video === currentVideo) callback();
    });
    listen("loadedmetadata", () => {
      if (!Number.isFinite(video.duration) || video.duration <= 0) { fail("This recording has no playable video. Please contact support."); return; }
      initialized = true;
      const position = resumePosition(savedPosition, video.duration);
      video.currentTime = position;
      lastTime = position; lastWall = performance.now();
      if (find("#player-position")) find("#player-position").max = video.duration;
      find("#player-controls").inert = false;
      find("#player-controls").removeAttribute("aria-disabled");
      find("#player-complete").disabled = getMember().completed.includes(context.lesson.id);
      find("#player-media-state").textContent = position ? `Ready to resume at ${formatTime(position)}` : "Ready when you are";
      clearLoading(); setCaptions(); update();
      announce(position ? `Video ready. Resume at ${formatTime(position)}.` : "Video ready. Press Play to start.");
    });
    listen("canplay", () => { clearLoading(); find("#player-media").setAttribute("aria-busy", "false"); if (!error) find("#player-media-state").textContent = video.paused ? (video.currentTime ? `Ready to resume at ${formatTime(video.currentTime)}` : "Ready when you are") : "Playing"; });
    listen("playing", () => { clearLoading(); lastTime = video.currentTime; lastWall = performance.now(); find("#player-media-state").textContent = "Playing"; update(); });
    listen("pause", () => { if (!error) { sample(); save(); find("#player-media-state").textContent = video.ended ? "Finished" : "Paused"; update(); } });
    listen("timeupdate", sample);
    listen("seeking", () => { seeking = true; });
    listen("seeked", () => { seeking = false; lastTime = video.currentTime; lastWall = performance.now(); sample(); save(); });
    listen("waiting", () => loading("Buffering video…"));
    listen("stalled", () => { if (video.readyState < 3) loading("Waiting for the video…"); });
    listen("ended", () => { clearLoading(); complete(); });
    listen("error", () => fail(video.error?.code === 4 ? "This recording couldn't be opened. Try again, or contact support." : "The video couldn't load. Check your connection and try again."));
    video.querySelector("track").addEventListener("error", () => {
      if (active && video === currentVideo) announce("Captions couldn't load. A visual description is available below the video.");
    });
    setCaptions(); loading("Loading video…");
    video.src = `./assets/video/${context.lesson.id}.mp4`;
    video.load();
  }

  function renderUnavailable() {
    const lesson = context.lesson;
    const locked = context.state === "locked";
    body.innerHTML = `<button class="player-back" type="button" data-player-action="library">${icon("back")} Library</button>
      <div class="player-unavailable">${icon("warning")}<p class="ds-eyebrow">${escape(lesson?.course || "Your learning")}</p><h1 id="player-title" tabindex="-1">${locked ? "Not included" : "Not available"}</h1>${lesson ? `<h2>${escape(lesson.title)}</h2>` : ""}<p>${escape(locked ? `This lesson needs ${requiredMembership(lesson)} membership. Your included lessons are still available.` : lesson?.unavailableReason || "This lesson is no longer available. Choose another lesson from your library.")}</p></div>`;
    footer.innerHTML = `<button class="ds-button ds-button--solid app-button" type="button" data-player-action="library">Back to library</button><button class="text-button" type="button" data-home-action="${locked ? "membership" : "support"}">${locked ? "View membership" : "Contact support"}</button>`;
    announce(locked ? "This lesson isn't included in your membership." : "This lesson is unavailable.");
  }

  function enter(id, { capture = true } = {}) {
    leave({ capture }); active = true; context = playerContext(getMember(), id);
    memberSnapshot = getMember(); membershipSnapshot = memberSnapshot.membership;
    document.title = `${context.state === "ready" ? context.lesson.title : context.state === "locked" ? "Not included" : "Not available"} - Master App`;
    if (context.state !== "ready") { renderUnavailable(); return; }
    const { lesson, index, queue, previous, next } = context;
    savedPosition = getMember().positions[id] || 0;
    body.innerHTML = `<header class="player-header"><button class="player-back" type="button" data-player-action="library">${icon("back")} Library</button><button class="library-options" id="player-options" type="button" data-player-action="preview" aria-label="Playback options" aria-haspopup="dialog">···</button></header>
      <div class="player-heading"><p class="ds-eyebrow">${escape(lesson.course)} · ${index + 1} of ${queue.length}</p><h1 id="player-title" tabindex="-1">${escape(lesson.title)}</h1><p class="player-meta"><span>${lesson.minutes} min lesson</span><span id="player-completion">${getMember().completed.includes(id) ? "✓ Lesson complete" : savedPosition ? "In progress" : "Not started"}</span></p></div>
      <section class="player-media" id="player-media" aria-label="Video player">
        <div class="player-stage">
        <video id="lesson-video" controls playsinline preload="metadata" poster="./assets/video/poster.svg" aria-label="${escape(lesson.title)} — silent gradient placeholder" aria-describedby="player-demo-note"><track kind="captions" src="./assets/video/${id}.vtt" srclang="en" label="English" default></video>
        <div class="player-error" id="player-error" hidden><h2 id="player-error-title" tabindex="-1">Couldn't play</h2><p id="player-error-copy"></p><button class="ds-button ds-button--solid" type="button" data-player-action="retry">Try again</button><button class="text-button" type="button" data-home-action="support">Contact support</button></div>
        <p class="ds-visually-hidden" id="player-media-state">Loading video…</p>
        <p class="player-fullscreen-only player-clock ds-number" id="player-time">0:00 / ${lesson.minutes}:00</p>
        <div class="player-controls" id="player-controls" inert aria-disabled="true">
          <button class="player-overlay-button" id="player-play" type="button" data-player-action="play" aria-label="Play" aria-describedby="player-media-state" title="Play">${icon("play")}</button>
          <div class="player-fullscreen-only player-skip-controls"><button class="player-overlay-button" type="button" data-player-action="rewind" aria-label="Back 10 seconds">−10</button><button class="player-overlay-button" type="button" data-player-action="forward" aria-label="Forward 10 seconds">+10</button></div>
        </div>
        <button class="player-overlay-button player-expand" id="player-fullscreen" type="button" data-player-action="fullscreen" aria-label="Full screen" title="Full screen">${icon("expand")}</button>
        <div class="ds-visually-hidden" id="player-live" role="status" aria-live="polite"></div>
        </div>
      </section>
      <p class="player-demo-note" id="player-demo-note">Video placeholder. Course recording coming soon.</p>
      <section class="player-takeaway"><p class="ds-eyebrow">One idea to take away</p><p>${escape(lesson.takeaway)}</p></section>
      <details class="player-transcript"><summary>Visual description</summary><p>A static dark gradient. This placeholder has no audio, text or lesson footage.</p></details>
      <p class="player-save-note" id="player-save-note">Progress saves on this browser, not across devices.</p>`;
    footer.innerHTML = `<button class="ds-button ds-button--solid app-button player-complete" id="player-complete" type="button" data-player-action="complete" disabled>${icon("check")}<span>Mark complete</span></button>
      <div class="player-lesson-nav" aria-label="Lesson navigation"><button type="button" data-player-action="previous" ${previous ? `aria-label="Previous lesson: ${escape(previous.title)}"` : "disabled"}>${icon("back")} Previous</button><span>${index + 1} / ${queue.length}</span><button type="button" data-player-action="next" ${next ? `aria-label="Next lesson: ${escape(next.title)}"` : "disabled"}>Next ${icon("next")}</button></div>`;
    attachMedia();
  }

  function leave({ capture = true } = {}) {
    presentation.leave();
    if (active && video) {
      if (capture) pause();
      else { active = false; video.pause(); }
      video.removeAttribute("src"); video.load();
    }
    active = false; initialized = false; error = false; seeking = false; video = null;
    clearLoading(); status.textContent = "";
  }

  document.addEventListener("input", event => {
    if (!active || event.target.id !== "player-position" || !initialized || error) return;
    seeking = true; video.currentTime = Number(event.target.value);
    event.target.setAttribute("aria-valuetext", `${formatTime(video.currentTime)} of ${formatTime(video.duration)}`);
  });
  document.addEventListener("change", event => {
    if (active && event.target.id === "player-speed" && video) { sample(); rate = Number(event.target.value); video.playbackRate = rate; lastWall = performance.now(); }
  });
  document.addEventListener("click", async event => {
    const button = event.target.closest("[data-player-action]");
    if (!button || !active || button.disabled) return;
    const action = button.dataset.playerAction;
    if (action === "library") { openLibrary(); return; }
    if (action === "previous" && context.previous) { openLesson(context.previous.id); return; }
    if (action === "next" && context.next) { openLesson(context.next.id); return; }
    if (action === "preview") {
      pause();
      openSheet("player-preview", "Playback options", `<div class="player-options-content"><label for="player-position">Video position</label><input id="player-position" type="range" min="0" max="${initialized ? video.duration : context.lesson.minutes * 60}" step="1" value="${video.currentTime || 0}" ${!initialized || error ? "disabled" : ""} /><p class="ds-number" id="player-options-time"></p><div class="player-settings"><button type="button" id="player-captions" data-player-action="captions" aria-pressed="${captions}">Captions</button><label for="player-speed">Speed</label><select id="player-speed"><option value="0.75">0.75×</option><option value="1">1×</option><option value="1.25">1.25×</option><option value="1.5">1.5×</option><option value="2">2×</option></select></div></div><details class="demo-controls"><summary>Demo settings</summary><p>Preview browser fallback or a recoverable playback error.</p><button class="ds-button app-button" type="button" data-player-action="preview-fullscreen">Preview in-app full screen</button><button class="text-button" type="button" data-player-action="simulate-error">Show playback error</button></details>`, '<button class="ds-button ds-button--solid app-button" type="button" data-home-action="close">Back to lesson</button>');
      find("#player-speed").value = String(rate); update();
      return;
    }
    if (action === "fullscreen") { await presentation.toggle(); return; }
    if (action === "preview-fullscreen") { document.querySelector("#home-dialog").close(); await presentation.enter({ fallback: true }); return; }
    if (action === "simulate-error") {
      document.querySelector("#home-dialog").close(); pause();
      // Exercise the actual media error event, without throwing away the saved position.
      initialized = false;
      video.src = "./assets/video/missing-demo.mp4";
      video.load();
      return;
    }
    if (action === "retry") { enter(context.lesson.id); find("#player-title").focus(); return; }
    if (!video || !initialized || error) return;
    if (action === "complete") complete();
    if (action === "play") {
      if (!video.paused) pause();
      else {
        const target = video;
        try { await target.play(); }
        catch (reason) {
          if (!active || target !== video || reason.name === "AbortError") return;
          if (reason.name === "NotAllowedError") announce("Playback needs your permission. Tap Play to start the video.");
          else fail("Playback couldn't start. Try again, or contact support.");
        }
      }
    }
    if (action === "rewind" || action === "forward") { seeking = true; video.currentTime = Math.max(0, Math.min(video.duration, video.currentTime + (action === "rewind" ? -10 : 10))); }
    if (action === "captions") { captions = !captions; setCaptions(); }
  });
  // No background audio; save when switching apps, navigating away, or opening a sheet.
  document.addEventListener("visibilitychange", () => { if (document.hidden && active) pause(); });
  window.addEventListener("pagehide", () => { if (active) pause(); });
  new MutationObserver(() => { if (document.querySelector("#home-dialog").open && active) pause(); }).observe(document.querySelector("#home-dialog"), { attributes: true, attributeFilter: ["open"] });
  function refresh() {
    if (!active) return;
    if (getMember() !== memberSnapshot || getMember().membership !== membershipSnapshot) enter(context.lesson?.id || "", { capture: false });
    else if (video) update();
  }
  return { enter, leave, pause, refresh };
}
