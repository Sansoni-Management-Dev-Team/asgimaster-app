// A retry shares an unresolved operation; an acknowledged save starts a new operation.
export function createPendingOperation(
  newKey = () => `onboarding-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`,
) {
  let pending: { payload: string; key: string } | undefined;
  return {
    keyFor(payload: unknown) {
      const serialized = JSON.stringify(payload);
      if (pending?.payload !== serialized) pending = { payload: serialized, key: newKey() };
      return pending.key;
    },
    acknowledge(key: string) {
      if (pending?.key === key) pending = undefined;
    },
  };
}
