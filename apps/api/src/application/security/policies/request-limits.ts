export const THROTTLE_POLICY = Object.freeze({
  ip: { capacity: 600, intervalMs: 60_000 },
  subject: { capacity: 600, intervalMs: 60_000 },
});
export const MAX_RPC_BATCH_SIZE = 20;
