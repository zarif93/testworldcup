/**
 * Admin: Jackpot configuration and draw execution.
 * - Ticket step (ILS per ticket), default 1000
 * - Payout split (winner % / carry-over), default 75/25
 * - Next draw at (datetime)
 * - Current balance
 * - Run draw (manual trigger)
 * - Draw audit log
 */

import { useState, useEffect } from "react";
import { Loader2, Save, Trophy, Play } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export function JackpotSection() {
  const utils = trpc.useUtils();
  const { data: settings, isLoading: settingsLoading } = trpc.admin.getJackpotSettings.useQuery(undefined, { staleTime: 10_000 });
  const { data: draws, isLoading: drawsLoading } = trpc.admin.listJackpotDraws.useQuery({ limit: 30 }, { staleTime: 15_000 });

  const [enabled, setEnabled] = useState(true);
  const [contributionBasisPoints, setContributionBasisPoints] = useState("");
  const [ticketStepIls, setTicketStepIls] = useState("");
  const [winnerPayoutPercent, setWinnerPayoutPercent] = useState("");
  const [nextDrawAt, setNextDrawAt] = useState("");
  const [balancePoints, setBalancePoints] = useState("");

  const setMut = trpc.admin.setJackpotSettings.useMutation({
    onSuccess: () => {
      utils.admin.getJackpotSettings.invalidate();
      toast.success("ההגדרות נשמרו");
    },
    onError: (e) => toast.error(e.message),
  });
  const runMut = trpc.admin.runJackpotDraw.useMutation({
    onSuccess: (result) => {
      if ("success" in result && result.success) {
        toast.success(`הגרלה ידנית בוצעה. זוכה: ${result.winnerUsername} (${result.payoutAmount} ₪)`);
        utils.admin.getJackpotSettings.invalidate();
        utils.admin.listJackpotDraws.invalidate();
      } else {
        toast.error("success" in result ? result.error : "הגרלה נכשלה");
      }
    },
    onError: (e) => toast.error(e.message),
  });

  useEffect(() => {
    if (settings == null) return;
    setEnabled(settings.enabled !== false);
    setContributionBasisPoints(String(settings.contributionBasisPoints ?? ""));
    setTicketStepIls(String(settings.ticketStepIls ?? ""));
    setWinnerPayoutPercent(String(settings.winnerPayoutPercent ?? ""));
    if (settings.nextDrawAt) {
      try {
        const d = new Date(settings.nextDrawAt);
        setNextDrawAt(Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 16));
      } catch {
        setNextDrawAt("");
      }
    } else setNextDrawAt("");
    setBalancePoints(String(settings.balancePoints ?? ""));
  }, [settings]);

  const handleSave = () => {
    const payload: { enabled?: boolean; contributionBasisPoints?: number; ticketStepIls?: number; winnerPayoutPercent?: number; nextDrawAt?: string | null; balancePoints?: number } = {};
    payload.enabled = enabled;
    const bps = parseInt(contributionBasisPoints, 10);
    if (!Number.isNaN(bps) && bps >= 0 && bps <= 10000) payload.contributionBasisPoints = bps;
    const step = parseInt(ticketStepIls, 10);
    if (!Number.isNaN(step) && step >= 1) payload.ticketStepIls = step;
    const pct = parseInt(winnerPayoutPercent, 10);
    if (!Number.isNaN(pct) && pct >= 0 && pct <= 100) payload.winnerPayoutPercent = pct;
    if (nextDrawAt.trim()) {
      try {
        const d = new Date(nextDrawAt);
        if (!Number.isNaN(d.getTime())) payload.nextDrawAt = d.toISOString();
      } catch {}
    } else payload.nextDrawAt = null;
    const bal = parseInt(balancePoints, 10);
    if (!Number.isNaN(bal) && bal >= 0) payload.balancePoints = bal;
    setMut.mutate(payload);
  };

  const handleRunDraw = () => {
    if (!confirm("הגרלה ידנית – לשימוש חירום/דילוג בלבד. ההגרלה הרגילה מתבצעת אוטומטית במועד שמוגדר.\n\nלבצע הגרלה עכשיו (trigger_type=manual)?")) return;
    runMut.mutate({});
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-400" />
            הגדרות ג׳קפוט
          </h2>
          <p className="text-slate-400 text-sm">
            חלון זכאות: 7 ימים אחורה מתאריך ההגרלה. כרטיסים = floor(היקף משחק מאושר / צעד כרטיס). ברירת מחדל: 1000 ₪ לכרטיס, 75% לזוכה / 25% גלגול.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {settingsLoading ? (
            <div className="flex items-center gap-2 text-slate-400"><Loader2 className="w-4 h-4 animate-spin" /> טוען...</div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2 flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="jackpot-enabled"
                    checked={enabled}
                    onChange={(e) => setEnabled(e.target.checked)}
                    className="rounded border-slate-500 bg-slate-800 text-amber-500 focus:ring-amber-500"
                  />
                  <Label htmlFor="jackpot-enabled" className="text-slate-300 cursor-pointer">ג׳קפוט פעיל (חיוב אחוז מהרשמה)</Label>
                </div>
                <div>
                  <Label className="text-slate-400">אחוז תרומה מג׳קפוט (basis points, 250 = 2.5%)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={10000}
                    value={contributionBasisPoints}
                    onChange={(e) => setContributionBasisPoints(e.target.value)}
                    placeholder="250"
                    className="mt-1 bg-slate-900 border-slate-600 text-white"
                  />
                </div>
                <div>
                  <Label className="text-slate-400">צעד כרטיס (₪ לכרטיס אחד)</Label>
                  <Input
                    type="number"
                    min={1}
                    value={ticketStepIls}
                    onChange={(e) => setTicketStepIls(e.target.value)}
                    placeholder="1000"
                    className="mt-1 bg-slate-900 border-slate-600 text-white"
                  />
                </div>
                <div>
                  <Label className="text-slate-400">אחוז לזוכה (%)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={winnerPayoutPercent}
                    onChange={(e) => setWinnerPayoutPercent(e.target.value)}
                    placeholder="75"
                    className="mt-1 bg-slate-900 border-slate-600 text-white"
                  />
                </div>
                <div>
                  <Label className="text-slate-400">מועד הגרלה הבאה (תאריך+שעה)</Label>
                  <Input
                    type="datetime-local"
                    value={nextDrawAt}
                    onChange={(e) => setNextDrawAt(e.target.value)}
                    className="mt-1 bg-slate-900 border-slate-600 text-white"
                  />
                </div>
                <div>
                  <Label className="text-slate-400">יתרת פול נוכחית (₪)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={balancePoints}
                    onChange={(e) => setBalancePoints(e.target.value)}
                    className="mt-1 bg-slate-900 border-slate-600 text-white"
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={handleSave} disabled={setMut.isPending} className="bg-amber-600 hover:bg-amber-700">
                  {setMut.isPending ? <Loader2 className="w-4 h-4 animate-spin ml-1" /> : <Save className="w-4 h-4 ml-1" />}
                  שמור הגדרות
                </Button>
                <Button variant="outline" onClick={handleRunDraw} disabled={runMut.isPending} className="border-amber-500/50 text-amber-400 hover:bg-amber-500/10" title="Override ידני / חירום בלבד">
                  {runMut.isPending ? <Loader2 className="w-4 h-4 animate-spin ml-1" /> : <Play className="w-4 h-4 ml-1" />}
                  הגרלה ידנית (חירום)
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <h3 className="text-lg font-bold text-white">היסטוריית הגרלות</h3>
          <p className="text-slate-500 text-xs">סכומים ב-₪. trigger_type=manual = הגרלה ידנית (חירום).</p>
        </CardHeader>
        <CardContent>
          {drawsLoading ? (
            <div className="flex items-center gap-2 text-slate-400"><Loader2 className="w-4 h-4 animate-spin" /> טוען...</div>
          ) : draws?.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-sm">
                <thead>
                  <tr className="border-b border-slate-600 text-slate-400">
                    <th className="py-2 px-2">תאריך</th>
                    <th className="py-2 px-2">סוג</th>
                    <th className="py-2 px-2">סטטוס</th>
                    <th className="py-2 px-2">זוכה</th>
                    <th className="py-2 px-2">סכום לזוכה (₪)</th>
                    <th className="py-2 px-2">גלגול (₪)</th>
                    <th className="py-2 px-2">פול (₪)</th>
                  </tr>
                </thead>
                <tbody>
                  {draws.map((row) => (
                    <tr key={row.id} className="border-b border-slate-700/80">
                      <td className="py-2 px-2 text-slate-300">{(row.executedAt ? new Date(row.executedAt) : new Date(row.scheduledFor)).toLocaleString("he-IL")}</td>
                      <td className="py-2 px-2">{row.triggerType === "manual" ? <span className="text-amber-400 font-medium">ידני</span> : "מתוזמן"}</td>
                      <td className="py-2 px-2">{row.status}</td>
                      <td className="py-2 px-2 font-medium">{row.winnerUsername != null ? `${row.winnerUsername} (#${row.winnerUserId})` : "—"}</td>
                      <td className="py-2 px-2 text-amber-400">{row.payoutAmount != null ? `${row.payoutAmount} ₪` : "—"}</td>
                      <td className="py-2 px-2 text-slate-400">{row.carryOverAmount != null ? `${row.carryOverAmount} ₪` : "—"}</td>
                      <td className="py-2 px-2 text-slate-400">{row.totalPoolAtDraw} ₪</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-slate-500">אין עדיין הגרלות.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
