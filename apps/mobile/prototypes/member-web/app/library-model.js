import { lessons, canWatch } from "./home-model.js";

export const collections = [
  { id: "foundations", title: "Your foundations", description: "Make space for what matters.", number: "01", motif: "steps" },
  { id: "growth", title: "Growth foundations", description: "Turn clear priorities into progress.", number: "02", motif: "orbit" },
  { id: "leadership", title: "Lead with clarity", description: "Build a team that moves with you.", number: "03", motif: "steps" },
  { id: "sessions", title: "Live sessions", description: "Fresh perspectives from your consultant.", number: "04", motif: "orbit" },
  { id: "workshops", title: "Master workshops", description: "Go deeper into your next stage.", number: "05", motif: "steps" },
];

// Public catalogue metadata only. Actual lessons remain the same local previews as Home.
export const libraryCatalogue = [
  ...lessons.map(lesson => ({ ...lesson, collection: collections.find(item => item.title === lesson.course).id })),
  { id: "live-review", title: "The monthly reset", course: "Live sessions", collection: "sessions", access: "growth", available: false, minutes: 30, tags: ["review", "priorities", "live"], takeaway: "A guided review of your priorities and progress.", unavailableReason: "This session recording is being prepared. It will appear here when it's ready." },
  { id: "scaling", title: "Scale with intention", course: "Master workshops", collection: "workshops", access: "master", minutes: 45, tags: ["growth", "strategy", "scale"], takeaway: "A deeper look at growing your business sustainably." },
];

export function contentState(member, item) {
  if (!canWatch(member, item)) return "locked";
  if (item.available === false) return "unavailable";
  if (member.completed.includes(item.id)) return "completed";
  return member.positions[item.id] > 0 ? "in-progress" : "not-started";
}

export function requiredMembership(item) {
  return item.access === "master" ? "Master" : item.access === "growth" ? "Growth" : "Essentials";
}

export function getLibrary(member, filters = {}, catalogue = libraryCatalogue) {
  const scope = filters.scope === "all" ? "all" : "included";
  const progress = ["in-progress", "completed", "not-started"].includes(filters.progress) ? filters.progress : "all";
  const query = String(filters.query || "").trim().toLowerCase();
  const scoped = catalogue.filter(item => scope === "all" || canWatch(member, item));
  const options = collections.filter(collection => scoped.some(item => item.collection === collection.id));
  // A membership change cannot leave a previously selected, now-ineligible collection active.
  const collection = options.some(item => item.id === filters.collection) ? filters.collection : "all";
  const words = query.split(/\s+/).filter(Boolean);
  const items = scoped.filter(item => {
    const text = `${item.title} ${item.course} ${item.takeaway} ${item.tags.join(" ")}`.toLowerCase();
    return (collection === "all" || item.collection === collection)
      && (progress === "all" || contentState(member, item) === progress)
      && words.every(word => text.includes(word));
  });
  const groups = options.map(group => {
    const entries = items.filter(item => item.collection === group.id);
    return { ...group, items: entries, ready: entries.filter(item => !["locked", "unavailable"].includes(contentState(member, item))), completed: entries.filter(item => contentState(member, item) === "completed").length };
  }).filter(group => group.items.length);
  return {
    scope, progress, collection, query, items, groups, options,
    overview: !query && collection === "all" && progress === "all",
    includedCount: catalogue.filter(item => canWatch(member, item) && item.available !== false).length,
    comingSoonCount: catalogue.filter(item => canWatch(member, item) && item.available === false).length,
    lockedCount: catalogue.filter(item => !canWatch(member, item)).length,
  };
}
