// Source facts only. These references do not establish application identity or access.
export type MaxioRegion = 'AU' | 'NZ';
export type MaxioSubscription = {
  reference: string;
  id: string;
  state: string;
  productId: string | null;
  productHandle: string | null;
  updatedAt: string;
};
export type MaxioMember = {
  reference: string;
  customerId: string;
  email: string;
  subscriptions: MaxioSubscription[];
};
export type MaxioSnapshot = {
  region: MaxioRegion;
  site: string;
  collectedAt: string;
  members: MaxioMember[];
  evidence: { pages: number; subscriptions: number; terminalEmptyPage: true };
};
export type MaxioFailureCode =
  | 'not_configured'
  | 'invalid_configuration'
  | 'unavailable'
  | 'rate_limited'
  | 'malformed'
  | 'incomplete'
  | 'empty';
export type MaxioResult =
  | { status: 'complete'; snapshot: MaxioSnapshot }
  | { status: 'failed'; region: MaxioRegion; code: MaxioFailureCode };
export type MaxioCollection = { AU: MaxioSnapshot; NZ: MaxioSnapshot };
