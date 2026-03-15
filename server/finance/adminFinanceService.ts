/**
 * Admin: player list for settlement report dropdown. Settlement-only; no legacy dashboard.
 */

import { getPlayerFinancialProfile } from "./playerFinanceService";

export interface GetPlayerFinanceListInput {
  search?: string;
  agentId?: number | null;
  from?: string;
  to?: string;
  limit?: number;
  cursor?: number;
}

export async function getPlayerFinanceList(opts: GetPlayerFinanceListInput = {}): Promise<{
  players: import("./types").PlayerFinancialProfile[];
  nextCursor: number | null;
}> {
  const { getAllUsers } = await import("../db");
  const all = await getAllUsers({ includeDeleted: false });
  const users = all.filter((u) => (u as { role?: string }).role === "user");
  let filtered = users;
  if (opts.search && opts.search.trim()) {
    const q = opts.search.trim().toLowerCase();
    filtered = filtered.filter(
      (u) =>
        String((u as { username?: string }).username ?? "").toLowerCase().includes(q) ||
        String((u as { name?: string }).name ?? "").toLowerCase().includes(q)
    );
  }
  if (opts.agentId != null && opts.agentId > 0) {
    filtered = filtered.filter((u) => (u as { agentId?: number | null }).agentId === opts.agentId);
  }
  const limit = Math.min(opts.limit ?? 200, 500);
  const cursor = opts.cursor ?? 0;
  const slice = filtered.slice(cursor, cursor + limit);
  const players: import("./types").PlayerFinancialProfile[] = [];
  const filter = opts.from != null || opts.to != null ? { from: opts.from, to: opts.to } : undefined;
  for (const u of slice) {
    const id = (u as { id: number }).id;
    const profile = await getPlayerFinancialProfile(id, filter);
    if (profile) players.push(profile);
  }
  const nextCursor = cursor + slice.length < filtered.length ? cursor + slice.length : null;
  return { players, nextCursor };
}
