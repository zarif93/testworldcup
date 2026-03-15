/**
 * Phase 28/30: Admin payment transactions – list, filter, summary, detail, mark paid/failed/refunded.
 */

import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, ArrowLeft, CreditCard, Check, X, RotateCcw, Eye } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

type Props = { onBack: () => void };

const STATUS_OPTIONS = ["pending", "paid", "failed", "refunded", "cancelled"] as const;
const TYPE_OPTIONS = ["entry_fee", "payout", "deposit", "withdrawal", "refund", "manual_adjustment"] as const;
const ACCOUNTING_TYPE_OPTIONS = ["all", "points_deducted", "external", "none"] as const;

export function PaymentsSection({ onBack }: Props) {
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  const [typeFilter, setTypeFilter] = useState<string | undefined>(undefined);
  const [providerFilter, setProviderFilter] = useState<string | undefined>(undefined);
  const [accountingTypeFilter, setAccountingTypeFilter] = useState<string>("all");
  const [tournamentIdFilter, setTournamentIdFilter] = useState<string>("");
  const [userIdFilter, setUserIdFilter] = useState<string>("");
  const [detailPaymentId, setDetailPaymentId] = useState<number | null>(null);

  const { data: summary, refetch: refetchSummary } = trpc.admin.getPaymentReportSummary.useQuery(undefined, { refetchOnWindowFocus: false });
  const { data: list, isLoading, refetch } = trpc.admin.listPaymentTransactions.useQuery({
    status: statusFilter || undefined,
    type: typeFilter || undefined,
    tournamentId: tournamentIdFilter ? Number(tournamentIdFilter) : undefined,
    userId: userIdFilter ? Number(userIdFilter) : undefined,
    provider: providerFilter || undefined,
    limit: 200,
    offset: 0,
  });

  const { data: detailData, isLoading: detailLoading } = trpc.admin.getPaymentTransactionDetail.useQuery(
    { id: detailPaymentId! },
    { enabled: detailPaymentId != null }
  );

  const updateStatusMut = trpc.admin.updatePaymentTransactionStatus.useMutation({
    onSuccess: (r) => {
      if (r.success) {
        toast.success("סטטוס התשלום עודכן");
        refetch();
        refetchSummary();
      } else toast.error("עדכון נכשל");
    },
    onError: (e) => toast.error(e.message || "שגיאה"),
  });

  const rawPayments = list ?? [];
  const payments = useMemo(() => {
    if (accountingTypeFilter === "all") return rawPayments;
    return rawPayments.filter((p) => {
      const type = (p as { metadataJson?: { accounting?: { accountingType?: string } } }).metadataJson?.accounting?.accountingType ?? "none";
      return type === accountingTypeFilter;
    });
  }, [rawPayments, accountingTypeFilter]);

  const providers = useMemo(() => {
    const set = new Set<string>();
    (summary?.countByProvider && Object.keys(summary.countByProvider))?.forEach((k) => set.add(k));
    return Array.from(set).sort();
  }, [summary?.countByProvider]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 flex-wrap">
        <Button variant="ghost" size="sm" className="text-slate-400 -ml-2 md:ml-0" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 ml-1" />
          חזרה
        </Button>
      </div>
      <h2 className="text-xl md:text-2xl font-bold text-white flex items-center gap-2">
        <CreditCard className="w-6 h-6 md:w-8 md:h-8 text-amber-400 shrink-0" />
        תשלומים / Payment transactions
      </h2>

      {/* Phase 30: Summary cards */}
      {summary && (
        <section className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          <Card className="bg-slate-800/60 border-slate-700/80 rounded-xl">
            <CardContent className="p-3">
              <p className="text-slate-400 text-xs">סה״כ רשומות</p>
              <p className="text-lg font-bold text-white tabular-nums">{summary.totalCount}</p>
            </CardContent>
          </Card>
          <Card className="bg-slate-800/60 border-slate-700/80 rounded-xl">
            <CardContent className="p-3">
              <p className="text-slate-400 text-xs">ממתינים</p>
              <p className="text-lg font-bold text-amber-400 tabular-nums">{summary.countByStatus?.pending ?? 0}</p>
              <p className="text-xs text-slate-500">סכום: {summary.amountByStatus?.pending ?? 0}</p>
            </CardContent>
          </Card>
          <Card className="bg-slate-800/60 border-emerald-500/20 rounded-xl">
            <CardContent className="p-3">
              <p className="text-slate-400 text-xs">שולמו</p>
              <p className="text-lg font-bold text-emerald-400 tabular-nums">{summary.countByStatus?.paid ?? 0}</p>
              <p className="text-xs text-slate-500">סכום: {summary.amountByStatus?.paid ?? 0}</p>
            </CardContent>
          </Card>
          <Card className="bg-slate-800/60 border-amber-500/20 rounded-xl">
            <CardContent className="p-3">
              <p className="text-slate-400 text-xs">הוחזרו</p>
              <p className="text-lg font-bold text-amber-400 tabular-nums">{summary.countByStatus?.refunded ?? 0}</p>
              <p className="text-xs text-slate-500">סכום: {summary.amountByStatus?.refunded ?? 0}</p>
            </CardContent>
          </Card>
          <Card className="bg-slate-800/60 border-red-500/20 rounded-xl">
            <CardContent className="p-3">
              <p className="text-slate-400 text-xs">נכשלו</p>
              <p className="text-lg font-bold text-red-400 tabular-nums">{summary.countByStatus?.failed ?? 0}</p>
            </CardContent>
          </Card>
          <Card className="bg-slate-800/60 border-slate-700/80 rounded-xl">
            <CardContent className="p-3">
              <p className="text-slate-400 text-xs">נקודות / חיצוני</p>
              <p className="text-lg font-bold text-slate-300 tabular-nums">
                {summary.countByAccountingType?.points_deducted ?? 0} / {summary.countByAccountingType?.external ?? 0}
              </p>
            </CardContent>
          </Card>
        </section>
      )}

      <Card className="bg-slate-800/50 border-slate-700 rounded-xl">
        <CardHeader className="pb-2">
          <p className="text-slate-400 text-sm">רשימת תשלומים. סינון, פרטים ועדכון סטטוס.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2 items-center">
            <Select value={statusFilter ?? "all"} onValueChange={(v) => setStatusFilter(v === "all" ? undefined : v)}>
              <SelectTrigger className="w-[140px] bg-slate-900 border-slate-600 text-white">
                <SelectValue placeholder="סטטוס" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">כל הסטטוסים</SelectItem>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={typeFilter ?? "all"} onValueChange={(v) => setTypeFilter(v === "all" ? undefined : v)}>
              <SelectTrigger className="w-[160px] bg-slate-900 border-slate-600 text-white">
                <SelectValue placeholder="סוג" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">כל הסוגים</SelectItem>
                {TYPE_OPTIONS.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={providerFilter ?? "all"} onValueChange={(v) => setProviderFilter(v === "all" ? undefined : v)}>
              <SelectTrigger className="w-[120px] bg-slate-900 border-slate-600 text-white">
                <SelectValue placeholder="ספק" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">כל הספקים</SelectItem>
                {providers.map((p) => (
                  <SelectItem key={p} value={p}>{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={accountingTypeFilter} onValueChange={setAccountingTypeFilter}>
              <SelectTrigger className="w-[130px] bg-slate-900 border-slate-600 text-white">
                <SelectValue placeholder="חשבונאות" />
              </SelectTrigger>
              <SelectContent>
                {ACCOUNTING_TYPE_OPTIONS.map((a) => (
                  <SelectItem key={a} value={a}>
                    {a === "all" ? "הכל" : a === "points_deducted" ? "נקודות" : a === "external" ? "חיצוני" : "ללא"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              placeholder="מזהה תחרות"
              className="w-28 bg-slate-900 border-slate-600 text-white"
              value={tournamentIdFilter}
              onChange={(e) => setTournamentIdFilter(e.target.value)}
            />
            <Input
              placeholder="מזהה משתמש"
              className="w-28 bg-slate-900 border-slate-600 text-white"
              value={userIdFilter}
              onChange={(e) => setUserIdFilter(e.target.value)}
            />
          </div>

          {isLoading && (
            <div className="flex justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
            </div>
          )}

          {!isLoading && payments.length === 0 && (
            <p className="text-slate-500 py-4">אין רשומות תשלום (או שאין טבלת payment_transactions – SQLite).</p>
          )}

          {!isLoading && payments.length > 0 && (
            <div className="overflow-x-auto rounded-lg border border-slate-700">
              <table className="w-full text-sm text-right">
                <thead>
                  <tr className="bg-slate-800 text-slate-400 border-b border-slate-700">
                    <th className="py-2 px-2">#</th>
                    <th className="py-2 px-2">משתמש</th>
                    <th className="py-2 px-2">תחרות</th>
                    <th className="py-2 px-2">טופס</th>
                    <th className="py-2 px-2">סוג</th>
                    <th className="py-2 px-2">סכום</th>
                    <th className="py-2 px-2">סטטוס</th>
                    <th className="py-2 px-2">חשבונאות</th>
                    <th className="py-2 px-2">ספק</th>
                    <th className="py-2 px-2">נוצר</th>
                    <th className="py-2 px-2">פעולות</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id} className="border-b border-slate-700/50 hover:bg-slate-800/50">
                      <td className="py-1.5 px-2 text-slate-300">{p.id}</td>
                      <td className="py-1.5 px-2 text-white">{p.userId}</td>
                      <td className="py-1.5 px-2 text-white">{p.tournamentId}</td>
                      <td className="py-1.5 px-2 text-slate-300">{p.submissionId ?? "—"}</td>
                      <td className="py-1.5 px-2 text-slate-300">{p.type}</td>
                      <td className="py-1.5 px-2 font-medium text-white">{p.amount}</td>
                      <td className="py-1.5 px-2">
                        <Badge
                          variant="secondary"
                          className={
                            p.status === "paid" ? "bg-emerald-500/20 text-emerald-400" :
                            p.status === "failed" ? "bg-red-500/20 text-red-400" :
                            p.status === "refunded" ? "bg-amber-500/20 text-amber-400" :
                            "bg-slate-600 text-slate-300"
                          }
                        >
                          {p.status}
                        </Badge>
                      </td>
                      <td className="py-1.5 px-2 text-slate-400 text-xs">
                        {(p as { metadataJson?: { accounting?: { accountingType?: string; refundedAt?: string } } }).metadataJson?.accounting?.accountingType === "points_deducted"
                          ? "נקודות"
                          : (p as { metadataJson?: { accounting?: { accountingType?: string } } }).metadataJson?.accounting?.accountingType === "external"
                            ? "חיצוני"
                            : "—"}
                      </td>
                      <td className="py-1.5 px-2 text-slate-400">{p.provider ?? "manual"}</td>
                      <td className="py-1.5 px-2 text-slate-500">
                        {p.createdAt ? new Date(p.createdAt).toLocaleDateString("he-IL") : "—"}
                      </td>
                      <td className="py-1.5 px-2">
                        <div className="flex gap-1 flex-wrap">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-slate-400 hover:text-white"
                            onClick={() => setDetailPaymentId(p.id)}
                            title="פרטים"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </Button>
                          {p.status === "pending" && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-emerald-400 border-emerald-600 hover:bg-emerald-500/20"
                                onClick={() => updateStatusMut.mutate({ id: p.id, status: "paid" })}
                                disabled={updateStatusMut.isPending}
                              >
                                <Check className="w-3.5 h-3.5 ml-0.5" />
                                שולם
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-red-400 border-red-600 hover:bg-red-500/20"
                                onClick={() => updateStatusMut.mutate({ id: p.id, status: "failed" })}
                                disabled={updateStatusMut.isPending}
                              >
                                <X className="w-3.5 h-3.5" />
                                נכשל
                              </Button>
                            </>
                          )}
                          {p.status === "paid" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-amber-400 border-amber-600 hover:bg-amber-500/20"
                              onClick={() => updateStatusMut.mutate({ id: p.id, status: "refunded" })}
                              disabled={updateStatusMut.isPending}
                            >
                              <RotateCcw className="w-3.5 h-3.5 ml-0.5" />
                              החזר
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Phase 30: Payment detail modal */}
      <Dialog open={detailPaymentId != null} onOpenChange={(open) => !open && setDetailPaymentId(null)}>
        <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white">פרטי תשלום #{detailPaymentId}</DialogTitle>
          </DialogHeader>
          {detailLoading && (
            <div className="flex justify-center py-6">
              <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
            </div>
          )}
          {!detailLoading && detailData && (
            <div className="space-y-4 text-sm">
              {detailData.payment != null ? (
                <div className="space-y-1">
                  <p className="text-slate-400 font-medium">תשלום</p>
                  <pre className="bg-slate-900 p-3 rounded text-xs overflow-x-auto">
                    {JSON.stringify(
                      {
                        id: (detailData.payment as { id?: number }).id,
                        userId: (detailData.payment as { userId?: number }).userId,
                        tournamentId: (detailData.payment as { tournamentId?: number }).tournamentId,
                        submissionId: (detailData.payment as { submissionId?: number | null }).submissionId,
                        type: (detailData.payment as { type?: string }).type,
                        amount: (detailData.payment as { amount?: number }).amount,
                        status: (detailData.payment as { status?: string }).status,
                        provider: (detailData.payment as { provider?: string | null }).provider,
                        externalRef: (detailData.payment as { externalRef?: string | null }).externalRef,
                        notes: (detailData.payment as { notes?: string | null }).notes,
                        accounting: (detailData.payment as { metadataJson?: { accounting?: unknown } }).metadataJson?.accounting,
                        createdAt: (detailData.payment as { createdAt?: unknown }).createdAt,
                        paidAt: (detailData.payment as { paidAt?: unknown }).paidAt,
                      },
                      null,
                      2
                    ) as string}
                  </pre>
                </div>
              ) : null}
              {detailData.submission != null ? (
                <div>
                  <p className="text-slate-400 font-medium">טופס מקושר</p>
                  <p className="text-slate-200">
                    #{String((detailData.submission as { id?: number }).id)} – סטטוס: {String((detailData.submission as { status?: string }).status ?? "")} / תשלום: {String((detailData.submission as { paymentStatus?: string }).paymentStatus ?? "")}
                    {((detailData.submission as { username?: string }).username) != null && (detailData.submission as { username?: string }).username !== "" && ` – ${String((detailData.submission as { username: string }).username)}`}
                  </p>
                </div>
              ) : null}
              {detailData.tournament != null ? (
                <div>
                  <p className="text-slate-400 font-medium">תחרות</p>
                  <p className="text-slate-200">#{String((detailData.tournament as { id?: number }).id)} – {String((detailData.tournament as { name?: string }).name ?? "")}</p>
                </div>
              ) : null}
              {detailData.user != null ? (
                <div>
                  <p className="text-slate-400 font-medium">משתמש</p>
                  <p className="text-slate-200">#{String((detailData.user as { id?: number }).id)} – {String((detailData.user as { username?: string }).username ?? (detailData.user as { name?: string }).name ?? "—")}</p>
                </div>
              ) : null}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
