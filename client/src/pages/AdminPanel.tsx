import { useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Loader2,
  Home,
  Check,
  X,
  DollarSign,
  FileText,
  Trophy,
  Coins,
  Settings,
  Lock,
  LogOut,
  Search,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import { useLocation } from "wouter";

type AdminSection = "submissions" | "matches" | "leaderboard" | "finance" | "agents" | "players" | "settings";

export default function AdminPanel() {
  const { user, logout } = useAuth();
  const [, setLocation] = useLocation();
  const [section, setSection] = useState<AdminSection>("submissions");
  const [adminCode, setAdminCode] = useState("");
  const [codeError, setCodeError] = useState(false);
  const [searchSubmissions, setSearchSubmissions] = useState("");
  const [editMatch, setEditMatch] = useState<{ id: number; home: number; away: number } | null>(null);

  const { data: status, isLoading: statusLoading } = trpc.admin.getStatus.useQuery(undefined, {
    retry: false,
  });
  const verifyCodeMut = trpc.admin.verifyCode.useMutation();

  const { data: users } = trpc.admin.getUsers.useQuery(undefined, {
    enabled: !!status?.verified || !status?.codeRequired,
  });
  const { data: submissions, refetch: refetchSubs } = trpc.admin.getAllSubmissions.useQuery(undefined, {
    enabled: !!status?.verified || !status?.codeRequired,
  });
  const { data: matches } = trpc.matches.getAll.useQuery(undefined, {
    enabled: !!status?.verified || !status?.codeRequired,
  });
  const { data: tournaments } = trpc.tournaments.getAll.useQuery(undefined, {
    enabled: !!status?.verified || !status?.codeRequired,
  });
  const { data: transparency } = trpc.transparency.getSummary.useQuery(undefined, {
    enabled: (!!status?.verified || !status?.codeRequired) && section === "finance",
  });
  const { data: agents, refetch: refetchAgents } = trpc.admin.getAgents.useQuery(undefined, {
    enabled: (!!status?.verified || !status?.codeRequired) && section === "agents",
  });
  const { data: agentReports } = trpc.admin.getAgentReport.useQuery({}, {
    enabled: (!!status?.verified || !status?.codeRequired) && section === "agents",
  });
  const { data: playersData } = trpc.admin.getPlayers.useQuery(undefined, {
    enabled: (!!status?.verified || !status?.codeRequired) && section === "players",
  });
  const players = playersData?.players ?? [];
  const totalUsers = playersData?.totalUsers ?? 0;

  const approveMut = trpc.admin.approveSubmission.useMutation();
  const rejectMut = trpc.admin.rejectSubmission.useMutation();
  const paymentMut = trpc.admin.markPayment.useMutation();
  const deleteMut = trpc.admin.deleteSubmission.useMutation();
  const resultMut = trpc.admin.updateMatchResult.useMutation();
  const lockMut = trpc.admin.lockTournament.useMutation();
  const createTournamentMut = trpc.admin.createTournament.useMutation();
  const deleteTournamentMut = trpc.admin.deleteTournament.useMutation();
  const createAgentMut = trpc.admin.createAgent.useMutation();
  const deleteUserMut = trpc.admin.deleteUser.useMutation();
  const utils = trpc.useUtils();

  const [agentForm, setAgentForm] = useState({ username: "", phone: "", password: "", name: "" });
  const [newTournament, setNewTournament] = useState({ name: "", amount: "" });

  const filteredSubmissions = useMemo(() => {
    if (!submissions) return [];
    const q = searchSubmissions.trim().toLowerCase();
    if (!q) return submissions;
    return submissions.filter(
      (s) =>
        s.username.toLowerCase().includes(q) ||
        String(s.tournamentId).includes(q) ||
        String(s.id).includes(q)
    );
  }, [submissions, searchSubmissions]);

  const pendingSubmissionsCount = (submissions ?? []).filter((s) => s.status === "pending").length;

  if (!user || user.role !== "admin") {
    setLocation("/");
    return null;
  }

  const codeRequired = status?.codeRequired && !status?.verified;
  const showCodeForm = status && codeRequired;

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setCodeError(false);
    try {
      await verifyCodeMut.mutateAsync({ code: adminCode });
      toast.success("אושר – נכנסת ללוח הניהול");
      await utils.admin.getStatus.invalidate();
    } catch {
      setCodeError(true);
      toast.error("גישה אסורה – אין הרשאות");
    }
  };

  if (statusLoading || (status?.codeRequired && status?.verified === undefined)) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-amber-500" />
      </div>
    );
  }

  if (showCodeForm) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-slate-800 border-slate-700">
          <CardHeader>
            <h1 className="text-xl font-bold text-white text-center">גישה ללוח ניהול</h1>
            <p className="text-slate-400 text-center text-sm">הזן קוד מנהל סודי</p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleVerifyCode} className="space-y-4">
              <Input
                type="password"
                placeholder="קוד מנהל"
                value={adminCode}
                onChange={(e) => {
                  setAdminCode(e.target.value);
                  setCodeError(false);
                }}
                className="bg-slate-900 border-slate-600 text-white text-center"
                autoFocus
                autoComplete="off"
              />
              {codeError && (
                <p className="text-red-400 text-sm text-center">גישה אסורה – אין הרשאות</p>
              )}
              <Button type="submit" className="w-full bg-amber-600 hover:bg-amber-700" disabled={verifyCodeMut.isPending}>
                {verifyCodeMut.isPending ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "כניסה"}
              </Button>
            </form>
            <Button variant="ghost" className="w-full mt-4 text-slate-400" onClick={() => setLocation("/")}>
              <Home className="w-4 h-4 ml-2" />
              חזרה לדף הבית
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleApprove = async (id: number) => {
    try {
      await approveMut.mutateAsync({ id });
      toast.success("אושר – הטופס נספר בקופה ובחישוב העמלה");
      refetchSubs();
      await utils.transparency.getSummary.invalidate();
    } catch {
      toast.error("שגיאה");
    }
  };

  const handleReject = async (id: number) => {
    try {
      await rejectMut.mutateAsync({ id });
      toast.success("נדחה");
      refetchSubs();
    } catch {
      toast.error("שגיאה");
    }
  };

  const handleDelete = async (id: number, username: string) => {
    if (!window.confirm(`למחוק את הטופס של ${username}? פעולה זו לא ניתנת לביטול.`)) return;
    try {
      await deleteMut.mutateAsync({ id });
      toast.success("הטופס נמחק");
      refetchSubs();
      await utils.transparency.getSummary.invalidate();
    } catch {
      toast.error("שגיאה במחיקה");
    }
  };

  const handlePayment = async (id: number, statusPayment: "pending" | "completed" | "failed") => {
    try {
      await paymentMut.mutateAsync({ id, status: statusPayment });
      toast.success("עודכן");
      refetchSubs();
      await utils.transparency.getSummary.invalidate();
    } catch {
      toast.error("שגיאה");
    }
  };

  const handleSaveResult = async () => {
    if (!editMatch) return;
    try {
      await resultMut.mutateAsync({
        matchId: editMatch.id,
        homeScore: editMatch.home,
        awayScore: editMatch.away,
      });
      toast.success("תוצאה עודכנה, ניקוד חושב מחדש");
      setEditMatch(null);
      refetchSubs();
    } catch {
      toast.error("שגיאה");
    }
  };

  const handleLock = async (tid: number, locked: boolean) => {
    try {
      await lockMut.mutateAsync({ tournamentId: tid, isLocked: locked });
      toast.success(locked ? "נעול" : "נפתח");
      await utils.tournaments.getAll.invalidate();
    } catch {
      toast.error("שגיאה");
    }
  };

  const handleCreateTournament = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseInt(newTournament.amount, 10);
    if (!newTournament.name.trim() || isNaN(amount) || amount < 1) {
      toast.error("הזן שם וסכום תקין");
      return;
    }
    try {
      await createTournamentMut.mutateAsync({ name: newTournament.name.trim(), amount });
      toast.success("טורניר נוצר ויופיע בדף הראשי");
      setNewTournament({ name: "", amount: "" });
      await utils.tournaments.getAll.invalidate();
    } catch (err: unknown) {
      const msg = err && typeof err === "object" && "message" in err ? String((err as { message: string }).message) : "שגיאה";
      toast.error(msg.includes("UNIQUE") ? "כבר קיים טורניר עם סכום זה" : "שגיאה ביצירת טורניר");
    }
  };

  const handleDeleteTournament = async (id: number, name: string) => {
    if (!confirm(`למחוק את התחרות "${name}"? לא ניתן לשחזר.`)) return;
    try {
      await deleteTournamentMut.mutateAsync({ id });
      toast.success("התחרות נמחקה");
      await utils.tournaments.getAll.invalidate();
    } catch {
      toast.error("שגיאה במחיקה");
    }
  };

  const handleDeleteUser = async (id: number, label: string, isAgent: boolean) => {
    if (!confirm(`למחוק את ${label}? ${isAgent ? "שחקנים שקשורים לסוכן יישארו רשומים אך ללא סוכן." : "כל הטפסים של השחקן יימחקו."} לא ניתן לשחזר.`)) return;
    try {
      await deleteUserMut.mutateAsync({ id });
      toast.success("נמחק בהצלחה");
      await utils.admin.getPlayers.invalidate();
      await utils.admin.getAgents.invalidate();
      await utils.admin.getAgentReport.invalidate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "שגיאה במחיקה");
    }
  };

  const navItems: { id: AdminSection; label: string; icon: React.ReactNode }[] = [
    { id: "submissions", label: "טפסים", icon: <FileText className="w-5 h-5" /> },
    { id: "matches", label: "משחקים", icon: <Trophy className="w-5 h-5" /> },
    { id: "leaderboard", label: "דירוגים", icon: <Trophy className="w-5 h-5" /> },
    { id: "finance", label: "כספים", icon: <Coins className="w-5 h-5" /> },
    { id: "agents", label: "סוכנים", icon: <Users className="w-5 h-5" /> },
    { id: "players", label: "כל השחקנים", icon: <UserPlus className="w-5 h-5" /> },
    { id: "settings", label: "הגדרות", icon: <Settings className="w-5 h-5" /> },
  ];

  return (
    <div className="min-h-screen bg-slate-950 flex">
      {/* Sidebar */}
      <aside className="w-56 bg-slate-900 border-l border-slate-800 flex flex-col">
        <div className="p-4 border-b border-slate-800">
          <h2 className="font-bold text-white flex items-center gap-2">
            <Lock className="w-5 h-5 text-amber-400" />
            ניהול
          </h2>
        </div>
        <nav className="p-2 flex-1">
          {navItems.map((item) => {
            const isSubmissions = item.id === "submissions";
            const badge = isSubmissions && pendingSubmissionsCount > 0;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setSection(item.id)}
                className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-right transition-colors ${
                  section === item.id ? "bg-amber-600 text-white" : "text-slate-400 hover:bg-slate-800 hover:text-white"
                }`}
              >
                <span className="flex items-center gap-2">
                  {item.icon}
                  {item.label}
                </span>
                {badge && (
                  <span className="flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full bg-red-500 text-white text-xs font-bold">
                    {pendingSubmissionsCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
        <div className="p-2 border-t border-slate-800 space-y-1">
          <Button variant="ghost" size="sm" className="w-full justify-start text-slate-400" onClick={() => setLocation("/")}>
            <Home className="w-4 h-4 ml-2" />
            דף הבית
          </Button>
          <Button variant="ghost" size="sm" className="w-full justify-start text-slate-400" onClick={() => logout()}>
            <LogOut className="w-4 h-4 ml-2" />
            יציאה
          </Button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto p-6">
        {section === "submissions" && (
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <h2 className="text-xl font-bold text-white">כל הטפסים</h2>
              <div className="relative w-48">
                <Search className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <Input
                  placeholder="חיפוש..."
                  value={searchSubmissions}
                  onChange={(e) => setSearchSubmissions(e.target.value)}
                  className="pr-8 bg-slate-900 border-slate-600 text-white"
                />
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-[70vh] overflow-y-auto">
                {filteredSubmissions.map((s) => (
                  <div
                    key={s.id}
                    className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-lg bg-slate-700/30 hover:bg-slate-700/50 transition-colors"
                  >
                    <div>
                      <span className="text-white font-medium">{s.username}</span>
                      <span className="text-slate-400 text-sm mr-2">
                        טורניר #{s.tournamentId} • {s.points} נקודות
                      </span>
                      <Badge
                        variant={s.status === "approved" ? "default" : s.status === "rejected" ? "destructive" : "secondary"}
                        className="mr-2"
                      >
                        {s.status === "approved" ? "אושר" : s.status === "rejected" ? "נדחה" : "ממתין"}
                      </Badge>
                      <Badge variant="outline" className="text-slate-400">
                        {s.paymentStatus === "completed" ? "שולם" : s.paymentStatus}
                      </Badge>
                    </div>
                    {s.status === "pending" && (
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => handleApprove(s.id)} className="bg-emerald-600">
                          <Check className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => handleReject(s.id)}>
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant={s.paymentStatus === "completed" ? "default" : "outline"}
                        onClick={() => handlePayment(s.id, "completed")}
                      >
                        <DollarSign className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-red-400 border-red-500/50 hover:bg-red-500/20"
                        onClick={() => handleDelete(s.id, s.username)}
                        title="מחיקת טופס"
                        disabled={deleteMut.isPending}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {section === "matches" && (
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <h2 className="text-xl font-bold text-white">עדכון תוצאות משחקים</h2>
              <p className="text-slate-400 text-sm">לאחר עדכון – ניקוד כל המשתתפים מחושב מחדש</p>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-[70vh] overflow-y-auto">
                {matches?.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between p-3 rounded bg-slate-700/30 hover:bg-slate-700/50 transition-colors"
                  >
                    <span className="text-white text-sm">
                      #{m.matchNumber} {m.homeTeam} vs {m.awayTeam}
                    </span>
                    {editMatch?.id === m.id ? (
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          min={0}
                          max={20}
                          value={editMatch?.home ?? 0}
                          onChange={(e) => setEditMatch((x) => (x ? { ...x, home: +e.target.value } : null))}
                          className="w-14 text-center"
                        />
                        <span className="text-slate-500">-</span>
                        <Input
                          type="number"
                          min={0}
                          max={20}
                          value={editMatch?.away ?? 0}
                          onChange={(e) => setEditMatch((x) => (x ? { ...x, away: +e.target.value } : null))}
                          className="w-14 text-center"
                        />
                        <Button size="sm" onClick={handleSaveResult}>
                          שמור
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setEditMatch(null)}>
                          ביטול
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-emerald-400">
                          {m.homeScore != null && m.awayScore != null ? `${m.homeScore}-${m.awayScore}` : "-"}
                        </span>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setEditMatch({
                              id: m.id,
                              home: m.homeScore ?? 0,
                              away: m.awayScore ?? 0,
                            })
                          }
                        >
                          ערוך
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {section === "leaderboard" && (
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <h2 className="text-xl font-bold text-white">דירוגים לפי טורניר</h2>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {tournaments?.map((t) => {
                  const list = (submissions ?? []).filter((s) => s.tournamentId === t.id && s.status === "approved");
                  const sorted = [...list].sort((a, b) => b.points - a.points).slice(0, 20);
                  return (
                    <div key={t.id}>
                      <h3 className="text-white font-medium mb-2">{t.name}</h3>
                      <div className="space-y-1 max-h-48 overflow-y-auto">
                        {sorted.map((s, i) => (
                          <div
                            key={s.id}
                            className="flex justify-between p-2 rounded bg-slate-700/30 text-sm"
                          >
                            <span className="text-white">#{i + 1} {s.username}</span>
                            <span className="text-emerald-400">{s.points} נקודות</span>
                          </div>
                        ))}
                        {sorted.length === 0 && <p className="text-slate-500 text-sm">אין דירוג</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {section === "finance" && (
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <h2 className="text-xl font-bold text-white">שקיפות כספית (צפייה)</h2>
              <p className="text-slate-400 text-sm">סכומים לפי טפסים מאושרים (אישור מנהל = נספר בקופה).</p>
            </CardHeader>
            <CardContent>
              {transparency && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-4 rounded-lg bg-slate-700/30">
                      <p className="text-slate-500 text-sm">סך תשלומים</p>
                      <p className="text-xl font-bold text-white">₪{transparency.totalAmount.toLocaleString("he-IL")}</p>
                    </div>
                    <div className="p-4 rounded-lg bg-slate-700/30">
                      <p className="text-slate-500 text-sm">עמלה 12.5%</p>
                      <p className="text-xl font-bold text-amber-400">₪{transparency.totalFee.toLocaleString("he-IL")}</p>
                    </div>
                    <div className="p-4 rounded-lg bg-slate-700/30">
                      <p className="text-slate-500 text-sm">קופת פרסים</p>
                      <p className="text-xl font-bold text-emerald-400">₪{transparency.totalPrizePool.toLocaleString("he-IL")}</p>
                    </div>
                    <div className="p-4 rounded-lg bg-slate-700/30">
                      <p className="text-slate-500 text-sm">טפסים מאושרים</p>
                      <p className="text-xl font-bold text-white">{transparency.totalParticipants}</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {transparency.byTournament.map((row) => (
                      <div key={row.tournamentId} className="flex justify-between p-3 rounded bg-slate-700/30 text-sm">
                        <span className="text-white">{row.name}</span>
                        <span className="text-slate-400">{row.participants} משתתפים • ₪{row.totalAmount} • פרסים: ₪{row.prizePool}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {section === "agents" && (
          <div className="space-y-6">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-amber-400" />
                  פתיחת סוכן חדש
                </h2>
                <p className="text-slate-400 text-sm">רק מנהל יכול לפתוח סוכן. לסוכן יופע קוד הפניה ייחודי (למשל A5) להעברת שחקנים.</p>
              </CardHeader>
              <CardContent>
                <form
                  className="flex flex-wrap gap-4 items-end"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    try {
                      await createAgentMut.mutateAsync(agentForm);
                      toast.success("הסוכן נוצר. קוד ההפניה מוצג ברשימה.");
                      setAgentForm({ username: "", phone: "", password: "", name: "" });
                      refetchAgents();
                      utils.admin.getAgentReport.invalidate();
                    } catch (err: unknown) {
                      toast.error(err instanceof Error ? err.message : "שגיאה ביצירת סוכן");
                    }
                  }}
                >
                  <Input
                    placeholder="שם משתמש"
                    value={agentForm.username}
                    onChange={(e) => setAgentForm((p) => ({ ...p, username: e.target.value }))}
                    className="bg-slate-900 border-slate-600 text-white w-40"
                    required
                  />
                  <Input
                    type="tel"
                    placeholder="מספר טלפון (חובה)"
                    value={agentForm.phone}
                    onChange={(e) => setAgentForm((p) => ({ ...p, phone: e.target.value }))}
                    className="bg-slate-900 border-slate-600 text-white w-48"
                    required
                  />
                  <Input
                    type="password"
                    placeholder="סיסמה (לפחות 6)"
                    value={agentForm.password}
                    onChange={(e) => setAgentForm((p) => ({ ...p, password: e.target.value }))}
                    className="bg-slate-900 border-slate-600 text-white w-40"
                    minLength={6}
                    required
                  />
                  <Input
                    placeholder="שם (אופציונלי)"
                    value={agentForm.name}
                    onChange={(e) => setAgentForm((p) => ({ ...p, name: e.target.value }))}
                    className="bg-slate-900 border-slate-600 text-white w-40"
                  />
                  <Button type="submit" disabled={createAgentMut.isPending} className="bg-amber-600 hover:bg-amber-700">
                    {createAgentMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "צור סוכן"}
                  </Button>
                </form>
              </CardContent>
            </Card>
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <h2 className="text-xl font-bold text-white">סוכנים ודוחות</h2>
                <p className="text-slate-400 text-sm">עמלה מלאה 12.5% לאתר, סוכן מקבל 50% מתוך ה-12.5%.</p>
              </CardHeader>
              <CardContent>
                {agentReports && agentReports.length > 0 && (
                  <div className="mb-6 p-4 rounded-lg bg-slate-900/80 border border-amber-500/30">
                    <h3 className="text-sm font-medium text-amber-400 mb-3">סיכום מכל הסוכנים</h3>
                    <div className="flex flex-wrap gap-6 text-sm">
                      <span className="text-slate-300">
                        סכום כולל שנכנס דרך סוכנים: <strong className="text-white">₪{agentReports.reduce((s, r) => s + r.totalEntryAmount, 0).toLocaleString("he-IL")}</strong>
                      </span>
                      <span className="text-slate-300">
                        עמלה לאתר (12.5%): <strong className="text-amber-400">₪{agentReports.reduce((s, r) => s + Math.round(r.totalEntryAmount * 0.125), 0).toLocaleString("he-IL")}</strong>
                      </span>
                      <span className="text-slate-300">
                        עמלה לסוכנים (50% מ-12.5%): <strong className="text-emerald-400">₪{agentReports.reduce((s, r) => s + r.totalCommission, 0).toLocaleString("he-IL")}</strong>
                      </span>
                    </div>
                  </div>
                )}
                <div className="space-y-4">
                  {agentReports?.map((r) => {
                    const siteFee = Math.round(r.totalEntryAmount * 0.125);
                    return (
                      <div key={r.agentId} className="p-4 rounded-lg bg-slate-700/30 border border-slate-600/50">
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                          <span className="text-white font-medium">{r.username ?? `סוכן #${r.agentId}`}</span>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="font-mono text-amber-400 border-amber-500/50">
                              קוד: {r.referralCode ?? "—"}
                            </Badge>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-red-400 border-red-400/50 hover:bg-red-500/20"
                              onClick={() => handleDeleteUser(r.agentId, r.username ?? `סוכן #${r.agentId}`, true)}
                              disabled={deleteUserMut.isPending}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                          <div>
                            <p className="text-slate-500">שחקנים שהביא</p>
                            <p className="text-white font-medium">{r.referredUsers}</p>
                          </div>
                          <div>
                            <p className="text-slate-500">סכום כולל (תפוסים)</p>
                            <p className="text-white font-medium">₪{r.totalEntryAmount.toLocaleString("he-IL")}</p>
                          </div>
                          <div>
                            <p className="text-slate-500">עמלה לאתר (12.5%)</p>
                            <p className="text-amber-400 font-medium">₪{siteFee.toLocaleString("he-IL")}</p>
                          </div>
                          <div>
                            <p className="text-slate-500">עמלה לסוכן (50% מ-12.5%)</p>
                            <p className="text-emerald-400 font-bold">₪{r.totalCommission.toLocaleString("he-IL")}</p>
                          </div>
                        </div>
                        {r.commissions.length > 0 && (
                          <details className="mt-2">
                            <summary className="text-slate-500 cursor-pointer text-sm">היסטוריית עמלות</summary>
                            <ul className="mt-1 text-sm text-slate-400 space-y-1 pr-4">
                              {r.commissions.slice(0, 20).map((c) => (
                                <li key={c.submissionId}>
                                  טופס #{c.submissionId} • שחקן #{c.userId} • ₪{c.entryAmount} → עמלה ₪{c.commissionAmount}
                                </li>
                              ))}
                              {r.commissions.length > 20 && <li>... ועוד {r.commissions.length - 20}</li>}
                            </ul>
                          </details>
                        )}
                      </div>
                    );
                  })}
                  {agentReports?.length === 0 && (
                    <p className="text-slate-500 text-center py-6">אין עדיין סוכנים</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {section === "players" && (
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <h2 className="text-xl font-bold text-white">כל השחקנים הרשומים לאתר</h2>
              <p className="text-slate-400 text-sm">סה״כ {totalUsers} משתמשים באתר. שם, מספר טלפון, ודרך איזה סוכן נרשם (אם רלוונטי)</p>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-right">
                  <thead>
                    <tr className="border-b border-slate-600 text-slate-400 text-sm">
                      <th className="py-2 px-3 w-12">מס׳</th>
                      <th className="py-2 px-3">שם</th>
                      <th className="py-2 px-3">מספר טלפון</th>
                      <th className="py-2 px-3">סוכן (דרך מי נרשם)</th>
                      <th className="py-2 px-3 w-20">מחיקה</th>
                    </tr>
                  </thead>
                  <tbody>
                    {players?.map((p, index) => (
                      <tr key={p.id} className="border-b border-slate-700/50">
                        <td className="py-2 px-3 text-slate-500">{index + 1}</td>
                        <td className="py-2 px-3 text-white">{p.name || p.username || "—"}</td>
                        <td className="py-2 px-3 text-slate-300">{p.phone || "—"}</td>
                        <td className="py-2 px-3 text-amber-400">{p.agentUsername ? `סוכן: ${p.agentUsername}` : "—"}</td>
                        <td className="py-2 px-3">
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-red-400 border-red-400/50 hover:bg-red-500/20"
                            onClick={() => handleDeleteUser(p.id, p.name || p.username || `שחקן #${p.id}`, false)}
                            disabled={deleteUserMut.isPending}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {players.length === 0 && (
                <p className="text-slate-500 text-center py-6">אין שחקנים רשומים</p>
              )}
            </CardContent>
          </Card>
        )}

        {section === "settings" && (
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <h2 className="text-xl font-bold text-white">טורנירים והגדרות</h2>
              <p className="text-slate-400 text-sm">פתח טורניר חדש (יופיע בדף הראשי), נעל/פתח, או מחק תחרות</p>
            </CardHeader>
            <CardContent className="space-y-6">
              <form onSubmit={handleCreateTournament} className="flex flex-wrap gap-3 items-end p-3 rounded bg-slate-700/30">
                <div className="flex flex-col gap-1">
                  <label className="text-slate-400 text-sm">שם טורניר</label>
                  <Input
                    className="bg-slate-800 text-white w-40"
                    placeholder="טורניר 300"
                    value={newTournament.name}
                    onChange={(e) => setNewTournament((p) => ({ ...p, name: e.target.value }))}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-slate-400 text-sm">סכום (₪)</label>
                  <Input
                    type="number"
                    min={1}
                    className="bg-slate-800 text-white w-24"
                    placeholder="300"
                    value={newTournament.amount}
                    onChange={(e) => setNewTournament((p) => ({ ...p, amount: e.target.value }))}
                  />
                </div>
                <Button type="submit" size="sm" disabled={createTournamentMut.isPending}>
                  {createTournamentMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "פתח טורניר חדש"}
                </Button>
              </form>
              <div className="space-y-2">
                <h3 className="text-white font-medium">נעילת טורנירים / מחיקה</h3>
                {[...(tournaments ?? [])]
                  .sort((a, b) => a.amount - b.amount)
                  .map((t) => (
                  <div key={t.id} className="flex justify-between items-center gap-2 p-3 rounded bg-slate-700/30">
                    <span className="text-white">{t.name} – ₪{t.amount}</span>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant={t.isLocked ? "outline" : "default"}
                        onClick={() => handleLock(t.id, !t.isLocked)}
                      >
                        {t.isLocked ? "פתח" : "נעל"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-red-400 border-red-400/50 hover:bg-red-500/20"
                        onClick={() => handleDeleteTournament(t.id, t.name)}
                        disabled={deleteTournamentMut.isPending}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
