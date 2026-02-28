import { useAuth } from "@/contexts/AuthContext";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useLocation } from "wouter";
import { Loader2, Users, Coins, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function AgentDashboard() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { data: report, isLoading } = trpc.agent.getMyReport.useQuery(undefined, {
    enabled: !!user && user.role === "agent",
  });

  if (!user || user.role !== "agent") {
    setLocation("/");
    return null;
  }

  const copyCode = () => {
    if (report?.referralCode) {
      navigator.clipboard.writeText(report.referralCode);
      toast.success("קוד ההפניה הועתק");
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-amber-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen py-8">
      <div className="container mx-auto px-4 max-w-2xl">
        <h1 className="text-2xl font-bold text-white mb-6">לוח הסוכן</h1>

        <Card className="bg-slate-800/60 border-slate-600/50 mb-6">
          <CardHeader>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Copy className="w-5 h-5 text-amber-400" />
              קוד הפניה
            </h2>
            <p className="text-slate-400 text-sm">משתמשים שנרשמים עם הקוד הזה ייזקפו אליך ועמלתיך תחושב על תפוסים שאושרו.</p>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <code className="text-xl font-mono bg-slate-900 px-4 py-2 rounded-lg text-amber-400 border border-amber-500/30">
                {report?.referralCode ?? "—"}
              </code>
              <Button size="sm" variant="outline" onClick={copyCode} className="border-amber-500/50 text-amber-400">
                העתק
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/60 border-slate-600/50 mb-6">
          <CardHeader>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-emerald-400" />
              סיכום
            </h2>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-slate-500">שחקנים שהבאת</p>
                <p className="text-white font-bold text-lg">{report?.referredUsers ?? 0}</p>
              </div>
              <div>
                <p className="text-slate-500">סכום תפוסים (מאושרים)</p>
                <p className="text-white font-bold">₪{(report?.totalEntryAmount ?? 0).toLocaleString("he-IL")}</p>
              </div>
              <div>
                <p className="text-slate-500">סה״כ עמלה</p>
                <p className="text-emerald-400 font-bold text-lg">₪{(report?.totalCommission ?? 0).toLocaleString("he-IL")}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/60 border-slate-600/50 mb-6">
          <CardHeader>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Coins className="w-5 h-5 text-amber-400" />
              היסטוריית עמלות
            </h2>
            <p className="text-slate-400 text-sm">עמלה נרשמת אוטומטית כשטופס מאושר לשחקן שהבאת.</p>
          </CardHeader>
          <CardContent>
            {report?.commissions && report.commissions.length > 0 ? (
              <ul className="space-y-2 text-sm">
                {report.commissions.map((c) => (
                  <li key={c.submissionId} className="flex justify-between items-center py-2 border-b border-slate-700/50">
                    <span className="text-slate-400">טופס #{c.submissionId} • שחקן #{c.userId}</span>
                    <span className="text-white">₪{c.entryAmount} → <span className="text-emerald-400">₪{c.commissionAmount}</span></span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-slate-500 text-center py-6">עדיין אין עמלות</p>
            )}
          </CardContent>
        </Card>

        {report?.referredList && report.referredList.length > 0 && (
          <Card className="bg-slate-800/60 border-slate-600/50">
            <CardHeader>
              <h2 className="text-lg font-bold text-white">שחקנים שהבאת</h2>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-slate-300">
                {report.referredList.map((u) => (
                  <li key={u.id}>{u.username} {u.phone && `(${u.phone})`}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
