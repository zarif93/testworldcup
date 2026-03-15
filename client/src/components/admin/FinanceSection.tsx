/**
 * Admin finance dashboard – commission, agent, player, tournament reporting.
 * RTL/Hebrew, canonical finance services, premium admin UX.
 */

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import {
  Loader2,
  ArrowLeft,
  DollarSign,
  Search,
  ChevronDown,
  ChevronUp,
  FileText,
  Calendar,
  Download,
} from "lucide-react";
import {
  buildTournamentsWorkbook,
  buildAgentsWorkbook,
  buildPlayersWorkbook,
  downloadBlob,
  downloadBase64Xlsx,
} from "@/lib/financeXlsx";

type FinanceTab = "summary" | "tournaments" | "agents" | "players" | "global";

const PERIOD_OPTIONS: { value: "day" | "week" | "month"; label: string }[] = [
  { value: "day", label: "היום" },
  { value: "week", label: "שבוע" },
  { value: "month", label: "חודש" },
];

const EVENT_TYPE_LABELS: Record<string, string> = {
  ENTRY_FEE: "דמי השתתפות",
  PRIZE_PAYOUT: "תשלום פרס",
  PLATFORM_COMMISSION: "עמלת פלטפורמה",
  AGENT_COMMISSION: "עמלת סוכן",
  REFUND: "החזר",
  ADJUSTMENT: "התאמה",
};

/** Human-readable Hebrew descriptions for ledger (eventType + context when available). */
const LEDGER_DESCRIPTION_HE: Record<string, string> = {
  ENTRY_FEE: "שחקן נכנס לתחרות",
  PRIZE_PAYOUT: "שולם פרס",
  PLATFORM_COMMISSION: "עמלת פלטפורמה",
  AGENT_COMMISSION: "שולמה עמלת סוכן",
  REFUND: "בוצע החזר",
  ADJUSTMENT: "התאמה",
};

type LedgerEventLike = { eventType: string; userId?: number | null; agentId?: number | null };

function getLedgerDescription(eventType: string, event?: LedgerEventLike | null): string {
  const base = LEDGER_DESCRIPTION_HE[eventType] ?? EVENT_TYPE_LABELS[eventType] ?? eventType;
  if (!event) return base;
  switch (eventType) {
    case "PRIZE_PAYOUT":
      return event.userId != null ? `שולם פרס לשחקן` : base;
    case "REFUND":
      return event.userId != null ? `בוצע החזר לשחקן` : base;
    case "AGENT_COMMISSION":
      return event.agentId != null ? `שולמה עמלת סוכן` : base;
    case "ENTRY_FEE":
      return event.userId != null ? `שחקן נכנס לתחרות` : base;
    default:
      return base;
  }
}

