// Prototype release switch: use "waitlist" for a not-yet-launched coach,
// "unavailable" for a service outage, or "demo" for clearly labelled scripted replies.
// There is deliberately no live API endpoint, API key, waitlist submission or support delivery.
export const coachConfig = Object.freeze({
  mode: "demo",
  responseDelayMs: 950,
});
