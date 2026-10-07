// Fullscreen affects only the video stage, never the surrounding application.
export function landscapeStage(width, height) {
  const rotate = height > width;
  return { rotate, width: rotate ? height : width, height: rotate ? width : height };
}

export function createPlayerPresentation({ getMedia, getVideo, announce }) {
  let media = null, modal = null, marker = null, operation = 0, orientationRequested = false;
  let isolated = [], ancestorFocus = [];
  const isExpanded = () => Boolean(media && (document.fullscreenElement === media || modal?.open));
  function isolateBackground() {
    for (let branch = media; branch?.parentElement; branch = branch.parentElement) {
      for (const sibling of branch.parentElement.children) if (sibling !== branch && !sibling.inert) { isolated.push(sibling); sibling.inert = true; }
      const parent = branch.parentElement;
      if (parent.hasAttribute("tabindex")) { ancestorFocus.push([parent, parent.getAttribute("tabindex")]); parent.setAttribute("tabindex", "-1"); }
      if (parent === document.body) break;
    }
  }
  function sync() {
    if (!isExpanded()) return;
    const rect = media.getBoundingClientRect(), size = landscapeStage(rect.width, rect.height);
    media.classList.add("is-expanded");
    media.classList.toggle("is-rotated", size.rotate);
    media.style.setProperty("--player-stage-width", `${size.width}px`);
    media.style.setProperty("--player-stage-height", `${size.height}px`);
    media.querySelector('[data-player-action="fullscreen"]').setAttribute("aria-label", "Exit full screen");
    media.querySelector('[data-player-action="fullscreen"]').setAttribute("title", "Exit full screen");
  }
  function unlock() {
    if (!orientationRequested) return;
    orientationRequested = false;
    try { globalThis.screen?.orientation?.unlock?.(); } catch { /* Rotation is browser-dependent. */ }
  }
  function resumeIfNeeded(target, playing) {
    if (playing && target === getVideo()) target.play().catch(() => announce("Playback paused. Press Play to continue."));
  }
  function restore({ focus = true, resume = true } = {}) {
    const previous = media, target = getVideo(), playing = resume && target && !target.paused;
    ++operation; unlock();
    const previousModal = modal; modal = null; media = null;
    for (const element of isolated) element.inert = false;
    for (const [element, value] of ancestorFocus) element.setAttribute("tabindex", value);
    isolated = []; ancestorFocus = [];
    if (previousModal) {
      previousModal.close();
      marker?.replaceWith(previous); marker = null;
      previousModal.remove();
    }
    previous?.classList.remove("is-expanded", "is-rotated");
    previous?.style.removeProperty("--player-stage-width");
    previous?.style.removeProperty("--player-stage-height");
    const control = previous?.querySelector('[data-player-action="fullscreen"]');
    control?.setAttribute("aria-label", "Full screen");
    control?.setAttribute("title", "Full screen");
    if (focus && control?.isConnected) control.focus();
    if (previousModal) resumeIfNeeded(target, playing);
  }
  async function exit(options) {
    const previous = media;
    if (previous && document.fullscreenElement === previous) {
      // Clear local state before the browser's asynchronous fullscreenchange event.
      restore(options);
      try { await document.exitFullscreen(); } catch { /* A browser exit may already be in flight. */ }
    } else restore(options);
  }
  async function enter({ fallback = false } = {}) {
    if (media) return; // Ignore repeated taps while the browser's request is pending.
    const target = getMedia(); if (!target) return;
    const token = ++operation; media = target;
    if (!fallback && target.requestFullscreen && document.fullscreenEnabled) {
      try {
        await target.requestFullscreen();
        if (token !== operation || target !== getMedia()) {
          if (document.fullscreenElement === target) await document.exitFullscreen();
          return;
        }
        isolateBackground(); sync();
        target.querySelector('[data-player-action="fullscreen"]').focus();
        // The user explicitly requested landscape video. Unlock on exit/navigation.
        if (globalThis.screen?.orientation?.lock) {
          orientationRequested = true;
          try { await globalThis.screen.orientation.lock("landscape"); }
          catch { /* The rotated stage provides landscape without device-lock support. */ }
          if (token !== operation) { try { globalThis.screen.orientation.unlock(); } catch {} return; }
        }
        sync(); return;
      } catch { if (token !== operation || target !== getMedia()) return; }
    }
    // A real modal keeps keyboard/screen-reader focus inside the expanded player.
    // Reuse the same media element so position, captions and event listeners survive.
    const video = getVideo(), playing = video && !video.paused;
    marker = document.createComment("inline video position"); target.before(marker);
    modal = document.createElement("dialog");
    modal.className = "player-fullscreen-dialog";
    modal.setAttribute("aria-label", "Full screen video player");
    marker.parentNode.append(modal); modal.append(target);
    modal.addEventListener("cancel", event => { event.preventDefault(); exit(); });
    modal.addEventListener("close", () => { if (modal && !modal.open) restore(); });
    target.classList.add("is-expanded"); modal.showModal(); sync();
    target.querySelector('[data-player-action="fullscreen"]').focus();
    resumeIfNeeded(video, playing);
    announce("Expanded video. Landscape layout. Press Exit full screen or Escape to return.");
  }
  document.addEventListener("fullscreenchange", () => {
    if (!media || modal) return;
    if (document.fullscreenElement === media) sync();
    else restore();
  });
  document.addEventListener("keydown", event => {
    if (!isExpanded() || event.key !== "Tab") return;
    const controls = [...media.querySelectorAll("button, input, select, a[href], summary")].filter(element => element.getClientRects().length && !element.disabled && !element.closest("[hidden], [inert]"));
    const first = controls[0], last = controls.at(-1);
    if (!first) return;
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });
  window.addEventListener("resize", sync);
  globalThis.screen?.orientation?.addEventListener?.("change", sync);
  return { enter, exit, isExpanded, toggle: () => isExpanded() ? exit() : enter(), leave: () => exit({ focus: false, resume: false }) };
}
