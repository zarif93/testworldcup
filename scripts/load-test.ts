/**
 * בדיקת עומס מדומה – שולח N בקשות ל-API ומדווח על הצלחות וזמני תגובה.
 * דורש שרת רץ (pnpm dev או pnpm start). הרצה: pnpm exec tsx scripts/load-test.ts [baseUrl] [concurrency] [total]
 * ברירת מחדל: baseUrl=http://localhost:${process.env.PORT || 3000}, concurrency=5, total=50
 */
const DEFAULT_PORT = process.env.PORT || "3000";
const BASE = process.argv[2] ?? `http://localhost:${DEFAULT_PORT}`;
const CONCURRENCY = Math.max(1, parseInt(process.argv[3] ?? "5", 10));
const TOTAL = Math.max(1, parseInt(process.argv[4] ?? "50", 10));

const trpcUrl = `${BASE}/api/trpc/tournaments.getAll`;

async function oneRequest() {
  const start = Date.now();
  try {
    const res = await fetch(trpcUrl, { method: "GET" });
    const ok = res.ok;
    const body = await res.text();
    return { ok, ms: Date.now() - start, status: res.status };
  } catch (e) {
    return { ok: false, ms: Date.now() - start, status: 0, error: String(e) };
  }
}

async function run() {
  console.log("Load test:", { baseUrl: BASE, concurrency: CONCURRENCY, total: TOTAL });
  const startAll = Date.now();
  const results = { ok: 0, fail: 0, times: [] as number[] };

  const workers = Array.from({ length: CONCURRENCY }, async () => {
    while (results.ok + results.fail < TOTAL) {
      const r = await oneRequest();
      if (r.ok) {
        results.ok++;
        results.times.push(r.ms);
      } else results.fail++;
    }
  });

  await Promise.all(workers);
  const elapsed = Date.now() - startAll;
  const times = results.times.sort((a, b) => a - b);
  const p50 = times[Math.floor(times.length * 0.5)] ?? 0;
  const p95 = times[Math.floor(times.length * 0.95)] ?? 0;

  console.log("Done in", elapsed, "ms");
  console.log("OK:", results.ok, "Fail:", results.fail);
  console.log("Latency ms – p50:", p50, "p95:", p95);
  process.exit(results.fail > 0 ? 1 : 0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
