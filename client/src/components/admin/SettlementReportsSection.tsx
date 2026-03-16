/**
 * Settlement-based reporting. Real-money accounting (points as internal credit).
 * Excel-first, RTL Hebrew, signed values (+ / -). No analytics, no wallet dashboards.
 */

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Download, Loader2 } from "lucide-react";

type ReportTab = "global" | "agent" | "player" | "freeroll";

function formatNum(n: number): string {
  return Number.isFinite(n) ? n.toLocaleString("he-IL") : "0";
}

function signed(n: number): string {
  return n >= 0 ? `+${formatNum(n)}` : formatNum(n);
}

type Props = { onBack: () => void };

export function SettlementReportsSection({ onBack }: Props) {
  const [tab, setTab] = useState<ReportTab>("global");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [playerUserId, setPlayerUserId] = useState<number | "">("");
  const [agentId, setAgentId] = useState<number | "">("");

  const utils = trpc.useUtils();

  const { data: globalReport, isLoading: globalLoading } = trpc.admin.getGlobalSettlementReport.useQuery(
    { from: from || undefined, to: to || undefined },
    { enabled: tab === "global" }
  );

  const { data: agentReport, isLoading: agentLoading } = trpc.admin.getAgentSettlementReport.useQuery(
    { agentId: agentId === "" ? 0 : agentId, from: from || undefined, to: to || undefined },
    { enabled: tab === "agent" && agentId !== "" }
  );

  const { data: playerReport, isLoading: playerLoading } = trpc.admin.getPlayerSettlementReport.useQuery(
    { userId: playerUserId === "" ? 0 : playerUserId, from: from || undefined, to: to || undefined },
    { enabled: tab === "player" && playerUserId !== "" }
  );

  const { data: freerollReport, isLoading: freerollLoading } = trpc.admin.getFreerollSettlementReport.useQuery(
    { from: from || undefined, to: to || undefined },
    { enabled: tab === "freeroll" }
  );

  const { data: agentsList } = trpc.admin.getAgentsWithBalances.useQuery(undefined, { enabled: tab === "agent" });
  const { data: playersList } = trpc.admin.getPlayerFinanceList.useQuery(
    { limit: 500 },
    { enabled: tab === "player" }
  );

  const downloadGlobalCsv = async () => {
    const { csv } = await utils.admin.exportGlobalSettlementCSV.fetch({ from: from || undefined, to: to || undefined });
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `settlement_global_${from || "מ"}_${to || "עד"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadAgentCsv = async () => {
    if (agentId === "") return;
    const { csv } = await utils.admin.exportAgentSettlementCSV.fetch({
      agentId: Number(agentId),
      from: from || undefined,
      to: to || undefined,
    });
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `settlement_agent_${agentId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadPlayerCsv = async () => {
    if (playerUserId === "") return;
    const { csv } = await utils.admin.exportPlayerSettlementCSV.fetch({
      userId: Number(playerUserId),
      from: from || undefined,
      to: to || undefined,
    });
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `settlement_player_${playerUserId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadFreerollCsv = async () => {
    const { csv } = await utils.admin.exportFreerollSettlementCSV.fetch({ from: from || undefined, to: to || undefined });
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `settlement_freeroll_${from || "מ"}_${to || "עד"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4 p-4" dir="rtl">
      <Button variant="ghost" size="sm" className="text-slate-400" onClick={onBack}>
        <ArrowLeft className="w-4 h-4 ml-1" />
        חזרה
      </Button>
      <h2 className="text-xl font-bold text-white">מרכז כספים</h2>
      <p className="text-slate-400 text-sm">עמלה לפי אחוז העמלה של כל תחרות (אחרי חלוקת פרסים). רק תחרויות שהוסדרו. תחרויות שבוטלו — החזר מלא, לא בדוח. פרירול — הוצאה אתר, ללא עמלה.</p>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-slate-500 text-sm">תקופה:</span>
        <Input type="date" className="w-36 h-9 bg-slate-800 border-slate-600 text-slate-200" value={from} onChange={(e) => setFrom(e.target.value)} placeholder="מ-" />
        <span className="text-slate-500">–</span>
        <Input type="date" className="w-36 h-9 bg-slate-800 border-slate-600 text-slate-200" value={to} onChange={(e) => setTo(e.target.value)} placeholder="עד" />
      </div>

      <div className="flex flex-wrap gap-2 border-b border-slate-700 pb-2">
        <Button variant={tab === "global" ? "default" : "outline"} size="sm" className={tab !== "global" ? "border-slate-600 text-slate-300" : ""} onClick={() => setTab("global")}>
          גלובלי
        </Button>
        <Button variant={tab === "agent" ? "default" : "outline"} size="sm" className={tab !== "agent" ? "border-slate-600 text-slate-300" : ""} onClick={() => setTab("agent")}>
          סוכן
        </Button>
        <Button variant={tab === "player" ? "default" : "outline"} size="sm" className={tab !== "player" ? "border-slate-600 text-slate-300" : ""} onClick={() => setTab("player")}>
          שחקן
        </Button>
        <Button variant={tab === "freeroll" ? "default" : "outline"} size="sm" className={tab !== "freeroll" ? "border-slate-600 text-slate-300" : ""} onClick={() => setTab("freeroll")}>
          הוצאות פרירול
        </Button>
      </div>

      {/* Global */}
      {tab === "global" && (
        <>
          {globalLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>
          ) : globalReport ? (
            <>
              <div className="grid grid-cols-1 gap-3 max-w-md">
                <Card className="bg-slate-800/60 border-slate-700">
                  <CardContent className="p-4">
                    <p className="text-slate-400 text-xs mb-1">סה״כ רווח אתר (תחרויות שהוסדרו)</p>
                    <p className={`text-xl font-bold tabular-nums ${globalReport.summary.totalSiteProfit >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {signed(globalReport.summary.totalSiteProfit)}
                    </p>
                  </CardContent>
                </Card>
              </div>
              <div className="flex justify-end">
                <Button size="sm" variant="outline" className="border-slate-600 text-slate-300" onClick={downloadGlobalCsv}>
                  <Download className="w-4 h-4 ml-1" />
                  ייצוא CSV
                </Button>
              </div>
              <Card className="bg-slate-800/60 border-slate-700 overflow-hidden">
                <div className="overflow-x-auto max-h-[60vh]">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-slate-700 bg-slate-800/95">
                        <TableHead className="text-slate-300 text-right font-semibold">שחקן</TableHead>
                        <TableHead className="text-slate-300 text-right font-semibold">סוכן</TableHead>
                        <TableHead className="text-slate-300 text-right font-semibold">סה״כ השתתפויות</TableHead>
                        <TableHead className="text-slate-300 text-right font-semibold">זכיות</TableHead>
                        <TableHead className="text-slate-300 text-right font-semibold">עמלת אתר</TableHead>
                        <TableHead className="text-slate-300 text-right font-semibold">תוצאה</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {globalReport.rows.map((r) => (
                        <TableRow key={r.userId} className="border-slate-700">
                          <TableCell className="text-slate-200 text-right">{r.player}</TableCell>
                          <TableCell className="text-slate-300 text-right">{r.agent ?? "—"}</TableCell>
                          <TableCell className="text-slate-300 text-right tabular-nums">{formatNum(r.entries)}</TableCell>
                          <TableCell className="text-slate-300 text-right tabular-nums">{formatNum(r.winnings)}</TableCell>
                          <TableCell className="text-slate-300 text-right tabular-nums">{formatNum(r.siteCommission)}</TableCell>
                          <TableCell className={`text-right tabular-nums font-medium ${r.result >= 0 ? "text-emerald-400" : "text-red-400"}`}>{signed(r.result)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </Card>
            </>
          ) : (
            <p className="text-slate-400 py-4">טוען...</p>
          )}
        </>
      )}

      {/* Agent */}
      {tab === "agent" && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-slate-400 text-sm">סוכן:</label>
            <select
              className="h-9 rounded-md bg-slate-800 border border-slate-600 text-slate-200 text-sm px-2 min-w-[160px]"
              value={agentId}
              onChange={(e) => setAgentId(e.target.value === "" ? "" : Number(e.target.value))}
            >
              <option value="">בחר סוכן</option>
              {(agentsList ?? []).map((a: { id: number; username?: string | null }) => (
                <option key={a.id} value={a.id}>{a.username ?? `#${a.id}`}</option>
              ))}
            </select>
          </div>
          {agentId === "" ? (
            <p className="text-slate-400 py-4">בחר סוכן</p>
          ) : agentLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>
          ) : agentReport ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-2xl">
                <Card className="bg-slate-800/60 border-slate-700">
                  <CardContent className="p-4">
                    <p className="text-slate-400 text-xs mb-1">סה״כ עמלת סוכן</p>
                    <p className="text-xl font-bold tabular-nums text-slate-200">{formatNum(agentReport.summary.totalAgentCommission)}</p>
                  </CardContent>
                </Card>
                <Card className="bg-slate-800/60 border-slate-700">
                  <CardContent className="p-4">
                    <p className="text-slate-400 text-xs mb-1">סה״כ תוצאה שחקנים</p>
                    <p className={`text-xl font-bold tabular-nums ${agentReport.summary.totalPlayersResult >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {signed(agentReport.summary.totalPlayersResult)}
                    </p>
                  </CardContent>
                </Card>
                <Card className="bg-slate-800/60 border-slate-700">
                  <CardContent className="p-4">
                    <p className="text-slate-400 text-xs mb-1">יתרת סוכן מול אתר</p>
                    <p className={`text-xl font-bold tabular-nums ${agentReport.summary.agentFinalBalanceVsSite >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {signed(agentReport.summary.agentFinalBalanceVsSite)}
                    </p>
                  </CardContent>
                </Card>
              </div>
              <div className="flex justify-end">
                <Button size="sm" variant="outline" className="border-slate-600 text-slate-300" onClick={downloadAgentCsv}>
                  <Download className="w-4 h-4 ml-1" />
                  ייצוא CSV
                </Button>
              </div>
              <Card className="bg-slate-800/60 border-slate-700 overflow-hidden">
                <div className="overflow-x-auto max-h-[60vh]">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-slate-700 bg-slate-800/95">
                        <TableHead className="text-slate-300 text-right font-semibold">שחקן</TableHead>
                        <TableHead className="text-slate-300 text-right font-semibold">סה״כ השתתפויות</TableHead>
                        <TableHead className="text-slate-300 text-right font-semibold">עמלת סוכן</TableHead>
                        <TableHead className="text-slate-300 text-right font-semibold">תוצאה שחקן</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {agentReport.rows.map((r) => (
                        <TableRow key={r.userId} className="border-slate-700">
                          <TableCell className="text-slate-200 text-right">{r.player}</TableCell>
                          <TableCell className="text-slate-300 text-right tabular-nums">{formatNum(r.entries)}</TableCell>
                          <TableCell className="text-slate-300 text-right tabular-nums">{formatNum(r.agentCommission)}</TableCell>
                          <TableCell className={`text-right tabular-nums font-medium ${r.result >= 0 ? "text-emerald-400" : "text-red-400"}`}>{signed(r.result)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </Card>
            </>
          ) : (
            <p className="text-slate-400 py-4">סוכן לא נמצא או אין נתונים</p>
          )}
        </>
      )}

      {/* Player */}
      {tab === "player" && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-slate-400 text-sm">שחקן:</label>
            <select
              className="h-9 rounded-md bg-slate-800 border border-slate-600 text-slate-200 text-sm px-2 min-w-[160px]"
              value={playerUserId}
              onChange={(e) => setPlayerUserId(e.target.value === "" ? "" : Number(e.target.value))}
            >
              <option value="">בחר שחקן</option>
              {(playersList?.players ?? []).map((p: { userId: number; username?: string | null }) => (
                <option key={p.userId} value={p.userId}>{p.username ?? `#${p.userId}`}</option>
              ))}
            </select>
          </div>
          {playerUserId === "" ? (
            <p className="text-slate-400 py-4">בחר שחקן</p>
          ) : playerLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>
          ) : playerReport ? (
            <>
              <div className="grid grid-cols-1 gap-3 max-w-md">
                <Card className="bg-slate-800/60 border-slate-700">
                  <CardContent className="p-4">
                    <p className="text-slate-400 text-xs mb-1">תוצאה סופית (תחרויות שהוסדרו בלבד)</p>
                    <p className={`text-xl font-bold tabular-nums ${playerReport.summary.finalResult >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {signed(playerReport.summary.finalResult)}
                    </p>
                  </CardContent>
                </Card>
              </div>
              <div className="flex justify-end">
                <Button size="sm" variant="outline" className="border-slate-600 text-slate-300" onClick={downloadPlayerCsv}>
                  <Download className="w-4 h-4 ml-1" />
                  ייצוא CSV
                </Button>
              </div>
              <Card className="bg-slate-800/60 border-slate-700 overflow-hidden">
                <div className="overflow-x-auto max-h-[60vh]">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-slate-700 bg-slate-800/95">
                        <TableHead className="text-slate-300 text-right font-semibold">תחרות</TableHead>
                        <TableHead className="text-slate-300 text-right font-semibold">השתתפות</TableHead>
                        <TableHead className="text-slate-300 text-right font-semibold">זכיות</TableHead>
                        <TableHead className="text-slate-300 text-right font-semibold">עמלה</TableHead>
                        <TableHead className="text-slate-300 text-right font-semibold">תוצאה</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {playerReport.rows.map((r, i) => (
                        <TableRow key={i} className="border-slate-700">
                          <TableCell className="text-slate-200 text-right">{r.competition}</TableCell>
                          <TableCell className="text-slate-300 text-right tabular-nums">{formatNum(r.entry)}</TableCell>
                          <TableCell className="text-slate-300 text-right tabular-nums">{formatNum(r.winnings)}</TableCell>
                          <TableCell className="text-slate-300 text-right tabular-nums">{formatNum(r.commission)}</TableCell>
                          <TableCell className={`text-right tabular-nums font-medium ${r.result >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                            {signed(r.result)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </Card>
            </>
          ) : (
            <p className="text-slate-400 py-4">שחקן לא נמצא או אין נתונים</p>
          )}
        </>
      )}

      {/* Freeroll */}
      {tab === "freeroll" && (
        <>
          {freerollLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>
          ) : freerollReport ? (
            <>
              <div className="grid grid-cols-1 gap-3 max-w-md">
                <Card className="bg-slate-800/60 border-slate-700">
                  <CardContent className="p-4">
                    <p className="text-slate-400 text-xs mb-1">דוח הוצאות פרירול — סה״כ הוצאה אתר</p>
                    <p className="text-xl font-bold tabular-nums text-amber-400">{formatNum(freerollReport.summary.totalSiteExpense)}</p>
                  </CardContent>
                </Card>
              </div>
              <div className="flex justify-end">
                <Button size="sm" variant="outline" className="border-slate-600 text-slate-300" onClick={downloadFreerollCsv}>
                  <Download className="w-4 h-4 ml-1" />
                  ייצוא CSV
                </Button>
              </div>
              <Card className="bg-slate-800/60 border-slate-700 overflow-hidden">
                <div className="overflow-x-auto max-h-[60vh]">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-slate-700 bg-slate-800/95">
                        <TableHead className="text-slate-300 text-right font-semibold">תחרות</TableHead>
                        <TableHead className="text-slate-300 text-right font-semibold">פרסים ששולמו</TableHead>
                        <TableHead className="text-slate-300 text-right font-semibold">הוצאה אתר</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {freerollReport.rows.map((r) => (
                        <TableRow key={r.tournamentId} className="border-slate-700">
                          <TableCell className="text-slate-200 text-right">{r.competition}</TableCell>
                          <TableCell className="text-slate-300 text-right tabular-nums">{formatNum(r.prizePaid)}</TableCell>
                          <TableCell className="text-slate-300 text-right tabular-nums">{formatNum(r.siteExpense)}</TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="border-slate-700 bg-slate-800/80 font-medium">
                        <TableCell className="text-slate-200 text-right">סה״כ הוצאה פרירול</TableCell>
                        <TableCell className="text-slate-300 text-right tabular-nums">—</TableCell>
                        <TableCell className="text-amber-400 text-right tabular-nums">{formatNum(freerollReport.summary.totalSiteExpense)}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </Card>
            </>
          ) : (
            <p className="text-slate-400 py-4">טוען...</p>
          )}
        </>
      )}
    </div>
  );
}