/** Build CSV with UTF-8 BOM for Hebrew Excel. */
function buildCsv(headers: string[], rows: string[][]): string {
  const escape = (v: string) => {
    const s = String(v ?? "");
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const headerLine = headers.map(escape).join(",");
  const dataLines = rows.map((row) => row.map(escape).join(","));
  return "\uFEFF" + headerLine + "\r\n" + dataLines.join("\r\n");
}

function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Status badge styles: distinct, semantic. */
const STATUS_BADGE: Record<string, string> = {
  OPEN: "bg-emerald-500/20 text-emerald-400 border-emerald-500/50",
  LOCKED: "bg-blue-500/20 text-blue-400 border-blue-500/50",
  RESULTS_UPDATED: "bg-sky-500/20 text-sky-400 border-sky-500/50",
  SETTLING: "bg-amber-500/20 text-amber-400 border-amber-500/50",
  PRIZES_DISTRIBUTED: "bg-slate-500/20 text-slate-300 border-slate-500/50",
  ARCHIVED: "bg-slate-600/20 text-slate-400 border-slate-600/50",
};

function formatNum(n: number): string {
  return Number.isFinite(n) ? n.toLocaleString("he-IL") : "0";
}

function formatPct(bps: number): string {
  return bps != null ? `${(bps / 100).toFixed(2)}%` : "—";
}

/** Real thresholds for risk/activity indicators. */
const REFUND_EXCEPTIONAL_PCT = 0.2;
const REFUND_EXCEPTIONAL_ABS = 500;
const HIGH_ACTIVITY_PARTICIPANTS = 25;
const HIGH_ACTIVITY_PLAYERS = 15;

type Props = { onBack: () => void };

export function FinanceSection({ onBack }: Props) {
  const utils = trpc.useUtils();
  const [period, setPeriod] = useState<"day" | "week" | "month">("month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [tab, setTab] = useState<FinanceTab>("summary");
  const [tournamentDetailId, setTournamentDetailId] = useState<number | null>(null);
  const [agentDetailId, setAgentDetailId] = useState<number | null>(null);
  const [playerSearch, setPlayerSearch] = useState("");
  const [playerAgentId, setPlayerAgentId] = useState<number | "" | null>(null);
  const [playerFrom, setPlayerFrom] = useState("");
  const [playerTo, setPlayerTo] = useState("");
  const [tournamentSort, setTournamentSort] = useState<{ key: string; dir: "asc" | "desc" }>({ key: "tournamentId", dir: "desc" });
  const [agentSort, setAgentSort] = useState<{ key: string; dir: "asc" | "desc" }>({ key: "totalPlayerEntryFees", dir: "desc" });
  const [tournamentFilterStatus, setTournamentFilterStatus] = useState("");
  type QuickFilter = "" | "profitable" | "losing" | "exceptional_refunds" | "high_activity";
  const [tournamentQuickFilter, setTournamentQuickFilter] = useState<QuickFilter>("");
  const [agentQuickFilter, setAgentQuickFilter] = useState<QuickFilter>("");
  const [playerQuickFilter, setPlayerQuickFilter] = useState<QuickFilter>("");
  const [agentReportDetailFrom, setAgentReportDetailFrom] = useState("");
  const [agentReportDetailTo, setAgentReportDetailTo] = useState("");
  const [agentReportExporting, setAgentReportExporting] = useState(false);
  const [playerReportDetailId, setPlayerReportDetailId] = useState<number | null>(null);
  const [playerReportDetailFrom, setPlayerReportDetailFrom] = useState("");
  const [playerReportDetailTo, setPlayerReportDetailTo] = useState("");
  const [playerReportExporting, setPlayerReportExporting] = useState(false);
  const [globalReportFrom, setGlobalReportFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [globalReportTo, setGlobalReportTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [globalReportExporting, setGlobalReportExporting] = useState(false);

  const useCustomRange = customFrom && customTo;
  const summaryInput = useCustomRange
    ? { from: customFrom, to: customTo }
    : { period };

  const { data: summary, isLoading: summaryLoading } = trpc.admin.getFinanceDashboardSummary.useQuery(summaryInput, {
    refetchOnWindowFocus: false,
  });
  const { data: tournamentList, isLoading: tournamentsLoading } = trpc.admin.getTournamentFinanceList.useQuery(undefined, {
    enabled: tab === "tournaments" || tab === "summary",
  });
  const { data: agentList, isLoading: agentsLoading } = trpc.admin.getAgentFinanceList.useQuery(undefined, {
    enabled: tab === "agents" || tab === "summary",
  });
  const { data: playerData, isLoading: playersLoading } = trpc.admin.getPlayerFinanceList.useQuery(
    {
      search: playerSearch.trim() || undefined,
      agentId: playerAgentId != null && playerAgentId !== "" ? playerAgentId : undefined,
      from: playerFrom || undefined,
      to: playerTo || undefined,
      limit: 500,
    },
    { enabled: tab === "players" || tab === "summary" }
  );
  const { data: tournamentDetail, isLoading: detailLoading } = trpc.admin.getTournamentFinanceDetail.useQuery(
    { tournamentId: tournamentDetailId! },
    { enabled: tournamentDetailId != null }
  );
  const { data: agentDetail } = trpc.admin.getAgentFinanceDetail.useQuery(
    { agentId: agentDetailId! },
    { enabled: agentDetailId != null }
  );
  const { data: playerReportDetail, isLoading: playerReportDetailLoading } = trpc.admin.getPlayerReportDetailed.useQuery(
    { userId: playerReportDetailId!, from: playerReportDetailFrom || undefined, to: playerReportDetailTo || undefined },
    { enabled: playerReportDetailId != null }
  );
  const { data: globalReport, isLoading: globalReportLoading } = trpc.admin.getGlobalFinanceReport.useQuery(
    { from: globalReportFrom || undefined, to: globalReportTo || undefined },
    { enabled: tab === "global" }
  );
  const { data: agentsForFilter } = trpc.admin.getAgentsWithBalances.useQuery(undefined, { enabled: tab === "players" });

  const players = playerData?.players ?? [];
  const sortedTournaments = useMemo(() => {
    const list = tournamentList ?? [];
    let filtered = tournamentFilterStatus ? list.filter((t) => t.status === tournamentFilterStatus) : list;
    if (tournamentQuickFilter === "profitable") filtered = filtered.filter((t) => t.platformNetProfit > 0);
    else if (tournamentQuickFilter === "losing") filtered = filtered.filter((t) => t.platformNetProfit < 0);
    else if (tournamentQuickFilter === "exceptional_refunds") {
      filtered = filtered.filter((t) => {
        const r = t.totalRefunded ?? 0;
        const pool = t.totalPool ?? 1;
        return r >= REFUND_EXCEPTIONAL_ABS || (pool > 0 && r / pool >= REFUND_EXCEPTIONAL_PCT);
      });
    } else if (tournamentQuickFilter === "high_activity") filtered = filtered.filter((t) => (t.participantCount ?? 0) >= HIGH_ACTIVITY_PARTICIPANTS);
    return [...filtered].sort((a, b) => {
      const aVal = a[tournamentSort.key as keyof typeof a];
      const bVal = b[tournamentSort.key as keyof typeof b];
      const cmp = typeof aVal === "number" && typeof bVal === "number" ? aVal - bVal : String(aVal ?? "").localeCompare(String(bVal ?? ""));
      return tournamentSort.dir === "asc" ? cmp : -cmp;
    });
  }, [tournamentList, tournamentSort, tournamentFilterStatus, tournamentQuickFilter]);

  const sortedAgents = useMemo(() => {
    let list = agentList ?? [];
    if (agentQuickFilter === "profitable") list = list.filter((a) => a.platformNetProfitFromAgent > 0);
    else if (agentQuickFilter === "losing") list = list.filter((a) => a.platformNetProfitFromAgent < 0);
    else if (agentQuickFilter === "high_activity") list = list.filter((a) => (a.numberOfPlayers ?? 0) >= HIGH_ACTIVITY_PLAYERS);
    return [...list].sort((a, b) => {
      const aVal = a[agentSort.key as keyof typeof a];
      const bVal = b[agentSort.key as keyof typeof b];
      const cmp = typeof aVal === "number" && typeof bVal === "number" ? aVal - bVal : String(aVal ?? "").localeCompare(String(bVal ?? ""));
      return agentSort.dir === "asc" ? cmp : -cmp;
    });
  }, [agentList, agentSort, agentQuickFilter]);

  const filteredPlayers = useMemo(() => {
    let list = players;
    if (playerQuickFilter === "profitable") list = list.filter((p) => p.competitionNetPnL > 0);
    else if (playerQuickFilter === "losing") list = list.filter((p) => p.competitionNetPnL < 0);
    else if (playerQuickFilter === "exceptional_refunds") list = list.filter((p) => (p.totalEntryFeeRefunds ?? 0) >= REFUND_EXCEPTIONAL_ABS);
    else if (playerQuickFilter === "high_activity") list = list.filter((p) => (p.totalEntryFees - (p.totalEntryFeeRefunds ?? 0)) >= HIGH_ACTIVITY_PARTICIPANTS);
    return list;
  }, [players, playerQuickFilter]);

  const toggleSort = (key: string, current: { key: string; dir: "asc" | "desc" }, set: (v: { key: string; dir: "asc" | "desc" }) => void) => {
    if (current.key === key) set({ key, dir: current.dir === "asc" ? "desc" : "asc" });
    else set({ key, dir: "desc" });
  };

  const exportTournamentsXlsx = async () => {
    const blob = await buildTournamentsWorkbook(sortedTournaments);
    downloadBlob(blob, "tournaments-finance.xlsx");
  };
  const exportTournamentsCsv = () => {
    const headers = ["תחרות", "משתתפים", "סה״כ ברוטו", "עמלה %", "עמלת פלטפורמה", "עמלת סוכנים", "קופת פרסים", "פרסים שולמו", "החזרים", "רווח נטו", "סטטוס"];
    const rows = sortedTournaments.map((t) => [
      t.tournamentName ?? "",
      String(t.participantCount ?? ""),
      String(t.totalPool ?? ""),
      formatPct(t.commissionBasisPoints ?? 0),
      String(t.platformCommission ?? ""),
      String(t.agentCommissionTotal ?? ""),
      String(t.prizePool ?? ""),
      String(t.totalPrizesDistributed ?? ""),
      String(t.totalRefunded ?? ""),
      String(t.platformNetProfit ?? ""),
      t.status ?? "",
    ]);
    downloadCsv("tournaments-finance.csv", buildCsv(headers, rows));
  };
  const exportAgentsXlsx = async () => {
    const blob = await buildAgentsWorkbook(sortedAgents);
    downloadBlob(blob, "agents-finance.xlsx");
  };
  const exportAgentsCsv = () => {
    const headers = ["סוכן", "שחקנים", "סה״כ השתתפויות", "עמלות שנוצרו", "עמלה לסוכן", "רווח פלטפורמה", "סה״כ פרסים"];
    const rows = sortedAgents.map((a) => [
      a.agentName ?? a.agentUsername ?? `#${a.agentId}`,
      String(a.numberOfPlayers ?? ""),
      String(a.totalPlayerEntryFees ?? ""),
      String(a.totalCommissionGenerated ?? ""),
      String(a.agentTotalCommissionEarned ?? ""),
      String(a.platformNetProfitFromAgent ?? ""),
      String(a.totalPlayerPrizes ?? ""),
    ]);
    downloadCsv("agents-finance.csv", buildCsv(headers, rows));
  };
  const exportPlayersXlsx = async () => {
    const blob = await buildPlayersWorkbook(filteredPlayers);
    downloadBlob(blob, "players-finance.xlsx");
  };
  const exportPlayersCsv = () => {
    const headers = ["שם משתמש", "סוכן", "השתתפויות", "פרסים", "החזרים", "רווח/הפסד תחרות", "תזרים ארנק", "עמלות שנוצרו", "רווח פלטפורמה"];
    const rows = filteredPlayers.map((p) => [
      p.username ?? `#${p.userId}`,
      p.assignedAgentId != null ? `#${p.assignedAgentId}` : "—",
      String(p.totalEntryFees - (p.totalEntryFeeRefunds ?? 0)),
      String(p.totalPrizesWon ?? ""),
      String(p.totalEntryFeeRefunds ?? 0),
      String(p.competitionNetPnL ?? ""),
      String(p.walletNetFlow ?? ""),
      String(p.totalCommissionGenerated ?? ""),
      String(p.platformProfitFromPlayer ?? ""),
    ]);
    downloadCsv("players-finance.csv", buildCsv(headers, rows));
  };

  const exportAgentReportDetailedXlsx = async () => {
    if (agentDetailId == null) return;
    setAgentReportExporting(true);
    try {
      const { base64, filename } = await utils.admin.exportAgentReportDetailedXLSX.fetch({
        agentId: agentDetailId,
        from: agentReportDetailFrom || undefined,
        to: agentReportDetailTo || undefined,
      });
      downloadBase64Xlsx(base64, filename);
    } finally {
      setAgentReportExporting(false);
    }
  };
  const exportAgentReportDetailedCsv = async () => {
    if (agentDetailId == null) return;
    setAgentReportExporting(true);
    try {
      const { csv } = await utils.admin.exportAgentReportDetailedCSV.fetch({
        agentId: agentDetailId,
        from: agentReportDetailFrom || undefined,
        to: agentReportDetailTo || undefined,
      });
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `דוח_סוכן_${agentDetailId}_${agentReportDetailFrom || "מ-תחילה"}_${agentReportDetailTo || "עד-עכשיו"}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setAgentReportExporting(false);
    }
  };

  const exportAllFinanceXlsx = async () => {
    await exportTournamentsXlsx();
    await exportAgentsXlsx();
    if (filteredPlayers.length > 0) await exportPlayersXlsx();
  };
  const exportAllFinanceCsv = () => {
    exportTournamentsCsv();
    exportAgentsCsv();
    if (filteredPlayers.length > 0) exportPlayersCsv();
  };

  const exportPlayerReportDetailedXlsx = async () => {
    if (playerReportDetailId == null) return;
    setPlayerReportExporting(true);
    try {
      const { base64, filename } = await utils.admin.exportPlayerReportDetailedXLSX.fetch({
        userId: playerReportDetailId,
        from: playerReportDetailFrom || undefined,
        to: playerReportDetailTo || undefined,
      });
      downloadBase64Xlsx(base64, filename);
    } finally {
      setPlayerReportExporting(false);
    }
  };
  const exportPlayerReportDetailedCsv = async () => {
    if (playerReportDetailId == null) return;
    setPlayerReportExporting(true);
    try {
      const { csv } = await utils.admin.exportPlayerReportDetailedCSV.fetch({
        userId: playerReportDetailId,
        from: playerReportDetailFrom || undefined,
        to: playerReportDetailTo || undefined,
      });
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `דוח_שחקן_${playerReportDetailId}_${playerReportDetailFrom || "מ-תחילה"}_${playerReportDetailTo || "עד-עכשיו"}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setPlayerReportExporting(false);
    }
  };

  const exportGlobalReportXlsx = async () => {
    setGlobalReportExporting(true);
    try {
      const { base64, filename } = await utils.admin.exportGlobalFinanceReportXLSX.fetch({
        from: globalReportFrom || undefined,
        to: globalReportTo || undefined,
      });
      downloadBase64Xlsx(base64, filename);
    } finally {
      setGlobalReportExporting(false);
    }
  };
  const exportGlobalReportCsv = async () => {
    setGlobalReportExporting(true);
    try {
      const { csv } = await utils.admin.exportGlobalFinanceReportCSV.fetch({
        from: globalReportFrom || undefined,
        to: globalReportTo || undefined,
      });
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `דוח_כספי_גלובלי_${globalReportFrom || "מ-תחילה"}_${globalReportTo || "עד-עכשיו"}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setGlobalReportExporting(false);
    }
  };

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center gap-2 flex-wrap">
        <Button variant="ghost" size="sm" className="text-slate-400 -mr-2 md:mr-0" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-1" />
          חזרה
        </Button>
      </div>
      <h2 className="text-xl md:text-2xl font-bold text-white flex items-center gap-2">
        <DollarSign className="w-6 h-6 md:w-8 md:h-8 text-amber-400 shrink-0" />
        כספים ועמלות
      </h2>

      {/* Period filter */}
      <Card className="bg-slate-800/60 border-slate-700/80 rounded-xl">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-slate-400 text-sm font-medium">תקופה:</span>
            {PERIOD_OPTIONS.map((p) => (
              <Button
                key={p.value}
                variant={period === p.value && !useCustomRange ? "default" : "outline"}
                size="sm"
                className="border-slate-600 text-slate-300"
                onClick={() => setPeriod(p.value)}
              >
                {p.label}
              </Button>
            ))}
            <span className="text-slate-500 mx-1">|</span>
            <Calendar className="w-4 h-4 text-slate-500" />
            <Input
              type="date"
              className="w-36 h-9 bg-slate-900 border-slate-600 text-slate-200"
              placeholder="מ-"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
            />
            <span className="text-slate-500">–</span>
            <Input
              type="date"
              className="w-36 h-9 bg-slate-900 border-slate-600 text-slate-200"
              placeholder="עד"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Top insights strip – real data only */}
      {!summaryLoading && summary && (summary.mostProfitableTournament ?? summary.mostProfitableAgent ?? summary.topLosingPlayer ?? summary.topProfitablePlayer) && (
        <Card className="bg-slate-800/50 border-slate-700/80 rounded-xl">
          <CardContent className="p-3">
            <p className="text-slate-400 text-xs font-medium mb-2">תובנות מרכזיות (תקופה)</p>
            <div className="flex flex-wrap gap-3">
              {summary.mostProfitableTournament && (
                <div className="flex items-center gap-1.5 text-sm">
                  <span className="text-slate-500">תחרות רווחית:</span>
                  <span className="text-emerald-400 font-medium tabular-nums">{summary.mostProfitableTournament.name}</span>
                  <span className="text-emerald-500/80 tabular-nums">+{formatNum(summary.mostProfitableTournament.value)}</span>
                </div>
              )}
              {summary.mostProfitableAgent && (
                <div className="flex items-center gap-1.5 text-sm">
                  <span className="text-slate-500">סוכן מוביל (רווח פלטפורמה):</span>
                  <span className="text-blue-400 font-medium">{summary.mostProfitableAgent.name}</span>
                  <span className="text-emerald-500/80 tabular-nums">+{formatNum(summary.mostProfitableAgent.value)}</span>
                </div>
              )}
              {summary.topProfitablePlayer && (
                <div className="flex items-center gap-1.5 text-sm">
                  <span className="text-slate-500">שחקן רווחי:</span>
                  <span className="text-emerald-400 font-medium">{summary.topProfitablePlayer.name}</span>
                  <span className="text-emerald-500/80 tabular-nums">+{formatNum(summary.topProfitablePlayer.value)}</span>
                </div>
              )}
              {summary.topLosingPlayer && (
                <div className="flex items-center gap-1.5 text-sm">
                  <span className="text-slate-500">שחקן בהפסד:</span>
                  <span className="text-red-400/90 font-medium">{summary.topLosingPlayer.name}</span>
                  <span className="text-red-500/80 tabular-nums">{formatNum(summary.topLosingPlayer.value)}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary cards – visual finance semantics */}
      {summaryLoading && (
        <div className="flex items-center justify-center py-12 text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      )}
      {!summaryLoading && summary && (
        <section className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
          <Card className="bg-slate-800/60 border-slate-700/80 rounded-xl">
            <CardContent className="p-3 md:p-4">
              <p className="text-slate-400 text-xs">רווח פלטפורמה (תקופה)</p>
              <p className={`text-lg font-bold tabular-nums mt-0.5 ${summary.totalPlatformProfit >= 0 ? "text-emerald-400" : "text-red-400"}`}>{formatNum(summary.totalPlatformProfit)}</p>
            </CardContent>
          </Card>
          <Card className="bg-slate-800/60 border-slate-700/80 rounded-xl">
            <CardContent className="p-3 md:p-4">
              <p className="text-slate-400 text-xs">עמלות (פלטפורמה)</p>
              <p className="text-lg font-bold text-slate-200 tabular-nums mt-0.5">{formatNum(summary.totalCommissions)}</p>
            </CardContent>
          </Card>
          <Card className="bg-slate-800/60 border-slate-700/80 rounded-xl">
            <CardContent className="p-3 md:p-4">
              <p className="text-slate-400 text-xs">עמלות סוכנים</p>
              <p className="text-lg font-bold text-amber-400 tabular-nums mt-0.5">{formatNum(summary.totalAgentCommissions)}</p>
            </CardContent>
          </Card>
          <Card className="bg-slate-800/60 border-slate-700/80 rounded-xl">
            <CardContent className="p-3 md:p-4">
              <p className="text-slate-400 text-xs">פרסים ששולמו</p>
              <p className="text-lg font-bold text-red-400/90 tabular-nums mt-0.5">{formatNum(summary.totalPrizePayouts)}</p>
            </CardContent>
          </Card>
          <Card className="bg-slate-800/60 border-slate-700/80 rounded-xl">
            <CardContent className="p-3 md:p-4">
              <p className="text-slate-400 text-xs">החזרים</p>
              <p className="text-lg font-bold text-amber-500/90 tabular-nums mt-0.5">{formatNum(summary.totalRefundedPoints)}</p>
            </CardContent>
          </Card>
          <Card className="bg-slate-800/60 border-slate-700/80 rounded-xl">
            <CardContent className="p-3 md:p-4">
              <p className="text-slate-400 text-xs">תחרויות פעילות</p>
              <p className="text-lg font-bold text-slate-200 tabular-nums mt-0.5">{summary.activeTournamentsCount}</p>
            </CardContent>
          </Card>
          <Card className="bg-slate-800/60 border-slate-700/80 rounded-xl">
            <CardContent className="p-3 md:p-4">
              <p className="text-slate-400 text-xs">שחקנים</p>
              <p className="text-lg font-bold text-slate-200 tabular-nums mt-0.5">{summary.totalPlayersCount}</p>
            </CardContent>
          </Card>
          <Card className="bg-slate-800/60 border-slate-700/80 rounded-xl">
            <CardContent className="p-3 md:p-4">
              <p className="text-slate-400 text-xs">סוכנים</p>
              <p className="text-lg font-bold text-slate-200 tabular-nums mt-0.5">{summary.totalAgentsCount}</p>
            </CardContent>
          </Card>
        </section>
      )}

      <Tabs value={tab} onValueChange={(v) => setTab(v as FinanceTab)} className="w-full">
        <TabsList className="bg-slate-800 border border-slate-700">
          <TabsTrigger value="summary" className="data-[state=active]:bg-amber-600 data-[state=active]:text-white">סיכום</TabsTrigger>
          <TabsTrigger value="tournaments" className="data-[state=active]:bg-amber-600 data-[state=active]:text-white">תחרויות</TabsTrigger>
          <TabsTrigger value="agents" className="data-[state=active]:bg-amber-600 data-[state=active]:text-white">סוכנים</TabsTrigger>
          <TabsTrigger value="players" className="data-[state=active]:bg-amber-600 data-[state=active]:text-white">שחקנים</TabsTrigger>
          <TabsTrigger value="global" className="data-[state=active]:bg-amber-600 data-[state=active]:text-white">דוח גלובלי</TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="mt-4">
          <p className="text-slate-400 text-sm mb-4">סיכום התקופה מוצג בכרטיסים למעלה. עבור לטבלאות מפורטות בלשוניות תחרויות / סוכנים / שחקנים.</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="default" size="sm" className="bg-amber-600 hover:bg-amber-700 text-white" onClick={exportAllFinanceXlsx}>
              <Download className="w-4 h-4 ml-1" />
              ייצוא Excel (כל הדוחות)
            </Button>
            <Button variant="outline" size="sm" className="border-slate-600 text-slate-300" onClick={exportAllFinanceCsv}>
              <Download className="w-4 h-4 ml-1" />
              ייצוא CSV
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="tournaments" className="mt-4">
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <select
              className="h-9 rounded-md bg-slate-800 border border-slate-600 text-slate-200 text-sm px-2"
              value={tournamentFilterStatus}
              onChange={(e) => setTournamentFilterStatus(e.target.value)}
            >
              <option value="">כל הסטטוסים</option>
              <option value="OPEN">OPEN</option>
              <option value="LOCKED">LOCKED</option>
              <option value="RESULTS_UPDATED">RESULTS_UPDATED</option>
              <option value="SETTLING">SETTLING</option>
              <option value="PRIZES_DISTRIBUTED">PRIZES_DISTRIBUTED</option>
              <option value="ARCHIVED">ARCHIVED</option>
            </select>
            <span className="text-slate-500 mx-1">|</span>
            <div className="flex flex-wrap gap-1">
              {(["profitable", "losing", "exceptional_refunds", "high_activity"] as const).map((q) => (
                <Button
                  key={q}
                  variant={tournamentQuickFilter === q ? "default" : "outline"}
                  size="sm"
                  className="border-slate-600 text-slate-300 text-xs h-8"
                  onClick={() => setTournamentQuickFilter(tournamentQuickFilter === q ? "" : q)}
                >
                  {q === "profitable" ? "רק רווחיים" : q === "losing" ? "רק בהפסד" : q === "exceptional_refunds" ? "החזרים חריגים" : "פעילות גבוהה"}
                </Button>
              ))}
            </div>
            <Button variant="default" size="sm" className="bg-amber-600 hover:bg-amber-700 text-white mr-auto" onClick={exportTournamentsXlsx}>
              <Download className="w-4 h-4 ml-1" />
              ייצוא Excel
            </Button>
            <Button variant="outline" size="sm" className="border-slate-600 text-slate-300" onClick={exportTournamentsCsv}>
              ייצוא CSV
            </Button>
          </div>
          {tournamentsLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>
          ) : sortedTournaments.length === 0 ? (
            <Card className="bg-slate-800/60 border-slate-700/80 rounded-xl">
              <CardContent className="py-12 text-center">
                <p className="text-slate-400 text-lg">{tournamentList?.length === 0 ? "אין פעילות כספית בתקופה זו" : "לא נמצאו תחרויות לתצוגה"}</p>
              </CardContent>
            </Card>
          ) : (
            <Card className="bg-slate-800/60 border-slate-700/80 overflow-hidden">
              <div className="overflow-x-auto overflow-y-auto max-h-[60vh]">
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-700 bg-slate-800/95 sticky top-0 z-10 shadow-sm">
                      <TableHead className="text-slate-300 text-right font-semibold" onClick={() => toggleSort("tournamentName", tournamentSort, setTournamentSort)}>
                        תחרות {tournamentSort.key === "tournamentName" && (tournamentSort.dir === "asc" ? <ChevronUp className="inline w-4" /> : <ChevronDown className="inline w-4" />)}
                      </TableHead>
                      <TableHead className="text-slate-300 text-right font-semibold w-20">משתתפים</TableHead>
                      <TableHead className="text-slate-300 text-right font-semibold min-w-[90px]" onClick={() => toggleSort("totalPool", tournamentSort, setTournamentSort)}>
                        סה״כ ברוטו {tournamentSort.key === "totalPool" && (tournamentSort.dir === "asc" ? <ChevronUp className="inline w-4" /> : <ChevronDown className="inline w-4" />)}
                      </TableHead>
                      <TableHead className="text-slate-300 text-right font-semibold w-20">עמלה %</TableHead>
                      <TableHead className="text-slate-300 text-right font-semibold min-w-[90px]">עמלת פלטפורמה</TableHead>
                      <TableHead className="text-slate-300 text-right font-semibold min-w-[90px]">עמלת סוכנים</TableHead>
                      <TableHead className="text-slate-300 text-right font-semibold min-w-[80px]">קופת פרסים</TableHead>
                      <TableHead className="text-slate-300 text-right font-semibold min-w-[90px]">פרסים שולמו</TableHead>
                      <TableHead className="text-slate-300 text-right font-semibold min-w-[80px]">החזרים</TableHead>
                      <TableHead className="text-slate-300 text-right font-semibold min-w-[90px]">רווח נטו</TableHead>
                      <TableHead className="text-slate-300 text-right font-semibold">סטטוס</TableHead>
                      <TableHead className="text-slate-300 text-right w-24 font-semibold">יומן</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedTournaments.map((t) => {
                      const refunds = t.totalRefunded ?? 0;
                      const pool = t.totalPool ?? 1;
                      const refundExceptional = refunds >= REFUND_EXCEPTIONAL_ABS || (pool > 0 && refunds / pool >= REFUND_EXCEPTIONAL_PCT);
                      const highActivity = (t.participantCount ?? 0) >= HIGH_ACTIVITY_PARTICIPANTS;
                      return (
                        <TableRow key={t.tournamentId} className="border-slate-700 hover:bg-slate-800/80">
                          <TableCell className="text-slate-200 text-right font-medium">{t.tournamentName}</TableCell>
                          <TableCell className="text-slate-300 text-right tabular-nums w-20">{t.participantCount}</TableCell>
                          <TableCell className="text-slate-300 text-right tabular-nums min-w-[90px]">{formatNum(t.totalPool)}</TableCell>
                          <TableCell className="text-slate-300 text-right tabular-nums w-20">{formatPct(t.commissionBasisPoints)}</TableCell>
                          <TableCell className="text-slate-200 text-right tabular-nums min-w-[90px]">{formatNum(t.platformCommission)}</TableCell>
                          <TableCell className="text-amber-400/90 text-right tabular-nums min-w-[90px]">{formatNum(t.agentCommissionTotal)}</TableCell>
                          <TableCell className="text-slate-300 text-right tabular-nums min-w-[80px]">{formatNum(t.prizePool)}</TableCell>
                          <TableCell className="text-red-400/80 text-right tabular-nums min-w-[90px]">{formatNum(t.totalPrizesDistributed)}</TableCell>
                          <TableCell className="text-amber-500/90 text-right tabular-nums min-w-[80px]">{formatNum(refunds)}</TableCell>
                          <TableCell className="text-right tabular-nums min-w-[90px] font-medium">
                            {t.platformNetProfit >= 0 ? <span className="text-emerald-400">+{formatNum(t.platformNetProfit)}</span> : <span className="text-red-400">{formatNum(t.platformNetProfit)}</span>}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex flex-wrap gap-1 justify-end items-center">
                              <Badge variant="outline" className={`text-xs ${STATUS_BADGE[t.status] ?? "border-slate-600 text-slate-300"}`}>{t.status}</Badge>
                              {t.platformNetProfit > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400">רווחי</span>}
                              {t.platformNetProfit < 0 && <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/15 text-red-400">הפסדי</span>}
                              {refundExceptional && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400">החזרים חריגים</span>}
                              {highActivity && <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-400">פעילות גבוהה</span>}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="sm" className="text-amber-400 hover:text-amber-300" onClick={() => setTournamentDetailId(t.tournamentId)}>
                              <FileText className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="agents" className="mt-4">
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <div className="flex flex-wrap gap-1">
              {(["profitable", "losing", "high_activity"] as const).map((q) => (
                <Button
                  key={q}
                  variant={agentQuickFilter === q ? "default" : "outline"}
                  size="sm"
                  className="border-slate-600 text-slate-300 text-xs h-8"
                  onClick={() => setAgentQuickFilter(agentQuickFilter === q ? "" : q)}
                >
                  {q === "profitable" ? "רק רווחיים" : q === "losing" ? "רק בהפסד" : "פעילות גבוהה"}
                </Button>
              ))}
            </div>
            <Button variant="default" size="sm" className="bg-amber-600 hover:bg-amber-700 text-white mr-auto" onClick={exportAgentsXlsx}>
              <Download className="w-4 h-4 ml-1" />
              ייצוא Excel
            </Button>
            <Button variant="outline" size="sm" className="border-slate-600 text-slate-300" onClick={exportAgentsCsv}>
              ייצוא CSV
            </Button>
          </div>
          {agentsLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>
          ) : sortedAgents.length === 0 ? (
            <Card className="bg-slate-800/60 border-slate-700/80 rounded-xl">
              <CardContent className="py-12 text-center">
                <p className="text-slate-400 text-lg">{agentList?.length === 0 ? "אין פעילות כספית בתקופה זו" : "לא נמצאו סוכנים לתצוגה"}</p>
              </CardContent>
            </Card>
          ) : (
            <Card className="bg-slate-800/60 border-slate-700/80 overflow-hidden">
              <div className="overflow-x-auto overflow-y-auto max-h-[60vh]">
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-700 bg-slate-800/95 sticky top-0 z-10 shadow-sm">
                      <TableHead className="text-slate-300 text-right font-semibold">סוכן</TableHead>
                      <TableHead className="text-slate-300 text-right font-semibold w-20" onClick={() => toggleSort("numberOfPlayers", agentSort, setAgentSort)}>שחקנים</TableHead>
                      <TableHead className="text-slate-300 text-right font-semibold min-w-[100px]" onClick={() => toggleSort("totalPlayerEntryFees", agentSort, setAgentSort)}>סה״כ השתתפויות</TableHead>
                      <TableHead className="text-slate-300 text-right font-semibold min-w-[90px]">עמלות שנוצרו</TableHead>
                      <TableHead className="text-slate-300 text-right font-semibold min-w-[90px]">עמלה לסוכן</TableHead>
                      <TableHead className="text-slate-300 text-right font-semibold min-w-[100px]">רווח פלטפורמה</TableHead>
                      <TableHead className="text-slate-300 text-right font-semibold min-w-[90px]">סה״כ פרסים</TableHead>
                      <TableHead className="text-slate-300 text-right w-24 font-semibold">פירוט</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedAgents.map((a) => {
                      const highActivity = (a.numberOfPlayers ?? 0) >= HIGH_ACTIVITY_PLAYERS;
                      return (
                        <TableRow key={a.agentId} className="border-slate-700 hover:bg-slate-800/80">
                          <TableCell className="text-slate-200 text-right font-medium">{a.agentName ?? a.agentUsername ?? `#${a.agentId}`}</TableCell>
                          <TableCell className="text-slate-300 text-right tabular-nums w-20">{a.numberOfPlayers}</TableCell>
                          <TableCell className="text-slate-300 text-right tabular-nums min-w-[100px]">{formatNum(a.totalPlayerEntryFees)}</TableCell>
                          <TableCell className="text-slate-200 text-right tabular-nums min-w-[90px]">{formatNum(a.totalCommissionGenerated ?? 0)}</TableCell>
                          <TableCell className="text-amber-400 text-right tabular-nums min-w-[90px] font-medium">{formatNum(a.agentTotalCommissionEarned)}</TableCell>
                          <TableCell className="text-right tabular-nums min-w-[100px] font-medium">
                            {a.platformNetProfitFromAgent >= 0 ? <span className="text-emerald-400">+{formatNum(a.platformNetProfitFromAgent)}</span> : <span className="text-red-400">{formatNum(a.platformNetProfitFromAgent)}</span>}
                          </TableCell>
                          <TableCell className="text-red-400/80 text-right tabular-nums min-w-[90px]">{formatNum(a.totalPlayerPrizes)}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1 justify-end items-center">
                              {highActivity && <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-400">פעילות גבוהה</span>}
                              {a.platformNetProfitFromAgent > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400">רווחי</span>}
                              {a.platformNetProfitFromAgent < 0 && <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/15 text-red-400">הפסדי</span>}
                              <Button variant="ghost" size="sm" className="text-amber-400 hover:text-amber-300" onClick={() => setAgentDetailId(a.agentId)}>
                                פירוט שחקנים
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="players" className="mt-4">
          <div className="flex flex-wrap gap-2 mb-4">
            <div className="relative flex-1 min-w-[160px]">
              <Search className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <Input
                className="pr-8 bg-slate-800 border-slate-600 text-slate-200"
                placeholder="חיפוש משתמש..."
                value={playerSearch}
                onChange={(e) => setPlayerSearch(e.target.value)}
              />
            </div>
            <select
              className="h-9 rounded-md bg-slate-800 border border-slate-600 text-slate-200 text-sm px-2 min-w-[140px]"
              value={playerAgentId ?? ""}
              onChange={(e) => setPlayerAgentId(e.target.value === "" ? null : Number(e.target.value))}
            >
              <option value="">כל הסוכנים</option>
              {(agentsForFilter ?? []).map((ag: { id: number; username?: string | null }) => (
                <option key={ag.id} value={ag.id}>{ag.username ?? `#${ag.id}`}</option>
              ))}
            </select>
            <Input type="date" className="w-36 h-9 bg-slate-800 border-slate-600 text-slate-200" value={playerFrom} onChange={(e) => setPlayerFrom(e.target.value)} />
            <Input type="date" className="w-36 h-9 bg-slate-800 border-slate-600 text-slate-200" value={playerTo} onChange={(e) => setPlayerTo(e.target.value)} />
            <span className="text-slate-500 mx-1">|</span>
            <div className="flex flex-wrap gap-1">
              {(["profitable", "losing", "exceptional_refunds", "high_activity"] as const).map((q) => (
                <Button
                  key={q}
                  variant={playerQuickFilter === q ? "default" : "outline"}
                  size="sm"
                  className="border-slate-600 text-slate-300 text-xs h-8"
                  onClick={() => setPlayerQuickFilter(playerQuickFilter === q ? "" : q)}
                >
                  {q === "profitable" ? "רק רווחיים" : q === "losing" ? "רק בהפסד" : q === "exceptional_refunds" ? "החזרים חריגים" : "פעילות גבוהה"}
                </Button>
              ))}
            </div>
            <Button variant="default" size="sm" className="bg-amber-600 hover:bg-amber-700 text-white mr-auto" onClick={exportPlayersXlsx}>
              <Download className="w-4 h-4 ml-1" />
              ייצוא Excel
            </Button>
            <Button variant="outline" size="sm" className="border-slate-600 text-slate-300" onClick={exportPlayersCsv}>
              ייצוא CSV
            </Button>
          </div>
          {playersLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>
          ) : filteredPlayers.length === 0 ? (
            <Card className="bg-slate-800/60 border-slate-700/80 rounded-xl">
              <CardContent className="py-12 text-center">
                <p className="text-slate-400 text-lg">{players.length === 0 ? "אין פעילות כספית בתקופה זו" : "לא נמצאו שחקנים לתצוגה"}</p>
              </CardContent>
            </Card>
          ) : (
            <Card className="bg-slate-800/60 border-slate-700/80 overflow-hidden">
              <div className="overflow-x-auto overflow-y-auto max-h-[60vh]">
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-700 bg-slate-800/95 sticky top-0 z-10 shadow-sm">
                      <TableHead className="text-slate-300 text-right font-semibold">שם משתמש</TableHead>
                      <TableHead className="text-slate-300 text-right font-semibold w-20">סוכן</TableHead>
                      <TableHead className="text-slate-300 text-right font-semibold min-w-[90px]">השתתפויות</TableHead>
                      <TableHead className="text-slate-300 text-right font-semibold min-w-[80px]">פרסים</TableHead>
                      <TableHead className="text-slate-300 text-right font-semibold min-w-[80px]">החזרים</TableHead>
                      <TableHead className="text-slate-300 text-right font-semibold min-w-[100px]">רווח/הפסד תחרות</TableHead>
                      <TableHead className="text-slate-300 text-right font-semibold min-w-[90px]">תזרים ארנק</TableHead>
                      <TableHead className="text-slate-300 text-right font-semibold min-w-[90px]">עמלות שנוצרו</TableHead>
                      <TableHead className="text-slate-300 text-right font-semibold min-w-[90px]">רווח פלטפורמה</TableHead>
                      <TableHead className="text-slate-300 text-right font-semibold">סטטוס</TableHead>
                      <TableHead className="text-slate-300 text-right w-24 font-semibold">דוח מפורט</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPlayers.map((p) => {
                      const refundExceptional = (p.totalEntryFeeRefunds ?? 0) >= REFUND_EXCEPTIONAL_ABS;
                      return (
                        <TableRow key={p.userId} className="border-slate-700 hover:bg-slate-800/80">
                          <TableCell className="text-slate-200 text-right font-medium">{p.username ?? `#${p.userId}`}</TableCell>
                          <TableCell className="text-slate-300 text-right tabular-nums w-20">{p.assignedAgentId != null ? `#${p.assignedAgentId}` : "—"}</TableCell>
                          <TableCell className="text-slate-300 text-right tabular-nums min-w-[90px]">{formatNum(p.totalEntryFees - (p.totalEntryFeeRefunds ?? 0))}</TableCell>
                          <TableCell className="text-red-400/80 text-right tabular-nums min-w-[80px]">{formatNum(p.totalPrizesWon)}</TableCell>
                          <TableCell className="text-amber-500/90 text-right tabular-nums min-w-[80px]">{formatNum(p.totalEntryFeeRefunds ?? 0)}</TableCell>
                          <TableCell className="text-right tabular-nums min-w-[100px] font-medium">
                            {p.competitionNetPnL >= 0 ? <span className="text-emerald-400">+{formatNum(p.competitionNetPnL)}</span> : <span className="text-red-400">{formatNum(p.competitionNetPnL)}</span>}
                          </TableCell>
                          <TableCell className="text-slate-300 text-right tabular-nums min-w-[90px]">{formatNum(p.walletNetFlow)}</TableCell>
                          <TableCell className="text-slate-200 text-right tabular-nums min-w-[90px]">{formatNum(p.totalCommissionGenerated ?? 0)}</TableCell>
                          <TableCell className="text-emerald-400/90 text-right tabular-nums min-w-[90px] font-medium">{formatNum(p.platformProfitFromPlayer)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex flex-wrap gap-1 justify-end">
                              {p.competitionNetPnL > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400">רווחי</span>}
                              {p.competitionNetPnL < 0 && <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/15 text-red-400">הפסדי</span>}
                              {refundExceptional && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400">החזרים חריגים</span>}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="sm" className="text-amber-400 hover:text-amber-300" onClick={() => { setPlayerReportDetailId(p.userId); setPlayerReportDetailFrom(""); setPlayerReportDetailTo(""); }}>
                              <FileText className="w-4 h-4" />
                              דוח מפורט
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="global" className="mt-4">
          <p className="text-slate-400 text-sm mb-4">דוח כספי גלובלי לפי טווח תאריכים – סיכום ולפי תחרות / סוכן / שחקן. מקור: אירועים פיננסיים.</p>
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <label className="text-slate-400 text-sm">מתאריך</label>
            <Input type="date" value={globalReportFrom} onChange={(e) => setGlobalReportFrom(e.target.value)} className="h-9 w-36 bg-slate-800 border-slate-600 text-slate-200" />
            <label className="text-slate-400 text-sm">עד תאריך</label>
            <Input type="date" value={globalReportTo} onChange={(e) => setGlobalReportTo(e.target.value)} className="h-9 w-36 bg-slate-800 border-slate-600 text-slate-200" />
            <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white h-9" onClick={exportGlobalReportXlsx} disabled={globalReportExporting || !globalReport}>
              <Download className="w-4 h-4 ml-1" />
              {globalReportExporting ? "מייצא..." : "ייצוא Excel"}
            </Button>
            <Button variant="outline" size="sm" className="border-amber-500/50 text-amber-400 h-9" onClick={exportGlobalReportCsv} disabled={globalReportExporting || !globalReport}>
              ייצוא CSV
            </Button>
          </div>
          {globalReportLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>
          ) : globalReport ? (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 mb-6">
                <Card className="bg-slate-800/60 border-slate-700/80"><CardContent className="p-3"><p className="text-slate-500 text-xs">השתתפויות</p><p className="text-white font-bold tabular-nums">{formatNum(globalReport.summary.totalParticipations)}</p></CardContent></Card>
                <Card className="bg-slate-800/60 border-slate-700/80"><CardContent className="p-3"><p className="text-slate-500 text-xs">סך דמי כניסה</p><p className="text-white font-bold tabular-nums">{formatNum(globalReport.summary.totalEntryFeesCollected)}</p></CardContent></Card>
                <Card className="bg-slate-800/60 border-slate-700/80"><CardContent className="p-3"><p className="text-slate-500 text-xs">זכיות ששולמו</p><p className="text-amber-400 font-bold tabular-nums">{formatNum(globalReport.summary.totalWinningsPaid)}</p></CardContent></Card>
                <Card className="bg-slate-800/60 border-slate-700/80"><CardContent className="p-3"><p className="text-slate-500 text-xs">החזרים</p><p className="text-slate-300 font-bold tabular-nums">{formatNum(globalReport.summary.totalRefunds)}</p></CardContent></Card>
                <Card className="bg-slate-800/60 border-slate-700/80"><CardContent className="p-3"><p className="text-slate-500 text-xs">רווח/הפסד נטו פלטפורמה</p><p className={globalReport.summary.netPlatformProfitLoss >= 0 ? "text-emerald-400 font-bold tabular-nums" : "text-red-400 font-bold tabular-nums"}>{formatNum(globalReport.summary.netPlatformProfitLoss)}</p></CardContent></Card>
                <Card className="bg-slate-800/60 border-slate-700/80"><CardContent className="p-3"><p className="text-slate-500 text-xs">עמלה שנוצרה</p><p className="text-emerald-400 font-bold tabular-nums">{formatNum(globalReport.summary.totalCommissionGenerated)}</p></CardContent></Card>
                <Card className="bg-slate-800/60 border-slate-700/80"><CardContent className="p-3"><p className="text-slate-500 text-xs">עמלת סוכנים</p><p className="text-amber-400 font-bold tabular-nums">{formatNum(globalReport.summary.totalAgentCommission)}</p></CardContent></Card>
                <Card className="bg-slate-800/60 border-slate-700/80"><CardContent className="p-3"><p className="text-slate-500 text-xs">עמלת פלטפורמה</p><p className="text-slate-300 font-bold tabular-nums">{formatNum(globalReport.summary.totalPlatformCommission)}</p></CardContent></Card>
                <Card className="bg-slate-800/60 border-slate-700/80"><CardContent className="p-3"><p className="text-slate-500 text-xs">מספר תחרויות</p><p className="text-white font-bold tabular-nums">{globalReport.summary.numberOfTournaments}</p></CardContent></Card>
                <Card className="bg-slate-800/60 border-slate-700/80"><CardContent className="p-3"><p className="text-slate-500 text-xs">שחקנים פעילים</p><p className="text-white font-bold tabular-nums">{globalReport.summary.numberOfActivePlayers}</p></CardContent></Card>
                <Card className="bg-slate-800/60 border-slate-700/80"><CardContent className="p-3"><p className="text-slate-500 text-xs">סוכנים פעילים</p><p className="text-white font-bold tabular-nums">{globalReport.summary.numberOfActiveAgents}</p></CardContent></Card>
              </div>
              <h3 className="text-white font-semibold mb-2">לפי תחרות</h3>
              <Card className="bg-slate-800/60 border-slate-700/80 overflow-hidden mb-6">
                <div className="overflow-x-auto max-h-[40vh]">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-slate-700 bg-slate-800/95 sticky top-0 z-10">
                        <TableHead className="text-slate-300 text-right font-semibold">תחרות</TableHead>
                        <TableHead className="text-slate-300 text-right font-semibold w-20">סוג</TableHead>
                        <TableHead className="text-slate-300 text-right font-semibold w-20">השתתפויות</TableHead>
                        <TableHead className="text-slate-300 text-right font-semibold min-w-[80px]">דמי כניסה</TableHead>
                        <TableHead className="text-slate-300 text-right font-semibold min-w-[80px]">זכיות</TableHead>
                        <TableHead className="text-slate-300 text-right font-semibold min-w-[70px]">החזרים</TableHead>
                        <TableHead className="text-slate-300 text-right font-semibold min-w-[80px]">נטו</TableHead>
                        <TableHead className="text-slate-300 text-right font-semibold min-w-[70px]">עמלה</TableHead>
                        <TableHead className="text-slate-300 text-right font-semibold min-w-[70px]">סוכן</TableHead>
                        <TableHead className="text-slate-300 text-right font-semibold min-w-[70px]">פלטפורמה</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {globalReport.byTournament.map((r) => (
                        <TableRow key={r.tournamentId} className="border-slate-700">
                          <TableCell className="text-slate-200 text-right font-medium">{r.tournamentName}</TableCell>
                          <TableCell className="text-slate-400 text-right text-xs">{r.tournamentType}</TableCell>
                          <TableCell className="text-slate-300 text-right tabular-nums">{r.participations}</TableCell>
                          <TableCell className="text-slate-300 text-right tabular-nums">{formatNum(r.entryFees)}</TableCell>
                          <TableCell className="text-amber-400 text-right tabular-nums">{formatNum(r.winningsPaid)}</TableCell>
                          <TableCell className="text-slate-300 text-right tabular-nums">{formatNum(r.refunds)}</TableCell>
                          <TableCell className={`text-right tabular-nums font-medium ${r.netResult >= 0 ? "text-emerald-400" : "text-red-400"}`}>{formatNum(r.netResult)}</TableCell>
                          <TableCell className="text-emerald-400/90 text-right tabular-nums">{formatNum(r.totalCommission)}</TableCell>
                          <TableCell className="text-amber-400/90 text-right tabular-nums">{formatNum(r.agentCommission)}</TableCell>
                          <TableCell className="text-slate-300 text-right tabular-nums">{formatNum(r.platformCommission)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </Card>
              <h3 className="text-white font-semibold mb-2">לפי סוכן</h3>
              <Card className="bg-slate-800/60 border-slate-700/80 overflow-hidden mb-6">
                <div className="overflow-x-auto max-h-[40vh]">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-slate-700 bg-slate-800/95 sticky top-0 z-10">
                        <TableHead className="text-slate-300 text-right font-semibold">סוכן</TableHead>
                        <TableHead className="text-slate-300 text-right font-semibold w-20">שחקנים</TableHead>
                        <TableHead className="text-slate-300 text-right font-semibold w-20">השתתפויות</TableHead>
                        <TableHead className="text-slate-300 text-right font-semibold min-w-[80px]">דמי כניסה</TableHead>
                        <TableHead className="text-slate-300 text-right font-semibold min-w-[80px]">זכיות</TableHead>
                        <TableHead className="text-slate-300 text-right font-semibold min-w-[70px]">החזרים</TableHead>
                        <TableHead className="text-slate-300 text-right font-semibold min-w-[70px]">עמלה</TableHead>
                        <TableHead className="text-slate-300 text-right font-semibold min-w-[70px]">עמלת סוכן</TableHead>
                        <TableHead className="text-slate-300 text-right font-semibold min-w-[70px]">פלטפורמה</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {globalReport.byAgent.map((r) => (
                        <TableRow key={r.agentId} className="border-slate-700">
                          <TableCell className="text-slate-200 text-right font-medium">{r.agentName ?? r.agentUsername ?? `#${r.agentId}`}</TableCell>
                          <TableCell className="text-slate-300 text-right tabular-nums">{r.numberOfPlayers}</TableCell>
                          <TableCell className="text-slate-300 text-right tabular-nums">{r.participations}</TableCell>
                          <TableCell className="text-slate-300 text-right tabular-nums">{formatNum(r.entryFees)}</TableCell>
                          <TableCell className="text-amber-400 text-right tabular-nums">{formatNum(r.winningsPaid)}</TableCell>
                          <TableCell className="text-slate-300 text-right tabular-nums">{formatNum(r.refunds)}</TableCell>
                          <TableCell className="text-emerald-400/90 text-right tabular-nums">{formatNum(r.totalCommissionGenerated)}</TableCell>
                          <TableCell className="text-amber-400/90 text-right tabular-nums">{formatNum(r.agentCommission)}</TableCell>
                          <TableCell className="text-slate-300 text-right tabular-nums">{formatNum(r.platformShare)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </Card>
              <h3 className="text-white font-semibold mb-2">לפי שחקן</h3>
              <Card className="bg-slate-800/60 border-slate-700/80 overflow-hidden">
                <div className="overflow-x-auto max-h-[40vh]">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-slate-700 bg-slate-800/95 sticky top-0 z-10">
                        <TableHead className="text-slate-300 text-right font-semibold">שחקן</TableHead>
                        <TableHead className="text-slate-300 text-right font-semibold w-20">השתתפויות</TableHead>
                        <TableHead className="text-slate-300 text-right font-semibold min-w-[80px]">דמי כניסה</TableHead>
                        <TableHead className="text-slate-300 text-right font-semibold min-w-[80px]">זכיות</TableHead>
                        <TableHead className="text-slate-300 text-right font-semibold min-w-[70px]">החזרים</TableHead>
                        <TableHead className="text-slate-300 text-right font-semibold min-w-[80px]">רווח/הפסד נטו</TableHead>
                        <TableHead className="text-slate-300 text-right font-semibold min-w-[70px]">עמלה</TableHead>
                        <TableHead className="text-slate-300 text-right font-semibold min-w-[70px]">סוכן</TableHead>
                        <TableHead className="text-slate-300 text-right font-semibold min-w-[70px]">פלטפורמה</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {globalReport.byPlayer.map((r) => (
                        <TableRow key={r.userId} className="border-slate-700">
                          <TableCell className="text-slate-200 text-right font-medium">{r.fullName ?? r.username ?? `#${r.userId}`}</TableCell>
                          <TableCell className="text-slate-300 text-right tabular-nums">{r.participations}</TableCell>
                          <TableCell className="text-slate-300 text-right tabular-nums">{formatNum(r.entryFees)}</TableCell>
                          <TableCell className="text-amber-400 text-right tabular-nums">{formatNum(r.winningsPaid)}</TableCell>
                          <TableCell className="text-slate-300 text-right tabular-nums">{formatNum(r.refunds)}</TableCell>
                          <TableCell className={`text-right tabular-nums font-medium ${r.netProfitLoss >= 0 ? "text-emerald-400" : "text-red-400"}`}>{formatNum(r.netProfitLoss)}</TableCell>
                          <TableCell className="text-emerald-400/90 text-right tabular-nums">{formatNum(r.totalCommissionGenerated)}</TableCell>
                          <TableCell className="text-amber-400/90 text-right tabular-nums">{formatNum(r.agentShare)}</TableCell>
                          <TableCell className="text-slate-300 text-right tabular-nums">{formatNum(r.platformShare)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </Card>
            </>
          ) : (
            <p className="text-slate-400 py-4">טוען דוח גלובלי...</p>
          )}
        </TabsContent>
      </Tabs>

      {/* Tournament detail – event ledger */}
      <Dialog open={tournamentDetailId != null} onOpenChange={(open) => !open && setTournamentDetailId(null)}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col bg-slate-900 border-slate-700" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-white">יומן אירועים כספיים – תחרות #{tournamentDetailId}</DialogTitle>
          </DialogHeader>
          {detailLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>
          ) : tournamentDetail && (
            <>
              {tournamentDetail.summary && (
                <p className="text-slate-400 text-sm mb-2">
                  סה״כ ברוטו: {formatNum(tournamentDetail.summary.totalPool)} | עמלת פלטפורמה: {formatNum(tournamentDetail.summary.platformCommission)} | פרסים שולמו: {formatNum(tournamentDetail.summary.totalPrizesDistributed)}
                </p>
              )}
              {(tournamentDetail.events ?? []).length === 0 ? (
                <div className="py-8 text-center border border-slate-700 rounded-lg bg-slate-800/40">
                  <p className="text-slate-400">אין פעילות כספית בתקופה זו</p>
                </div>
              ) : (
              <div className="overflow-auto flex-1 border border-slate-700 rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-700 bg-slate-800/95 sticky top-0 z-10">
                      <TableHead className="text-slate-300 text-right font-semibold min-w-[180px]">תיאור (עברית)</TableHead>
                      <TableHead className="text-slate-300 text-right font-semibold w-24">סוג (מקור)</TableHead>
                      <TableHead className="text-slate-300 text-right font-semibold w-28">נקודות</TableHead>
                      <TableHead className="text-slate-300 text-right font-semibold w-20">משתמש</TableHead>
                      <TableHead className="text-slate-300 text-right font-semibold w-20">סוכן</TableHead>
                      <TableHead className="text-slate-300 text-right font-semibold w-20">הגשה</TableHead>
                      <TableHead className="text-slate-300 text-right font-semibold min-w-[120px]">תאריך</TableHead>
                      <TableHead className="text-slate-300 text-right font-semibold max-w-[120px] truncate">מפתח אידמפוטנטיות</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(tournamentDetail.events ?? []).map((e) => {
                      const isOutflow = e.eventType === "PRIZE_PAYOUT" || e.eventType === "REFUND" || e.eventType === "AGENT_COMMISSION";
                      const amountClass = isOutflow ? "text-red-400/90" : "text-emerald-400/90";
                      return (
                        <TableRow key={e.id} className="border-slate-700">
                          <TableCell className="text-slate-200 text-right min-w-[180px]">{getLedgerDescription(e.eventType, e)}</TableCell>
                          <TableCell className="text-slate-400 text-right text-xs w-24" title={e.eventType}>{EVENT_TYPE_LABELS[e.eventType] ?? e.eventType}</TableCell>
                          <TableCell className={`text-right tabular-nums font-medium w-28 ${amountClass}`}>{isOutflow ? formatNum(-Math.abs(e.amountPoints)) : formatNum(e.amountPoints)}</TableCell>
                          <TableCell className="text-slate-400 text-right tabular-nums w-20">{e.userId != null ? `#${e.userId}` : "—"}</TableCell>
                          <TableCell className="text-slate-400 text-right tabular-nums w-20">{e.agentId != null ? `#${e.agentId}` : "—"}</TableCell>
                          <TableCell className="text-slate-400 text-right tabular-nums w-20">{e.submissionId != null ? `#${e.submissionId}` : "—"}</TableCell>
                          <TableCell className="text-slate-300 text-right text-xs min-w-[120px]">{e.createdAt ? new Date(e.createdAt).toLocaleString("he-IL") : "—"}</TableCell>
                          <TableCell className="text-slate-500 text-right text-xs max-w-[120px] truncate" title={e.idempotencyKey ?? undefined}>{e.idempotencyKey ?? "—"}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Agent detail – players under agent */}
      <Dialog open={agentDetailId != null} onOpenChange={(open) => !open && setAgentDetailId(null)}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col bg-slate-900 border-slate-700" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-white">פירוט שחקנים – סוכן #{agentDetailId}</DialogTitle>
          </DialogHeader>
          {agentDetail && (
            <>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <Input type="date" value={agentReportDetailFrom} onChange={(e) => setAgentReportDetailFrom(e.target.value)} className="h-9 w-36 bg-slate-800 border-slate-600 text-slate-200 text-sm" placeholder="מתאריך" />
                <Input type="date" value={agentReportDetailTo} onChange={(e) => setAgentReportDetailTo(e.target.value)} className="h-9 w-36 bg-slate-800 border-slate-600 text-slate-200 text-sm" placeholder="עד תאריך" />
                <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white h-9" onClick={exportAgentReportDetailedXlsx} disabled={agentReportExporting}>
                  <Download className="w-4 h-4 ml-1" />
                  {agentReportExporting ? "מייצא..." : "ייצוא Excel"}
                </Button>
                <Button variant="outline" size="sm" className="border-amber-500/50 text-amber-400 h-9" onClick={exportAgentReportDetailedCsv} disabled={agentReportExporting}>
                  ייצוא CSV
                </Button>
              </div>
              <p className="text-slate-400 text-sm mb-2">
                {agentDetail.agentUsername ?? `#${agentDetailId}`} | שחקנים: {agentDetail.numberOfPlayers} | עמלה שצברה: {formatNum(agentDetail.agentTotalCommissionEarned)}
              </p>
              {(agentDetail.playerListWithPnL ?? []).length === 0 ? (
                <div className="py-8 text-center border border-slate-700 rounded-lg bg-slate-800/40">
                  <p className="text-slate-400">לא נמצאו שחקנים לתצוגה</p>
                </div>
              ) : (
              <div className="overflow-auto flex-1 border border-slate-700 rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-700 bg-slate-800/95 sticky top-0 z-10">
                      <TableHead className="text-slate-300 text-right font-semibold">שם משתמש</TableHead>
                      <TableHead className="text-slate-300 text-right font-semibold min-w-[90px]">השתתפויות</TableHead>
                      <TableHead className="text-slate-300 text-right font-semibold min-w-[80px]">פרסים</TableHead>
                      <TableHead className="text-slate-300 text-right font-semibold min-w-[80px]">החזרים</TableHead>
                      <TableHead className="text-slate-300 text-right font-semibold min-w-[100px]">רווח/הפסד תחרות</TableHead>
                      <TableHead className="text-slate-300 text-right font-semibold min-w-[90px]">עמלות שנוצרו</TableHead>
                      <TableHead className="text-slate-300 text-right font-semibold min-w-[90px]">עמלה לסוכן</TableHead>
                      <TableHead className="text-slate-300 text-right font-semibold min-w-[90px]">רווח פלטפורמה</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(agentDetail.playerListWithPnL ?? []).map((p) => (
                      <TableRow key={p.userId} className="border-slate-700">
                        <TableCell className="text-slate-200 text-right font-medium">{p.username ?? `#${p.userId}`}</TableCell>
                        <TableCell className="text-slate-300 text-right tabular-nums min-w-[90px]">{formatNum(p.totalEntryFees - (p.totalEntryFeeRefunds ?? 0))}</TableCell>
                        <TableCell className="text-red-400/80 text-right tabular-nums min-w-[80px]">{formatNum(p.totalPrizesWon)}</TableCell>
                        <TableCell className="text-amber-500/90 text-right tabular-nums min-w-[80px]">{formatNum(p.totalEntryFeeRefunds ?? 0)}</TableCell>
                        <TableCell className={`text-right tabular-nums font-medium min-w-[100px] ${p.competitionNetPnL >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                          {p.competitionNetPnL >= 0 ? `+${formatNum(p.competitionNetPnL)}` : formatNum(p.competitionNetPnL)}
                        </TableCell>
                        <TableCell className="text-slate-200 text-right tabular-nums min-w-[90px]">{formatNum(p.commissionGenerated)}</TableCell>
                        <TableCell className="text-amber-400 text-right tabular-nums min-w-[90px]">{formatNum(p.agentCommissionFromPlayer)}</TableCell>
                        <TableCell className="text-emerald-400/90 text-right tabular-nums font-medium min-w-[90px]">{formatNum(p.commissionGenerated - (p.agentCommissionFromPlayer ?? 0))}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Player detail – דוח שחקן מפורט */}
      <Dialog open={playerReportDetailId != null} onOpenChange={(open) => !open && setPlayerReportDetailId(null)}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col bg-slate-900 border-slate-700" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-white">דוח שחקן מפורט – #{playerReportDetailId}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <Input type="date" value={playerReportDetailFrom} onChange={(e) => setPlayerReportDetailFrom(e.target.value)} className="h-9 w-36 bg-slate-800 border-slate-600 text-slate-200 text-sm" placeholder="מתאריך" />
            <Input type="date" value={playerReportDetailTo} onChange={(e) => setPlayerReportDetailTo(e.target.value)} className="h-9 w-36 bg-slate-800 border-slate-600 text-slate-200 text-sm" placeholder="עד תאריך" />
            <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white h-9" onClick={exportPlayerReportDetailedXlsx} disabled={playerReportExporting || !playerReportDetail}>
              <Download className="w-4 h-4 ml-1" />
              {playerReportExporting ? "מייצא..." : "ייצוא Excel"}
            </Button>
            <Button variant="outline" size="sm" className="border-amber-500/50 text-amber-400 h-9" onClick={exportPlayerReportDetailedCsv} disabled={playerReportExporting || !playerReportDetail}>
              ייצוא CSV
            </Button>
          </div>
          {playerReportDetailLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>
          ) : playerReportDetail ? (
            <>
              <p className="text-slate-400 text-sm mb-2">
                {playerReportDetail.fullName ?? playerReportDetail.username ?? `#${playerReportDetail.userId}`}
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4 p-3 rounded-lg bg-slate-800/80 text-sm">
                <div><p className="text-slate-500 text-xs">השתתפויות</p><p className="text-white font-bold">{formatNum(playerReportDetail.summary.totalParticipations)}</p></div>
                <div><p className="text-slate-500 text-xs">סך דמי כניסה</p><p className="text-white font-bold">{formatNum(playerReportDetail.summary.totalEntryFees)}</p></div>
                <div><p className="text-slate-500 text-xs">סך זכיות ששולמו</p><p className="text-amber-400 font-bold">{formatNum(playerReportDetail.summary.totalWinningsPaid)}</p></div>
                <div><p className="text-slate-500 text-xs">סך החזרים</p><p className="text-slate-300 font-bold">{formatNum(playerReportDetail.summary.totalRefunds)}</p></div>
                <div><p className="text-slate-500 text-xs">רווח/הפסד נטו</p><p className={playerReportDetail.summary.netProfitLoss >= 0 ? "text-emerald-400 font-bold" : "text-red-400 font-bold"}>{formatNum(playerReportDetail.summary.netProfitLoss)}</p></div>
                <div><p className="text-slate-500 text-xs">עמלה שנוצרה</p><p className="text-emerald-400 font-bold">{formatNum(playerReportDetail.summary.totalCommissionGenerated)}</p></div>
                <div><p className="text-slate-500 text-xs">חלק סוכן</p><p className="text-amber-400 font-bold">{formatNum(playerReportDetail.summary.agentShare)}</p></div>
                <div><p className="text-slate-500 text-xs">חלק פלטפורמה</p><p className="text-slate-300 font-bold">{formatNum(playerReportDetail.summary.platformShare)}</p></div>
              </div>
              {playerReportDetail.rows.length === 0 ? (
                <div className="py-8 text-center border border-slate-700 rounded-lg bg-slate-800/40">
                  <p className="text-slate-400">אין השתתפויות בתקופה הנבחרת</p>
                </div>
              ) : (
                <div className="overflow-auto flex-1 border border-slate-700 rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-slate-700 bg-slate-800/95 sticky top-0 z-10">
                        <TableHead className="text-slate-300 text-right font-semibold min-w-[120px]">תחרות</TableHead>
                        <TableHead className="text-slate-300 text-right font-semibold w-24">סוג</TableHead>
                        <TableHead className="text-slate-300 text-right font-semibold w-24">תאריך</TableHead>
                        <TableHead className="text-slate-300 text-right font-semibold w-20">דמי כניסה</TableHead>
                        <TableHead className="text-slate-300 text-right font-semibold w-20">זכיות</TableHead>
                        <TableHead className="text-slate-300 text-right font-semibold w-20">החזר</TableHead>
                        <TableHead className="text-slate-300 text-right font-semibold w-24">תוצאה נטו</TableHead>
                        <TableHead className="text-slate-300 text-right font-semibold w-20">עמלה</TableHead>
                        <TableHead className="text-slate-300 text-right font-semibold w-20">חלק סוכן</TableHead>
                        <TableHead className="text-slate-300 text-right font-semibold w-20">חלק פלטפורמה</TableHead>
                        <TableHead className="text-slate-300 text-right font-semibold w-20">סטטוס</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {playerReportDetail.rows.map((r, idx) => (
                        <TableRow key={`${r.tournamentId}-${r.submissionId ?? ""}-${idx}`} className="border-slate-700">
                          <TableCell className="text-slate-200 text-right font-medium min-w-[120px]">{r.tournamentName}</TableCell>
                          <TableCell className="text-slate-400 text-right text-xs w-24">{r.tournamentType}</TableCell>
                          <TableCell className="text-slate-400 text-right text-xs w-24">{r.date ? new Date(r.date).toLocaleDateString("he-IL") : "—"}</TableCell>
                          <TableCell className="text-slate-300 text-right tabular-nums w-20">{formatNum(r.entryFee)}</TableCell>
                          <TableCell className="text-amber-400 text-right tabular-nums w-20">{formatNum(r.winnings)}</TableCell>
                          <TableCell className="text-slate-300 text-right tabular-nums w-20">{formatNum(r.refund)}</TableCell>
                          <TableCell className={`text-right tabular-nums font-medium w-24 ${r.netResult >= 0 ? "text-emerald-400" : "text-red-400"}`}>{formatNum(r.netResult)}</TableCell>
                          <TableCell className="text-emerald-400/90 text-right tabular-nums w-20">{formatNum(r.totalCommission)}</TableCell>
                          <TableCell className="text-amber-400/90 text-right tabular-nums w-20">{formatNum(r.agentShare)}</TableCell>
                          <TableCell className="text-slate-300 text-right tabular-nums w-20">{formatNum(r.platformShare)}</TableCell>
                          <TableCell className="text-right w-20">{r.status === "profit" ? "רווח" : r.status === "loss" ? "הפסד" : "מאוזן"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </>
          ) : (
            <p className="text-slate-400 py-4">לא ניתן לטעון את הדוח</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
