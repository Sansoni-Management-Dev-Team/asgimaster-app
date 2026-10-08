// One navigation definition keeps all member screens in sync.
export const memberNavigation = [
  { label: "Home", action: "today", screen: "home", path: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z"/>' },
  { label: "Library", action: "library", screen: "library", path: '<path d="M12 5v15M3 4l9 2 9-2v14l-9 2-9-2Z"/>' },
  { label: "Events", action: "events", screen: "events", path: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 11h18m-13 4h2m4 0h2"/>' },
  { label: "Coach", action: "coach", screen: "coach", path: '<circle cx="9" cy="7" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2M16 4h5v7l-3-2h-2"/>' },
  { label: "Support", action: "support", screen: "support", path: '<path d="M4 13v-2a8 8 0 0 1 16 0v6a4 4 0 0 1-4 4h-3"/><rect x="2" y="11" width="4" height="7" rx="2"/><rect x="18" y="11" width="4" height="7" rx="2"/>' },
];

export function renderMemberNavigation(activeScreen) {
  return memberNavigation.map(item => `<button type="button" data-home-action="${item.action}" ${item.screen === activeScreen ? 'aria-current="page"' : ""} ${!item.screen ? 'aria-haspopup="dialog"' : ""}><svg class="member-nav-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${item.path}</svg><span class="member-nav-label">${item.label}</span></button>`).join("");
}
