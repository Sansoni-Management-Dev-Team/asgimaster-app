// Supplied, published destinations only. Do not guess a Maxio tenant URL or use its homepage.
// Production: obtain account-specific portal URLs from an authenticated server, never local storage.
// Do not commit private login tokens, API keys or signed customer URLs here.
export const profileConfig = Object.freeze({
  maxio: Object.freeze({ url: null, allowedOrigins: [] }),
  privacy: Object.freeze({ url: null, allowedOrigins: [] }),
  terms: Object.freeze({ url: null, allowedOrigins: [] }),
  demoMemberId: "MA-00428",
  demoEmail: "shan@example.com",
  demoRenewalDate: "2026-10-07",
});
