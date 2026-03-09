import { useState, useMemo, useEffect } from "react";
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
  Lock,
  LogOut,
  Search,
  Trash2,
  UserPlus,
  Users,
  Pencil,
  LayoutDashboard,
  Sparkles,
  Zap,
  Gem,
  ClipboardList,
  ArrowLeft,
  TrendingUp,
  FileDown,
  Menu,
} from "lucide-react";
import { useLocation } from "wouter";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

type AdminSection = "dashboard" | "autoFill" | "submissions" | "competitions" | "agents" | "players" | "pnl" | "admins";
type CompetitionSubType = "lotto" | "chance" | "mondial" | "football_custom" | null;

export default function AdminPanel() {
  const { user, logout } = useAuth();
  const [, setLocation] = useLocation();
  const [section, setSection] = useState<AdminSection>("dashboard");
  const [competitionSubType, setCompetitionSubType] = useState<CompetitionSubType>(null);
  const [adminCode, setAdminCode] = useState("");
  const [codeError, setCodeError] = useState(false);
  const [searchSubmissions, setSearchSubmissions] = useState("");
  const [submissionsTournamentId, setSubmissionsTournamentId] = useState<number | null>(null);
  const [editMatch, setEditMatch] = useState<{ id: number; home: number; away: number } | null>(null);
  const [editMatchTeams, setEditMatchTeams] = useState<{ id: number; homeTeam: string; awayTeam: string } | null>(null);

  const CHANCE_CARDS = ["7", "8", "9", "10", "J", "Q", "K", "A"] as const;
  const [chanceResultTournamentId, setChanceResultTournamentId] = useState<number | "">("");
  const [chanceDrawCodeInput, setChanceDrawCodeInput] = useState("");
  const [chanceResultForm, setChanceResultForm] = useState({
    heartCard: "" as "" | "7" | "8" | "9" | "10" | "J" | "Q" | "K" | "A",
    clubCard: "" as "" | "7" | "8" | "9" | "10" | "J" | "Q" | "K" | "A",
    diamondCard: "" as "" | "7" | "8" | "9" | "10" | "J" | "Q" | "K" | "A",
    spadeCard: "" as "" | "7" | "8" | "9" | "10" | "J" | "Q" | "K" | "A",
  });

  const [lottoResultTournamentId, setLottoResultTournamentId] = useState<number | "">("");
  const [lottoDrawCodeInput, setLottoDrawCodeInput] = useState("");
  const [lottoResultForm, setLottoResultForm] = useState({
    num1: "", num2: "", num3: "", num4: "", num5: "", num6: "",
    strongNumber: "",
  });

  const [footballCustomSelectedId, setFootballCustomSelectedId] = useState<number | "">("");
  const [footballCustomNewMatch, setFootballCustomNewMatch] = useState({ homeTeam: "", awayTeam: "", matchDate: "", matchTime: "" });
  const [footballCustomResultEdit, setFootballCustomResultEdit] = useState<Record<number, { homeScore: string; awayScore: string }>>({});

  const [pointsSelectedUserId, setPointsSelectedUserId] = useState<number | "">("");
  const [pointsDepositAmount, setPointsDepositAmount] = useState("");
  const [pointsWithdrawAmount, setPointsWithdrawAmount] = useState("");
  const [pointsDistributeTournamentId, setPointsDistributeTournamentId] = useState<number | "">("");
  const [prizeLogTournamentId, setPrizeLogTournamentId] = useState<number | null>(null);
  const [pointsLogAgentId, setPointsLogAgentId] = useState<number | "">("");
  const [pointsLogActionType, setPointsLogActionType] = useState("");
  const [pointsLogFrom, setPointsLogFrom] = useState("");
  const [pointsLogTo, setPointsLogTo] = useState("");
  const [pointsLogExporting, setPointsLogExporting] = useState(false);
  const [playerDepositAmount, setPlayerDepositAmount] = useState<Record<number, string>>({});
  const [playerWithdrawAmount, setPlayerWithdrawAmount] = useState<Record<number, string>>({});
  const [financialDetailTournamentId, setFinancialDetailTournamentId] = useState<number | null>(null);

  const [userPasswordResetId, setUserPasswordResetId] = useState<number | null>(null);
  const [userPasswordNew, setUserPasswordNew] = useState("");
  const [userPasswordConfirm, setUserPasswordConfirm] = useState("");
  const [pointsLogDeleteConfirmOpen, setPointsLogDeleteConfirmOpen] = useState(false);

  const [pnlFrom, setPnlFrom] = useState("");
  const [pnlTo, setPnlTo] = useState("");
  const [playersReportFrom, setPlayersReportFrom] = useState("");
  const [playersReportTo, setPlayersReportTo] = useState("");
  const [agentsReportFrom, setAgentsReportFrom] = useState("");
  const [agentsReportTo, setAgentsReportTo] = useState("");
  const [exportingPlayerId, setExportingPlayerId] = useState<number | null>(null);
  const [exportingAgentId, setExportingAgentId] = useState<number | null>(null);
  const [exportPlayerModalOpen, setExportPlayerModalOpen] = useState(false);
  const [exportPlayerUserId, setExportPlayerUserId] = useState<number | null>(null);
  const [exportPlayerUsername, setExportPlayerUsername] = useState<string>("");
  const [exportPlayerFrom, setExportPlayerFrom] = useState("");
  const [exportPlayerTo, setExportPlayerTo] = useState("");
  const [exportPlayerError, setExportPlayerError] = useState("");
  const [exportAgentModalOpen, setExportAgentModalOpen] = useState(false);
  const [exportAgentId, setExportAgentId] = useState<number | null>(null);
  const [exportAgentUsername, setExportAgentUsername] = useState<string>("");
  const [exportAgentFrom, setExportAgentFrom] = useState("");
  const [exportAgentTo, setExportAgentTo] = useState("");
  const [exportAgentError, setExportAgentError] = useState("");
  const [pnlTournamentType, setPnlTournamentType] = useState("");
  const [pnlFilterAgentId, setPnlFilterAgentId] = useState<number | "">("");
  const [pnlFilterPlayerId, setPnlFilterPlayerId] = useState<number | "">("");
  const [pnlDetailAgentId, setPnlDetailAgentId] = useState<number | null>(null);
  const [pnlDetailPlayerId, setPnlDetailPlayerId] = useState<number | null>(null);
  const [pnlExporting, setPnlExporting] = useState(false);
  const [pnlDetailedExporting, setPnlDetailedExporting] = useState(false);
  const [pnlDetailExporting, setPnlDetailExporting] = useState<"agent" | "player" | null>(null);

  const [assignAgentModalOpen, setAssignAgentModalOpen] = useState(false);
  const [assignAgentPlayerId, setAssignAgentPlayerId] = useState<number | null>(null);
  const [assignAgentPlayerName, setAssignAgentPlayerName] = useState("");
  const [assignAgentSelectedId, setAssignAgentSelectedId] = useState<number | "">("");

  const PNL_TOURNAMENT_TYPE_OPTIONS: { value: string; label: string }[] = [
    { value: "", label: "כל הסוגים" },
    { value: "football", label: "כדורגל" },
    { value: "lotto", label: "לוטו" },
    { value: "chance", label: "צ'אנס" },
    { value: "football_custom", label: "כדורגל מותאם" },
  ];

  const [autoFillTournamentId, setAutoFillTournamentId] = useState<number | "">("");
  const [autoFillCount, setAutoFillCount] = useState(50);
  const [autoFillResult, setAutoFillResult] = useState<{ created: number; usernames: string[]; tournamentId: number; leaderboardPath: string } | null>(null);

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
  const { data: financialReport } = trpc.admin.getFinancialReport.useQuery(undefined, {
    enabled: false,
  });
  const { data: financialDetailPrizeLogs } = trpc.admin.getPointsLogs.useQuery(
    { tournamentId: financialDetailTournamentId ?? undefined, limit: 200 },
    { enabled: false }
  );
  const { data: agents, refetch: refetchAgents } = trpc.admin.getAgents.useQuery(undefined, {
    enabled: (!!status?.verified || !status?.codeRequired) && (section === "agents" || section === "players" || section === "dashboard"),
  });
  const { data: agentReports } = trpc.admin.getAgentReport.useQuery({}, {
    enabled: (!!status?.verified || !status?.codeRequired) && section === "agents",
  });
  const { data: balanceSummary } = trpc.admin.getBalanceSummary.useQuery(undefined, {
    enabled: (!!status?.verified || !status?.codeRequired) && (section === "dashboard" || section === "agents"),
  });
  const { data: agentsWithBalances } = trpc.admin.getAgentsWithBalances.useQuery(undefined, {
    enabled: (!!status?.verified || !status?.codeRequired) && (section === "dashboard" || section === "agents"),
  });
  const { data: pnlSummary, isLoading: pnlSummaryLoading } = trpc.admin.getPnLSummary.useQuery(
    { from: pnlFrom || undefined, to: pnlTo || undefined, tournamentType: pnlTournamentType || undefined },
    { enabled: (!!status?.verified || !status?.codeRequired) && section === "pnl" }
  );
  const { data: pnlAgentDetail } = trpc.admin.getAgentPnL.useQuery(
    { agentId: pnlDetailAgentId!, from: pnlFrom || undefined, to: pnlTo || undefined, tournamentType: pnlTournamentType || undefined },
    { enabled: (!!status?.verified || !status?.codeRequired) && section === "pnl" && pnlDetailAgentId != null }
  );
  const { data: pnlPlayerDetail } = trpc.admin.getPlayerPnL.useQuery(
    { userId: pnlDetailPlayerId!, from: pnlFrom || undefined, to: pnlTo || undefined, tournamentType: pnlTournamentType || undefined },
    { enabled: (!!status?.verified || !status?.codeRequired) && section === "pnl" && pnlDetailPlayerId != null }
  );
  const { data: pnlReportRows, isLoading: pnlReportRowsLoading } = trpc.admin.getPnLReport.useQuery(
    {
      from: pnlFrom || undefined,
      to: pnlTo || undefined,
      tournamentType: pnlTournamentType || undefined,
      agentId: pnlFilterAgentId === "" ? undefined : pnlFilterAgentId,
      playerId: pnlFilterPlayerId === "" ? undefined : pnlFilterPlayerId,
      limit: 2000,
    },
    { enabled: (!!status?.verified || !status?.codeRequired) && section === "pnl" }
  );
  const { data: playersData } = trpc.admin.getPlayers.useQuery(undefined, {
    enabled: (!!status?.verified || !status?.codeRequired) && (section === "players" || section === "dashboard"),
  });
  const players = playersData?.players ?? [];
  const totalUsers = playersData?.totalUsers ?? 0;
  const [usersListRoleFilter, setUsersListRoleFilter] = useState<"all" | "user" | "agent" | "admin">("all");
  const { data: usersListData, refetch: refetchUsersList } = trpc.admin.getUsersList.useQuery(
    { role: usersListRoleFilter === "all" ? undefined : usersListRoleFilter },
    { enabled: (!!status?.verified || !status?.codeRequired) && section === "players" }
  );
  const usersList = usersListData ?? [];
  const setUserBlockedMut = trpc.admin.setUserBlocked.useMutation();
  const { data: pointsLogs, refetch: refetchPointsLogs } = trpc.admin.getPointsLogs.useQuery(
    {
      userId: pointsSelectedUserId === "" ? undefined : pointsSelectedUserId,
      limit: 200,
      from: pointsLogFrom || undefined,
      to: pointsLogTo || undefined,
      agentId: pointsLogAgentId === "" ? undefined : pointsLogAgentId,
      actionType: pointsLogActionType || undefined,
    },
    { enabled: (!!status?.verified || !status?.codeRequired) && section === "players" && prizeLogTournamentId == null }
  );
  const { data: prizeLogs } = trpc.admin.getPointsLogs.useQuery(
    { tournamentId: prizeLogTournamentId ?? undefined, limit: 200 },
    { enabled: (!!status?.verified || !status?.codeRequired) && section === "players" && prizeLogTournamentId != null }
  );
  const { data: customFootballMatches } = trpc.admin.getCustomFootballMatches.useQuery(
    { tournamentId: typeof footballCustomSelectedId === "number" ? footballCustomSelectedId : 0 },
    { enabled: section === "competitions" && competitionSubType === "football_custom" && typeof footballCustomSelectedId === "number" }
  );

  const approveMut = trpc.admin.approveSubmission.useMutation();
  const rejectMut = trpc.admin.rejectSubmission.useMutation();
  const paymentMut = trpc.admin.markPayment.useMutation();
  const deleteMut = trpc.admin.deleteSubmission.useMutation();
  const deleteAllSubmissionsMut = trpc.admin.deleteAllSubmissions.useMutation();
  const resultMut = trpc.admin.updateMatchResult.useMutation();
  const updateMatchMut = trpc.admin.updateMatch.useMutation();
  const lockMut = trpc.admin.lockTournament.useMutation();
  const createTournamentMut = trpc.admin.createTournament.useMutation();
  const deleteTournamentMut = trpc.admin.deleteTournament.useMutation();
  const createAgentMut = trpc.admin.createAgent.useMutation();
  const deleteUserMut = trpc.admin.deleteUser.useMutation();
  const createAutoSubmissionsMut = trpc.admin.createAutoSubmissions.useMutation();
  const depositPointsMut = trpc.admin.depositPoints.useMutation();
  const withdrawPointsMut = trpc.admin.withdrawPoints.useMutation();
  const distributePrizesMut = trpc.admin.distributePrizes.useMutation();
  const resetUserPasswordMut = trpc.admin.resetUserPassword.useMutation();
  const assignAgentMut = trpc.admin.assignAgent.useMutation({
    onSuccess: () => {
      refetchUsersList();
      utils.admin.getUsersList.invalidate();
      setAssignAgentModalOpen(false);
      setAssignAgentPlayerId(null);
      setAssignAgentPlayerName("");
      setAssignAgentSelectedId("");
      toast.success("השיוך עודכן");
    },
    onError: (e) => toast.error(e.message),
  });
  const deletePointsLogsHistoryMut = trpc.admin.deletePointsLogsHistory.useMutation();
  const utils = trpc.useUtils();

  const { data: adminsList, refetch: refetchAdmins } = trpc.admin.getAdmins.useQuery(undefined, {
    enabled: (!!status?.verified || !status?.codeRequired) && section === "admins" && !!user?.isSuperAdmin,
  });
  const { data: adminAuditLogs } = trpc.admin.getAdminAuditLogs.useQuery({ limit: 100 }, {
    enabled: (!!status?.verified || !status?.codeRequired) && section === "admins" && !!user?.isSuperAdmin,
  });
  const createAdminMut = trpc.admin.createAdmin.useMutation();
  const deleteAdminMut = trpc.admin.deleteAdmin.useMutation();
  const fullResetMut = trpc.admin.fullReset.useMutation({
    onSuccess: (data) => {
      toast.success(`ניקוי מלא בוצע. נשארו: ${(data as { keptAdminUsernames?: string[] }).keptAdminUsernames?.join(", ") ?? "—"}. נמחקו ${(data as { deletedUsers?: number }).deletedUsers ?? 0} משתמשים.`);
      setFullResetOpen(false);
      setFullResetPassword("");
      setFullResetConfirmPhrase("");
      utils.admin.getStatus.invalidate();
      window.location.reload();
    },
    onError: (e) => toast.error(e.message),
  });
  const updateAdminMut = trpc.admin.updateAdmin.useMutation();

  const chanceTournaments = useMemo(
    () => (tournaments ?? []).filter((t) => (t as { type?: string }).type === "chance"),
    [tournaments]
  );
  const { data: chanceDrawResult, refetch: refetchChanceDrawResult } = trpc.admin.getChanceDrawResult.useQuery(
    {
      tournamentId: typeof chanceResultTournamentId === "number" ? chanceResultTournamentId : undefined,
      drawCode: chanceDrawCodeInput.trim() || undefined,
    },
    { enabled: section === "competitions" && competitionSubType === "chance" && (typeof chanceResultTournamentId === "number" || !!chanceDrawCodeInput.trim()) }
  );
  const updateChanceResultsMut = trpc.admin.updateChanceResults.useMutation();
  const lockChanceDrawMut = trpc.admin.lockChanceDraw.useMutation();

  const lottoTournaments = useMemo(
    () => (tournaments ?? []).filter((t) => (t as { type?: string }).type === "lotto"),
    [tournaments]
  );
  const footballTournaments = useMemo(
    () => (tournaments ?? []).filter((t) => (t as { type?: string }).type === "football" || (t as { type?: string }).type === undefined),
    [tournaments]
  );
  const footballCustomTournaments = useMemo(
    () => (tournaments ?? []).filter((t) => (t as { type?: string }).type === "football_custom"),
    [tournaments]
  );
  const { data: lottoDrawResult, refetch: refetchLottoDrawResult } = trpc.admin.getLottoDrawResult.useQuery(
    {
      tournamentId: typeof lottoResultTournamentId === "number" ? lottoResultTournamentId : undefined,
      drawCode: lottoDrawCodeInput.trim() || undefined,
    },
    { enabled: section === "competitions" && competitionSubType === "lotto" && (typeof lottoResultTournamentId === "number" || !!lottoDrawCodeInput.trim()) }
  );
  const updateLottoResultsMut = trpc.admin.updateLottoResults.useMutation();
  const lockLottoDrawMut = trpc.admin.lockLottoDraw.useMutation();

  const { data: customFootballLeaderboard } = trpc.admin.getCustomFootballLeaderboard.useQuery(
    { tournamentId: typeof footballCustomSelectedId === "number" ? footballCustomSelectedId : 0 },
    { enabled: section === "competitions" && competitionSubType === "football_custom" && typeof footballCustomSelectedId === "number" }
  );
  const addCustomFootballMatchMut = trpc.admin.addCustomFootballMatch.useMutation();
  const updateCustomFootballMatchResultMut = trpc.admin.updateCustomFootballMatchResult.useMutation();
  const deleteCustomFootballMatchMut = trpc.admin.deleteCustomFootballMatch.useMutation();
  const recalcCustomFootballPointsMut = trpc.admin.recalcCustomFootballPoints.useMutation();

  const [agentForm, setAgentForm] = useState({ username: "", phone: "", password: "", name: "" });
  const [adminForm, setAdminForm] = useState({ username: "", password: "", name: "" });
  const [adminEditId, setAdminEditId] = useState<number | null>(null);
  const [adminEditPassword, setAdminEditPassword] = useState("");
  const [fullResetOpen, setFullResetOpen] = useState(false);
  const [fullResetPassword, setFullResetPassword] = useState("");
  const [fullResetConfirmPhrase, setFullResetConfirmPhrase] = useState("");
  const [newTournament, setNewTournament] = useState({
    name: "",
    amount: "",
    description: "",
    type: "football" as "football" | "lotto" | "chance" | "custom",
    startDate: "",
    endDate: "",
    maxParticipants: "",
    prizeMode: "first" as "first" | "top3" | "custom",
    prize1: "100",
    prize2: "30",
    prize3: "20",
    drawCode: "",
    drawDate: "",
    drawTime: "",
    customIdentifier: "",
    openDate: "",
    openTime: "",
    closeTime: "",
    closeDate: "",
  });

  const CHANCE_DRAW_TIMES = ["09:00", "11:00", "13:00", "15:00", "17:00", "19:00", "21:00"] as const;
  const LOTTO_DRAW_TIMES = ["20:00", "22:30", "23:00", "23:30", "00:00"] as const;

  const filteredSubmissions = useMemo(() => {
    if (!submissions) return [];
    let list = submissions;
    if (submissionsTournamentId != null) {
      list = list.filter((s) => s.tournamentId === submissionsTournamentId);
    }
    const q = searchSubmissions.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (s) =>
        s.username.toLowerCase().includes(q) ||
        String(s.tournamentId).includes(q) ||
        String(s.id).includes(q)
    );
  }, [submissions, searchSubmissions, submissionsTournamentId]);

  const submissionsCountByTournament = useMemo(() => {
    const map = new Map<number, number>();
    (submissions ?? []).forEach((s) => map.set(s.tournamentId, (map.get(s.tournamentId) ?? 0) + 1));
    return map;
  }, [submissions]);

  const tournamentsWithSubmissions = useMemo(() => {
    const ids = new Set((submissions ?? []).map((s) => s.tournamentId));
    return (tournaments ?? []).filter((t) => ids.has(t.id)).sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  }, [tournaments, submissions]);

  const pendingSubmissionsCount = (submissions ?? []).filter((s) => s.status === "pending").length;
  const activeTournamentsCount = (tournaments ?? []).filter(
    (t) => !(t as { isLocked?: boolean }).isLocked && (t as { resultsFinalizedAt?: unknown }).resultsFinalizedAt == null
  ).length;

  type DashboardCardRoute = AdminSection;
  const dashboardCards: Array<{
    id: string;
    title: string;
    description: string;
    icon: React.ReactNode;
    route: DashboardCardRoute;
    superAdminOnly?: boolean;
    status?: { text: string; color: "green" | "orange" | "red" | "slate" };
  }> = [
    {
      id: "competitions-new",
      title: "פתיחת תחרות חדשה",
      description: "פתיחת תחרות לוטו, צ'אנס, כדורגל או מונדיאל.",
      icon: <Trophy className="w-8 h-8 text-amber-400" />,
      route: "competitions" as DashboardCardRoute,
      status: activeTournamentsCount > 0 ? { text: `${activeTournamentsCount} תחרויות פעילות`, color: "green" as const } : { text: "אין תחרויות פעילות", color: "slate" as const },
    },
    {
      id: "competitions-manage",
      title: "ניהול תחרויות פעילות",
      description: "צפייה בתחרויות פתוחות, סגירה, עדכון תוצאות.",
      icon: <LayoutDashboard className="w-8 h-8 text-amber-400" />,
      route: "competitions" as DashboardCardRoute,
      status: { text: `${(tournaments ?? []).length} סה״כ`, color: "slate" as const },
    },
    {
      id: "submissions",
      title: "טפסים ממתינים לאישור",
      description: "צפייה בטפסים ללא מספיק נקודות, אישור או דחייה.",
      icon: <FileText className="w-8 h-8 text-amber-400" />,
      route: "submissions" as DashboardCardRoute,
      status: pendingSubmissionsCount > 0 ? { text: `${pendingSubmissionsCount} ממתינים`, color: "orange" as const } : { text: "אין ממתינים", color: "green" as const },
    },
    {
      id: "players",
      title: "ניהול משתמשים",
      description: "צפייה במשתמשים, ניהול נקודות, הפקדה ומשיכה.",
      icon: <UserPlus className="w-8 h-8 text-amber-400" />,
      route: "players" as DashboardCardRoute,
      status: { text: `${totalUsers} משתמשים`, color: "slate" as const },
    },
    {
      id: "agents",
      title: "סוכנים",
      description: "ניהול סוכנים, קודי הפניה ודוחות עמלות.",
      icon: <Users className="w-8 h-8 text-amber-400" />,
      route: "agents" as DashboardCardRoute,
    },
    {
      id: "autoFill",
      title: "מילוי אוטומטי",
      description: "יצירת טפסי ניחושים רנדומליים להצגת פעילות.",
      icon: <Zap className="w-8 h-8 text-amber-400" />,
      route: "autoFill" as DashboardCardRoute,
    },
    {
      id: "system-log",
      title: "לוג מערכת",
      description: "צפייה בכל פעולות מנהל וסופר מנהל.",
      icon: <ClipboardList className="w-8 h-8 text-amber-400" />,
      route: "admins" as DashboardCardRoute,
      superAdminOnly: true,
    },
    {
      id: "admins",
      title: "ניהול מנהלים",
      description: "יצירה, מחיקה ועדכון סיסמה – רק לסופר מנהל.",
      icon: <Lock className="w-8 h-8 text-amber-400" />,
      route: "admins" as DashboardCardRoute,
      superAdminOnly: true,
    },
  ].filter((card) => !card.superAdminOnly || user?.isSuperAdmin);

  const handleDashboardCardClick = (route: DashboardCardRoute) => {
    setSection(route);
  };

  useEffect(() => {
    if (section === "competitions" && competitionSubType === "chance" && chanceDrawResult && "tournamentId" in chanceDrawResult && chanceDrawCodeInput.trim()) {
      setChanceResultTournamentId((chanceDrawResult as { tournamentId: number }).tournamentId);
      setChanceDrawCodeInput("");
    }
  }, [section, chanceDrawResult, chanceDrawCodeInput]);

  useEffect(() => {
    if (section === "competitions" && competitionSubType === "lotto" && lottoDrawResult && "tournamentId" in lottoDrawResult && lottoDrawCodeInput.trim()) {
      setLottoResultTournamentId((lottoDrawResult as { tournamentId: number }).tournamentId);
      setLottoDrawCodeInput("");
    }
  }, [section, lottoDrawResult, lottoDrawCodeInput]);

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
    } catch {
      toast.error("שגיאה במחיקה");
    }
  };

  const handlePayment = async (id: number, statusPayment: "pending" | "completed" | "failed") => {
    try {
      await paymentMut.mutateAsync({ id, status: statusPayment });
      toast.success("עודכן");
      refetchSubs();
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

  const handleSaveMatchTeams = async () => {
    if (!editMatchTeams) return;
    const { id, homeTeam, awayTeam } = editMatchTeams;
    if (!homeTeam.trim() || !awayTeam.trim()) {
      toast.error("יש להזין שם לקבוצה ביתית ולקבוצה אורחת");
      return;
    }
    try {
      await updateMatchMut.mutateAsync({ matchId: id, homeTeam: homeTeam.trim(), awayTeam: awayTeam.trim() });
      toast.success("שמות הקבוצות עודכנו");
      setEditMatchTeams(null);
      await utils.matches.getAll.invalidate();
    } catch {
      toast.error("שגיאה בעדכון");
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

  const handleCreateTournament = async (e: React.FormEvent, typeOverride?: "football" | "football_custom" | "lotto" | "chance" | "custom") => {
    e.preventDefault();
    const amount = parseInt(newTournament.amount, 10);
    if (!newTournament.name.trim() || isNaN(amount) || amount < 1) {
      toast.error("הזן שם וסכום תקין");
      return;
    }
    const tournamentType = typeOverride ?? newTournament.type;
    if (tournamentType === "lotto" && !newTournament.drawCode?.trim()) {
      toast.error("בתחרות לוטו חובה להזין מזהה תחרות (לעדכון תוצאות בהמשך)");
      return;
    }
    if (tournamentType === "lotto" && (!newTournament.drawDate?.trim() || !newTournament.drawTime?.trim())) {
      toast.error("בתחרות לוטו חובה לבחור תאריך ושעת סגירת ההגרלה");
      return;
    }
    if (tournamentType === "chance" && (!newTournament.drawDate?.trim() || !newTournament.drawTime?.trim())) {
      toast.error("בתחרות צ'אנס חובה לבחור תאריך ושעת הגרלה");
      return;
    }
    if ((tournamentType === "football" || tournamentType === "football_custom") && (!newTournament.openDate?.trim() || !newTournament.openTime?.trim() || !newTournament.closeDate?.trim() || !newTournament.closeTime?.trim())) {
      toast.error("בתחרות מונדיאל/כדורגל חובה לבחור תאריך פתיחה, שעת פתיחה, תאריך סגירה ושעת סגירה");
      return;
    }
    let prizeDistribution: Record<string, number> | null = null;
    if (newTournament.prizeMode === "first") {
      prizeDistribution = { "1": 100 };
    } else if (newTournament.prizeMode === "top3") {
      const p1 = parseInt(newTournament.prize1, 10) || 50;
      const p2 = parseInt(newTournament.prize2, 10) || 30;
      const p3 = parseInt(newTournament.prize3, 10) || 20;
      prizeDistribution = { "1": p1, "2": p2, "3": p3 };
    }
    function dateTimeToTimestamp(dateStr: string, timeStr: string): number | null {
    if (!dateStr?.trim() || !timeStr?.trim()) return null;
    const s = dateStr.trim() + "T" + timeStr.trim() + ":00+02:00";
    const t = new Date(s).getTime();
    return Number.isNaN(t) ? null : t;
  }
  const buildOpensClosesMondial = (openDate: string, openTime: string, closeDate: string, closeTime: string): { opensAt: number; closesAt: number } | null => {
    const opensAt = dateTimeToTimestamp(openDate, openTime);
    const closesAt = dateTimeToTimestamp(closeDate, closeTime);
    if (opensAt == null || closesAt == null) return null;
    return { opensAt, closesAt };
  };

    try {
      await createTournamentMut.mutateAsync({
        name: newTournament.name.trim(),
        amount,
        description: newTournament.description.trim() || undefined,
        type: tournamentType,
        startDate: newTournament.startDate.trim() || undefined,
        endDate: newTournament.endDate.trim() || undefined,
        maxParticipants: newTournament.maxParticipants ? parseInt(newTournament.maxParticipants, 10) : null,
        prizeDistribution,
        drawCode: tournamentType === "lotto" ? newTournament.drawCode.trim() : undefined,
        drawDate: tournamentType === "chance" || tournamentType === "lotto" ? newTournament.drawDate.trim() : undefined,
        drawTime: tournamentType === "chance" || tournamentType === "lotto" ? newTournament.drawTime.trim() : undefined,
        customIdentifier: newTournament.customIdentifier?.trim() || undefined,
        ...((tournamentType === "football" || tournamentType === "football_custom") && (() => {
          const built = buildOpensClosesMondial(
            newTournament.openDate,
            newTournament.openTime,
            newTournament.closeDate,
            newTournament.closeTime
          );
          return built ? { opensAt: built.opensAt, closesAt: built.closesAt } : {};
        })()),
      });
      toast.success("תחרות נוצרה ויופיע בדף הראשי");
      setNewTournament({
        name: "",
        amount: "",
        description: "",
        type: "football",
        startDate: "",
        endDate: "",
        maxParticipants: "",
        prizeMode: "first",
        prize1: "100",
        prize2: "30",
        prize3: "20",
        drawCode: "",
        drawDate: "",
        drawTime: "",
        customIdentifier: "",
        openDate: "",
        openTime: "",
        closeTime: "",
        closeDate: "",
      });
      await utils.tournaments.getAll.invalidate();
    } catch (err: unknown) {
      const msg = err && typeof err === "object" && "message" in err ? String((err as { message: string }).message) : "שגיאה";
      toast.error(msg);
    }
  };

  const handleDeleteTournament = async (id: number, name: string) => {
    const displayName = name || `#${id}`;
    if (!confirm(`למחוק את התחרות "${displayName}"? הנקודות של משתתפים שאושרו יוחזרו אוטומטית.`)) return;
    try {
      const res = await deleteTournamentMut.mutateAsync({ id });
      const msg = res.refundedCount != null && res.refundedCount > 0
        ? `התחרות נמחקה. הוחזרו ${res.totalRefunded} נקודות ל־${res.refundedCount} משתתפים.`
        : "התחרות נמחקה";
      toast.success(msg);
      await utils.tournaments.getAll.invalidate();
    } catch {
      toast.error("שגיאה במחיקה");
    }
  };

  const handleDeleteUser = async (id: number, label: string, isAgent: boolean) => {
    if (!confirm(`למחוק את ${label}? ${isAgent ? "הסוכן יסומן כמחוק (מחיקה רכה). שחקנים ונתוני כספים יישארו." : "כל הטפסים של השחקן יימחקו. לא ניתן לשחזר."}`)) return;
    try {
      await deleteUserMut.mutateAsync({ id });
      toast.success(isAgent ? "הסוכן סומן כמחוק" : "נמחק בהצלחה");
      await utils.admin.getPlayers.invalidate();
      await utils.admin.getUsersList.invalidate();
      await utils.admin.getAgents.invalidate();
      await utils.admin.getAgentReport.invalidate();
      refetchUsersList();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "שגיאה במחיקה");
    }
  };

  const navItems: { id: AdminSection; label: string; icon: React.ReactNode }[] = [
    { id: "dashboard", label: "דשבורד", icon: <LayoutDashboard className="w-5 h-5" /> },
    ...(user?.isSuperAdmin ? [{ id: "admins" as const, label: "ניהול מנהלים", icon: <Lock className="w-5 h-5" /> }] : []),
    { id: "agents", label: "סוכנים", icon: <Users className="w-5 h-5" /> },
    { id: "pnl", label: "דוח רווח והפסד", icon: <TrendingUp className="w-5 h-5" /> },
    { id: "players", label: "שחקנים", icon: <UserPlus className="w-5 h-5" /> },
    { id: "competitions", label: "פתיחת תחרות חדשה", icon: <Trophy className="w-5 h-5" /> },
    { id: "autoFill", label: "מילוי אוטומטי", icon: <Zap className="w-5 h-5" /> },
    { id: "submissions", label: "טפסים", icon: <FileText className="w-5 h-5" /> },
  ];

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col md:flex-row">
      {/* Mobile: sticky header + nav sheet */}
      <div className="md:hidden sticky top-0 z-40 flex items-center justify-between gap-2 px-4 py-3 bg-slate-900/95 border-b border-slate-800 backdrop-blur">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="text-slate-300 hover:text-white hover:bg-slate-800 shrink-0 min-h-[44px] min-w-[44px]">
              <Menu className="w-6 h-6" aria-hidden />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-[min(100vw-2rem,280px)] bg-slate-900 border-slate-700 p-0">
            <div className="p-4 border-b border-slate-800">
              <h2 className="font-bold text-white flex items-center gap-2">
                <Lock className="w-5 h-5 text-amber-400" />
                ניהול
              </h2>
            </div>
            <nav className="p-2 flex-1 overflow-auto">
              {navItems.map((item) => {
                const isSubmissions = item.id === "submissions";
                const badge = isSubmissions && pendingSubmissionsCount > 0;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      if (item.id === "competitions") { setSection("competitions"); setCompetitionSubType(null); }
                      else setSection(item.id);
                    }}
                    className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg text-right transition-colors min-h-[44px] ${
                      section === item.id || (item.id === "competitions" && section === "competitions") ? "bg-amber-600 text-white" : "text-slate-400 hover:bg-slate-800 hover:text-white"
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
              <Button variant="ghost" size="sm" className="w-full justify-start text-slate-400 min-h-[44px]" onClick={() => setLocation("/")}>
                <Home className="w-4 h-4 ml-2" />
                דף הבית
              </Button>
              <Button variant="ghost" size="sm" className="w-full justify-start text-slate-400 min-h-[44px]" onClick={() => logout()}>
                <LogOut className="w-4 h-4 ml-2" />
                יציאה
              </Button>
            </div>
          </SheetContent>
        </Sheet>
        <h1 className="text-lg font-bold text-white truncate flex-1 text-center">
          {section === "dashboard" ? "דשבורד ניהול" : navItems.find((i) => i.id === section)?.label ?? "ניהול"}
        </h1>
        <div className="w-10 shrink-0" aria-hidden />
      </div>

      {/* Sidebar – desktop only */}
      <aside className="hidden md:flex w-56 flex-col bg-slate-900 border-l border-slate-800 shrink-0">
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
                onClick={() => {
                  if (item.id === "competitions") { setSection("competitions"); setCompetitionSubType(null); }
                  else setSection(item.id);
                }}
                className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-right transition-colors ${
                  section === item.id || (item.id === "competitions" && section === "competitions") ? "bg-amber-600 text-white" : "text-slate-400 hover:bg-slate-800 hover:text-white"
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
      <main className="flex-1 overflow-auto min-w-0 flex flex-col">
        <div className="p-4 md:p-6 space-y-6 max-w-full">
        {section === "dashboard" && (
          <div className="space-y-6">
            <h2 className="text-xl md:text-2xl font-bold text-white flex items-center gap-2">
              <LayoutDashboard className="w-6 h-6 md:w-8 md:h-8 text-amber-400 shrink-0" />
              דשבורד ניהול
            </h2>

            {/* סיכום עליון – מבט מהיר */}
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide">סיכום מערכת</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                <Card className="bg-slate-800/60 border-slate-700/80 rounded-xl shadow-sm">
                  <CardContent className="p-4">
                    <p className="text-slate-400 text-xs md:text-sm">משתמשים</p>
                    <p className="text-xl md:text-2xl font-bold text-white tabular-nums mt-0.5">{totalUsers}</p>
                  </CardContent>
                </Card>
                <Card className="bg-slate-800/60 border-slate-700/80 rounded-xl shadow-sm">
                  <CardContent className="p-4">
                    <p className="text-slate-400 text-xs md:text-sm">סוכנים</p>
                    <p className="text-xl md:text-2xl font-bold text-white tabular-nums mt-0.5">{agents?.length ?? 0}</p>
                  </CardContent>
                </Card>
                <Card className="bg-slate-800/60 border-slate-700/80 rounded-xl shadow-sm">
                  <CardContent className="p-4">
                    <p className="text-slate-400 text-xs md:text-sm">תחרויות פעילות</p>
                    <p className="text-xl md:text-2xl font-bold text-emerald-400 tabular-nums mt-0.5">{activeTournamentsCount}</p>
                  </CardContent>
                </Card>
                <Card className="bg-slate-800/60 border-slate-700/80 rounded-xl shadow-sm">
                  <CardContent className="p-4">
                    <p className="text-slate-400 text-xs md:text-sm">נקודות במערכת</p>
                    <p className="text-xl md:text-2xl font-bold text-amber-400 tabular-nums mt-0.5">
                      {(balanceSummary?.totalPlayersBalance ?? 0) + (balanceSummary?.totalAgentsBalance ?? 0)}
                    </p>
                  </CardContent>
                </Card>
              </div>
              {balanceSummary != null && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Card className="bg-slate-800/50 border-slate-700 border-amber-500/20 rounded-xl">
                    <CardContent className="p-3 md:p-4">
                      <p className="text-slate-500 text-xs">מאזן שחקנים</p>
                      <p className="text-lg font-bold text-amber-400 tabular-nums">{balanceSummary.totalPlayersBalance ?? 0} נקודות</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-slate-800/50 border-slate-700 border-emerald-500/20 rounded-xl">
                    <CardContent className="p-3 md:p-4">
                      <p className="text-slate-500 text-xs">מאזן סוכנים</p>
                      <p className="text-lg font-bold text-emerald-400 tabular-nums">{balanceSummary.totalAgentsBalance ?? 0} נקודות</p>
                    </CardContent>
                  </Card>
                </div>
              )}
            </section>

            {/* ניווט ניהול – כפתורים ברורים */}
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide">ניווט</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {dashboardCards.map((card) => (
                  <Card
                    key={card.id}
                    className="bg-slate-800/60 border-slate-700/80 rounded-xl shadow-sm hover:border-amber-500/40 hover:bg-slate-800/80 transition-all duration-200 cursor-pointer group min-w-0 overflow-hidden"
                    onClick={() => handleDashboardCardClick(card.route)}
                  >
                    <CardHeader className="p-4 pb-2 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="p-2 rounded-lg bg-slate-700/50 group-hover:bg-amber-500/20 transition-colors shrink-0">
                          {card.icon}
                        </div>
                        {card.status && (
                          <span
                            className={`text-[10px] md:text-xs font-medium px-1.5 py-0.5 rounded-full shrink-0 ${
                              card.status.color === "green"
                                ? "bg-emerald-500/20 text-emerald-400"
                                : card.status.color === "orange"
                                  ? "bg-amber-500/20 text-amber-400"
                                  : card.status.color === "red"
                                    ? "bg-red-500/20 text-red-400"
                                    : "bg-slate-600/50 text-slate-400"
                            }`}
                          >
                            {card.status.text}
                          </span>
                        )}
                      </div>
                      <h4 className="text-white font-semibold text-sm md:text-base mt-2 break-words min-w-0">{card.title}</h4>
                      <p className="text-slate-400 text-xs break-words min-w-0 line-clamp-2">{card.description}</p>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                      <Button
                        size="sm"
                        className="w-full bg-amber-600 hover:bg-amber-700 text-white min-h-[40px] md:min-h-[44px] text-xs md:text-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDashboardCardClick(card.route);
                        }}
                      >
                        <ArrowLeft className="w-3.5 h-3.5 md:w-4 md:h-4 ml-1" />
                        כניסה
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          </div>
        )}

        {section === "autoFill" && (
          <div className="space-y-4">
            <Button variant="ghost" size="sm" className="text-slate-400 -ml-2 md:ml-0" onClick={() => setSection("dashboard")}>
              <ArrowLeft className="w-4 h-4 ml-1" />
              חזרה לדשבורד
            </Button>
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Zap className="w-6 h-6 text-amber-400" />
                מילוי אוטומטי של ניחושים
              </h2>
              <p className="text-slate-400 text-sm">יצירת טפסי ניחושים רנדומליים (שחקנים וירטואליים) להצגת פעילות. גישה למנהל בלבד.</p>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-wrap gap-4 items-end">
                <div className="flex flex-col gap-1">
                  <label className="text-slate-400 text-sm">בחר טורניר</label>
                  <select
                    className="bg-slate-900 border border-slate-600 text-white rounded-lg px-4 py-2 min-w-[220px]"
                    value={autoFillTournamentId === "" ? "" : autoFillTournamentId}
                    onChange={(e) => {
                      setAutoFillTournamentId(e.target.value === "" ? "" : Number(e.target.value));
                      setAutoFillResult(null);
                    }}
                  >
                    <option value="">— בחר טורניר —</option>
                    {(tournaments ?? []).map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} – ₪{t.amount} {((t as { type?: string }).type === "chance" ? "צ'אנס" : (t as { type?: string }).type === "lotto" ? "לוטו" : (t as { type?: string }).type === "football_custom" ? "כדורגל" : "מונדיאל")}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-slate-400 text-sm">מספר טפסים (1–500)</label>
                  <Input
                    type="number"
                    min={1}
                    max={500}
                    className="bg-slate-800 text-white w-24"
                    value={autoFillCount}
                    onChange={(e) => setAutoFillCount(Math.max(1, Math.min(500, parseInt(e.target.value, 10) || 1)))}
                  />
                </div>
                <Button
                  className="bg-amber-600 hover:bg-amber-700"
                  disabled={!autoFillTournamentId || autoFillCount < 1 || createAutoSubmissionsMut.isPending}
                  onClick={async () => {
                    if (!autoFillTournamentId) return;
                    try {
                      const res = await createAutoSubmissionsMut.mutateAsync({
                        tournamentId: autoFillTournamentId,
                        count: autoFillCount,
                      });
                      setAutoFillResult(res);
                      toast.success(`נוצרו ${res.created} טפסים אוטומטיים`);
                      refetchSubs();
                      utils.tournaments.getAll.invalidate();
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : "שגיאה ביצירת טפסים");
                    }
                  }}
                >
                  {createAutoSubmissionsMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "צור טפסים אוטומטיים"}
                </Button>
              </div>
              {autoFillResult && (
                <div className="rounded-lg bg-slate-700/50 border border-slate-600 p-4 space-y-3">
                  <h3 className="text-amber-400 font-medium">סיכום</h3>
                  <p className="text-white">נוצרו <strong>{autoFillResult.created}</strong> טפסים.</p>
                  <p className="text-slate-400 text-sm">שמות השחקנים הווירטואליים: {autoFillResult.usernames.slice(0, 20).join(", ")}{autoFillResult.usernames.length > 20 ? ` ... ועוד ${autoFillResult.usernames.length - 20}` : ""}</p>
                  <Button variant="outline" className="border-emerald-500 text-emerald-400 hover:bg-emerald-500/20" onClick={() => setLocation(autoFillResult.leaderboardPath)}>
                    צפייה בדירוג
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
          </div>
        )}

        {section === "submissions" && (
          <div className="space-y-4">
            <Button variant="ghost" size="sm" className="text-slate-400 -ml-2 md:ml-0" onClick={() => setSection("dashboard")}>
              <ArrowLeft className="w-4 h-4 ml-1" />
              חזרה לדשבורד
            </Button>
          <Card className="bg-slate-800/50 border-slate-700 min-w-0 overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between gap-4 flex-wrap">
              <h2 className="text-xl font-bold text-white">כל הטפסים</h2>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-red-400 border-red-500/50 hover:bg-red-500/20"
                  disabled={deleteAllSubmissionsMut.isPending || (submissions?.length ?? 0) === 0}
                  onClick={async () => {
                    if (!confirm("למחוק את כל היסטוריית הטפסים? לא ניתן לשחזר. עמלות סוכנים יימחקו גם כן.")) return;
                    try {
                      const res = await deleteAllSubmissionsMut.mutateAsync();
                      toast.success(res.deletedCount != null && res.deletedCount > 0 ? `נמחקו ${res.deletedCount} טפסים` : "היסטוריית הטפסים ריקה");
                      refetchSubs();
                    } catch {
                      toast.error("שגיאה במחיקה");
                    }
                  }}
                >
                  {deleteAllSubmissionsMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  נקה היסטוריית טפסים
                </Button>
                <div className="relative w-48">
                <Search className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <Input
                  placeholder="חיפוש..."
                  value={searchSubmissions}
                  onChange={(e) => setSearchSubmissions(e.target.value)}
                  className="pr-8 bg-slate-900 border-slate-600 text-white"
                />
              </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-slate-400 text-sm mb-2">סינון לפי תחרות</p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant={submissionsTournamentId === null ? "default" : "outline"}
                    size="sm"
                    className={submissionsTournamentId === null ? "bg-amber-600 hover:bg-amber-700" : "border-slate-600 text-slate-400"}
                    onClick={() => setSubmissionsTournamentId(null)}
                  >
                    הכל
                    <span className="mr-1.5 inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full bg-slate-600 text-xs font-bold">
                      {(submissions ?? []).length}
                    </span>
                  </Button>
                  {tournamentsWithSubmissions.map((t) => {
                    const count = submissionsCountByTournament.get(t.id) ?? 0;
                    const isSelected = submissionsTournamentId === t.id;
                    return (
                        <Button
                          key={t.id}
                          variant="outline"
                          size="sm"
                          className={`max-w-[220px] min-w-0 flex items-center ${isSelected ? "bg-amber-600 hover:bg-amber-700 border-amber-500 text-white" : "border-slate-600 text-slate-400 hover:bg-slate-700/50"}`}
                          onClick={() => setSubmissionsTournamentId(t.id)}
                          title={t.name}
                        >
                          <span className="min-w-0 truncate mr-1.5">{t.name}</span>
                          <span className="shrink-0 inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full bg-slate-600 text-xs font-bold">
                            {count}
                          </span>
                        </Button>
                    );
                  })}
                </div>
              </div>
              <div className="overflow-x-auto max-h-[60vh] overflow-y-auto min-w-0">
                <table className="w-full text-right text-sm table-fixed">
                  <thead className="sticky top-0 bg-slate-800 z-10">
                    <tr className="border-b border-slate-600 text-slate-400">
                      <th className="py-2 px-2 w-[25%]">משתמש</th>
                      {submissionsTournamentId == null && <th className="py-2 px-2 w-[25%]">תחרות</th>}
                      <th className="py-2 px-2">סטטוס</th>
                      <th className="py-2 px-2">תאריך</th>
                      <th className="py-2 px-2">פעולות</th>
                    </tr>
                  </thead>
                  <tbody>
                {filteredSubmissions.map((s) => {
                  const tourName = tournaments?.find((t) => t.id === s.tournamentId)?.name ?? `#${s.tournamentId}`;
                  return (
                    <tr key={s.id} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                      <td className="py-2 px-2 text-white font-medium min-w-0 max-w-0 break-words" title={s.username}>{s.username}</td>
                      {submissionsTournamentId == null && (
                        <td className="py-2 px-2 text-slate-400 min-w-0 max-w-0 break-words" title={tourName}>{tourName}</td>
                      )}
                      <td className="py-2 px-2">
                        <Badge
                          variant={s.status === "approved" ? "default" : s.status === "rejected" ? "destructive" : "secondary"}
                          className="ml-1"
                        >
                          {s.status === "approved" ? "אושר" : s.status === "rejected" ? "נדחה" : "ממתין"}
                        </Badge>
                        {s.paymentStatus === "completed" && (
                          <Badge variant="outline" className="text-slate-400 mr-1">שולם</Badge>
                        )}
                      </td>
                      <td className="py-2 px-2 text-slate-400">
                        {s.createdAt ? new Date(s.createdAt).toLocaleString("he-IL") : "—"}
                      </td>
                      <td className="py-2 px-2">
                        <div className="flex gap-1 flex-wrap">
                          {s.status === "pending" && (
                            <>
                              <Button size="sm" onClick={() => handleApprove(s.id)} className="bg-emerald-600 h-8 w-8 p-0">
                                <Check className="w-4 h-4" />
                              </Button>
                              <Button size="sm" variant="destructive" onClick={() => handleReject(s.id)} className="h-8 w-8 p-0">
                                <X className="w-4 h-4" />
                              </Button>
                            </>
                          )}
                          <Button
                            size="sm"
                            variant={s.paymentStatus === "completed" ? "default" : "outline"}
                            className="h-8 w-8 p-0"
                            onClick={() => handlePayment(s.id, "completed")}
                            title="סימון תשלום"
                          >
                            <DollarSign className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 w-8 p-0 text-red-400 border-red-500/50 hover:bg-red-500/20"
                            onClick={() => handleDelete(s.id, s.username)}
                            title="מחיקת טופס"
                            disabled={deleteMut.isPending}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                  </tbody>
                </table>
              </div>
              {filteredSubmissions.length === 0 && (
                <p className="text-slate-500 py-6 text-center">
                  {submissionsTournamentId != null ? "אין טפסים בתחרות זו" : searchSubmissions.trim() ? "אין תוצאות לחיפוש" : "אין טפסים"}
                </p>
              )}
            </CardContent>
          </Card>
          </div>
        )}

        {section === "competitions" && competitionSubType === null && (
          <Card className="bg-slate-800/50 border-slate-700 max-w-2xl">
            <CardHeader>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Trophy className="w-6 h-6 text-amber-400" />
                פתיחת תחרות חדשה
              </h2>
              <p className="text-slate-400 text-sm">בחר סוג תחרות לפתיחה וניהול.</p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Button
                  type="button"
                  variant="outline"
                  className="h-auto py-6 flex flex-col gap-2 border-slate-600 hover:bg-slate-700/50 hover:border-amber-500/50 text-white"
                  onClick={() => setCompetitionSubType("lotto")}
                >
                  <span className="text-2xl">🎱</span>
                  <span>פתיחת תחרות לוטו</span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-auto py-6 flex flex-col gap-2 border-slate-600 hover:bg-slate-700/50 hover:border-amber-500/50 text-white"
                  onClick={() => setCompetitionSubType("chance")}
                >
                  <span className="text-2xl">🎟</span>
                  <span>פתיחת תחרות צ'אנס</span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-auto py-6 flex flex-col gap-2 border-slate-600 hover:bg-slate-700/50 hover:border-amber-500/50 text-white"
                  onClick={() => setCompetitionSubType("football_custom")}
                >
                  <span className="text-2xl">⚽</span>
                  <span>פתיחת תחרות כדורגל</span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-auto py-6 flex flex-col gap-2 border-slate-600 hover:bg-slate-700/50 hover:border-amber-500/50 text-white"
                  onClick={() => setCompetitionSubType("mondial")}
                >
                  <span className="text-2xl">🌍</span>
                  <span>פתיחת תחרות מונדיאל</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {section === "competitions" && competitionSubType === "chance" && (
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Sparkles className="w-6 h-6 text-amber-400" />
                  תחרויות צ'אנס
                </h2>
                <p className="text-slate-400 text-sm">כל תחרות צ'אנס בנפרד: פתיחה, נעילה, עדכון תוצאות מפעל הפיס.</p>
              </div>
              <Button variant="outline" size="sm" className="text-slate-400 shrink-0" onClick={() => setCompetitionSubType(null)}>← חזרה</Button>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h3 className="text-white font-medium mb-2">צור תחרות צ'אנס חדשה</h3>
                <form onSubmit={(e) => handleCreateTournament(e, "chance")} className="flex flex-wrap gap-4 items-end p-4 rounded-lg bg-slate-700/30">
                  <div className="flex flex-col gap-1">
                    <label className="text-slate-400 text-sm">שם תחרות</label>
                    <Input className="bg-slate-800 text-white w-40" placeholder="צ'אנס 100" value={newTournament.name} onChange={(e) => setNewTournament((p) => ({ ...p, name: e.target.value }))} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-slate-400 text-sm">סכום (₪)</label>
                    <Input type="number" min={1} className="bg-slate-800 text-white w-24" value={newTournament.amount} onChange={(e) => setNewTournament((p) => ({ ...p, amount: e.target.value }))} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-slate-400 text-sm">תאריך הגרלה</label>
                    <Input type="date" placeholder="dd/mm/yyyy" title="dd/mm/yyyy" className="bg-slate-800 text-white w-36" value={newTournament.drawDate} onChange={(e) => setNewTournament((p) => ({ ...p, drawDate: e.target.value }))} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-slate-400 text-sm">שעת הגרלה</label>
                    <select className="bg-slate-800 text-white rounded-lg px-3 py-2 w-24 border border-slate-600" value={newTournament.drawTime} onChange={(e) => setNewTournament((p) => ({ ...p, drawTime: e.target.value }))}>
                      <option value="">בחר</option>
                      {CHANCE_DRAW_TIMES.map((h) => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-slate-400 text-sm">מזהה ייחודי (אופציונלי)</label>
                    <Input className="bg-slate-800 text-white w-44" placeholder="ריק = כמה תחרויות באותו סכום" value={newTournament.customIdentifier} onChange={(e) => setNewTournament((p) => ({ ...p, customIdentifier: e.target.value }))} title="אם ריק – ניתן לפתוח כמה תחרויות צ'אנס עם אותו סכום (בתאריך/שעה שונים)" />
                  </div>
                  <Button type="submit" size="sm" disabled={createTournamentMut.isPending} className="bg-amber-600 hover:bg-amber-700">
                    {createTournamentMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "צור תחרות צ'אנס"}
                  </Button>
                </form>
              </div>
              <div>
                <h3 className="text-white font-medium mb-2">רשימת תחרויות צ'אנס</h3>
                {chanceTournaments.length === 0 ? (
                  <p className="text-slate-500 text-sm">אין תחרויות צ'אנס. צור אחת למעלה.</p>
                ) : (
                  <div className="space-y-2">
                    {chanceTournaments.map((t) => {
                      const d = (t as { drawDate?: string }).drawDate;
                      const time = (t as { drawTime?: string }).drawTime;
                      const dateLabel = d ? new Date(d + "T12:00:00").toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit", year: "numeric" }) : "";
                      return (
                        <div key={t.id} className="flex flex-wrap items-center justify-between gap-2 p-3 rounded bg-slate-700/30">
                          <span className="text-white font-medium">{t.name} – ₪{t.amount}{d && time ? ` (${dateLabel} – ${time})` : ""}</span>
                        <div className="flex gap-2 flex-wrap">
                          <Button size="sm" variant={t.isLocked ? "outline" : "default"} onClick={() => handleLock(t.id, !t.isLocked)}>{t.isLocked ? "פתח" : "נעל"}</Button>
                          <Button size="sm" variant="outline" onClick={() => { setChanceResultTournamentId(t.id); setChanceResultForm({ heartCard: "", clubCard: "", diamondCard: "", spadeCard: "" }); }}>עדכן תוצאות</Button>
                          <Button size="sm" variant="outline" className="text-red-400 border-red-400/50 hover:bg-red-500/20" onClick={() => handleDeleteTournament(t.id, t.name)} disabled={deleteTournamentMut.isPending}><Trash2 className="w-4 h-4" /></Button>
                        </div>
                      </div>
                    );
                    })}
                  </div>
                )}
              </div>
              <div>
                <label className="text-slate-400 text-sm block mb-2">עדכון תוצאות – בחר תחרות (תאריך ושעה)</label>
                <div className="flex flex-wrap gap-2 items-center mb-2">
                  <select
                    className="bg-slate-900 border border-slate-600 text-white rounded-lg px-4 py-2 w-full max-w-md"
                    value={chanceResultTournamentId === "" ? "" : chanceResultTournamentId}
                    onChange={(e) => {
                      const v = e.target.value;
                      setChanceResultTournamentId(v === "" ? "" : Number(v));
                      setChanceDrawCodeInput("");
                      setChanceResultForm({ heartCard: "", clubCard: "", diamondCard: "", spadeCard: "" });
                    }}
                  >
                    <option value="">— בחר טורניר (תאריך + שעת הגרלה) —</option>
                    {chanceTournaments.map((t) => {
                      const d = (t as { drawDate?: string }).drawDate;
                      const time = (t as { drawTime?: string }).drawTime;
                      const dateLabel = d ? new Date(d + "T12:00:00").toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit", year: "numeric" }) : "";
                      return (
                        <option key={t.id} value={t.id}>{t.name} – ₪{t.amount}{d && time ? ` – ${dateLabel} – ${time}` : ""}</option>
                      );
                    })}
                  </select>
                </div>

              {(typeof chanceResultTournamentId === "number" || (chanceDrawResult && "tournamentId" in chanceDrawResult)) && (
                <>
                  {chanceDrawResult && (
                    <div className="p-4 rounded-lg bg-slate-700/30 border border-slate-600">
                      <h3 className="text-amber-400 font-medium mb-2">תוצאה נוכחית</h3>
                      <p className="text-slate-300 text-sm">
                        ❤️ {chanceDrawResult.heartCard} &nbsp; ♣ {chanceDrawResult.clubCard} &nbsp; ♦ {chanceDrawResult.diamondCard} &nbsp; ♠ {chanceDrawResult.spadeCard}
                      </p>
                      {chanceDrawResult.locked && (
                        <Badge className="mt-2 bg-amber-600">נעול – לא ניתן לערוך</Badge>
                      )}
                    </div>
                  )}

                  {!chanceDrawResult?.locked && (
                    <form
                      className="space-y-4 p-4 rounded-lg bg-slate-700/30"
                      onSubmit={async (e) => {
                        e.preventDefault();
                        if (
                          !chanceResultForm.heartCard ||
                          !chanceResultForm.clubCard ||
                          !chanceResultForm.diamondCard ||
                          !chanceResultForm.spadeCard
                        ) {
                          toast.error("יש למלא את כל ארבעת הקלפים");
                          return;
                        }
                        try {
                          const tid = typeof chanceResultTournamentId === "number" ? chanceResultTournamentId : (chanceDrawResult as { tournamentId?: number })?.tournamentId;
                          if (tid == null) return;
                          const selectedChance = chanceTournaments.find((t) => t.id === tid);
                          const drawDateToSend = (selectedChance as { drawDate?: string })?.drawDate?.trim() || new Date().toISOString().slice(0, 10);
                          await updateChanceResultsMut.mutateAsync({
                            tournamentId: tid,
                            heartCard: chanceResultForm.heartCard,
                            clubCard: chanceResultForm.clubCard,
                            diamondCard: chanceResultForm.diamondCard,
                            spadeCard: chanceResultForm.spadeCard,
                            drawDate: drawDateToSend,
                          });
                          toast.success("תוצאות עודכנו – התאמות וטבלת דירוג חושבו");
                          setChanceResultForm({ heartCard: "", clubCard: "", diamondCard: "", spadeCard: "" });
                          refetchChanceDrawResult();
                          utils.submissions.getChanceLeaderboard.invalidate();
                        } catch (err) {
                          toast.error(err instanceof Error ? err.message : "שגיאה בעדכון");
                        }
                      }}
                    >
                      <h3 className="text-white font-medium">הזנת תוצאות (מפעל הפיס)</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="text-slate-400 text-sm">❤️ לב</label>
                          <select
                            className="mt-1 w-full bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2"
                            value={chanceResultForm.heartCard}
                            onChange={(e) => setChanceResultForm((p) => ({ ...p, heartCard: e.target.value as typeof p.heartCard }))}
                          >
                            <option value="">בחר קלף</option>
                            {CHANCE_CARDS.map((c) => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="text-slate-400 text-sm">♣ תלתן</label>
                          <select
                            className="mt-1 w-full bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2"
                            value={chanceResultForm.clubCard}
                            onChange={(e) => setChanceResultForm((p) => ({ ...p, clubCard: e.target.value as typeof p.clubCard }))}
                          >
                            <option value="">בחר קלף</option>
                            {CHANCE_CARDS.map((c) => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="text-slate-400 text-sm">♦ יהלום</label>
                          <select
                            className="mt-1 w-full bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2"
                            value={chanceResultForm.diamondCard}
                            onChange={(e) => setChanceResultForm((p) => ({ ...p, diamondCard: e.target.value as typeof p.diamondCard }))}
                          >
                            <option value="">בחר קלף</option>
                            {CHANCE_CARDS.map((c) => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="text-slate-400 text-sm">♠ עלה</label>
                          <select
                            className="mt-1 w-full bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2"
                            value={chanceResultForm.spadeCard}
                            onChange={(e) => setChanceResultForm((p) => ({ ...p, spadeCard: e.target.value as typeof p.spadeCard }))}
                          >
                            <option value="">בחר קלף</option>
                            {CHANCE_CARDS.map((c) => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button type="submit" disabled={updateChanceResultsMut.isPending} className="bg-amber-600 hover:bg-amber-700">
                          {updateChanceResultsMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "עדכן תוצאות"}
                        </Button>
                        {chanceDrawResult && !chanceDrawResult.locked && (
                          <Button
                            type="button"
                            variant="outline"
                            onClick={async () => {
                              try {
                                const tid = typeof chanceResultTournamentId === "number" ? chanceResultTournamentId : (chanceDrawResult as { tournamentId?: number })?.tournamentId;
                                if (tid == null) return;
                                await lockChanceDrawMut.mutateAsync({ tournamentId: tid });
                                toast.success("תוצאות נעולות");
                                refetchChanceDrawResult();
                              } catch {
                                toast.error("שגיאה בנעילה");
                              }
                            }}
                            disabled={lockChanceDrawMut.isPending}
                          >
                            {lockChanceDrawMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "נעל תוצאות"}
                          </Button>
                        )}
                      </div>
                    </form>
                  )}
                </>
              )}
              </div>
            </CardContent>
          </Card>
        )}

        {section === "competitions" && competitionSubType === "lotto" && (
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Trophy className="w-6 h-6 text-amber-400" />
                  תחרויות לוטו
                </h2>
                <p className="text-slate-400 text-sm">כל תחרות לוטו בנפרד: פתיחה, נעילה, עדכון תוצאות מפעל הפיס.</p>
              </div>
              <Button variant="outline" size="sm" className="text-slate-400 shrink-0" onClick={() => setCompetitionSubType(null)}>← חזרה</Button>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h3 className="text-white font-medium mb-2">צור תחרות לוטו חדשה</h3>
                <form onSubmit={(e) => handleCreateTournament(e, "lotto")} className="flex flex-wrap gap-4 items-end p-4 rounded-lg bg-slate-700/30">
                  <div className="flex flex-col gap-1">
                    <label className="text-slate-400 text-sm">שם תחרות</label>
                    <Input className="bg-slate-800 text-white w-40" placeholder="לוטו 50" value={newTournament.name} onChange={(e) => setNewTournament((p) => ({ ...p, name: e.target.value }))} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-slate-400 text-sm">סכום (₪)</label>
                    <Input type="number" min={1} className="bg-slate-800 text-white w-24" value={newTournament.amount} onChange={(e) => setNewTournament((p) => ({ ...p, amount: e.target.value }))} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-slate-400 text-sm">תאריך סגירת הגרלה</label>
                    <Input type="date" placeholder="dd/mm/yyyy" title="dd/mm/yyyy" className="bg-slate-800 text-white w-36" value={newTournament.drawDate} onChange={(e) => setNewTournament((p) => ({ ...p, drawDate: e.target.value }))} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-slate-400 text-sm">שעת סגירת הגרלה</label>
                    <select className="bg-slate-800 text-white rounded-lg px-3 py-2 w-24 border border-slate-600" value={newTournament.drawTime} onChange={(e) => setNewTournament((p) => ({ ...p, drawTime: e.target.value }))}>
                      <option value="">בחר</option>
                      {LOTTO_DRAW_TIMES.map((h) => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-slate-400 text-sm">מזהה תחרות</label>
                    <Input className="bg-slate-800 text-white w-36" placeholder="למשל lotto-1" value={newTournament.drawCode} onChange={(e) => setNewTournament((p) => ({ ...p, drawCode: e.target.value }))} title="מזהה ייחודי לעדכון תוצאות בהמשך" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-slate-400 text-sm">מזהה ייחודי (אופציונלי)</label>
                    <Input className="bg-slate-800 text-white w-36" placeholder="ריק = אפשר כמה עם אותו סכום" value={newTournament.customIdentifier} onChange={(e) => setNewTournament((p) => ({ ...p, customIdentifier: e.target.value }))} />
                  </div>
                  <Button type="submit" size="sm" disabled={createTournamentMut.isPending} className="bg-amber-600 hover:bg-amber-700">
                    {createTournamentMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "צור תחרות לוטו"}
                  </Button>
                </form>
              </div>
              <div>
                <h3 className="text-white font-medium mb-2">רשימת תחרויות לוטו</h3>
                {lottoTournaments.length === 0 ? (
                  <p className="text-slate-500 text-sm">אין תחרויות לוטו. צור אחת למעלה.</p>
                ) : (
                  <div className="space-y-2">
{lottoTournaments.map((t) => {
                      const d = (t as { drawDate?: string }).drawDate;
                      const time = (t as { drawTime?: string }).drawTime;
                      const dateLabel = d ? new Date(d + "T12:00:00").toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit", year: "numeric" }) : "";
                      return (
                        <div key={t.id} className="flex flex-wrap items-center justify-between gap-2 p-3 rounded bg-slate-700/30">
                        <span className="text-white font-medium">{t.name} – ₪{t.amount}{(t as { drawCode?: string }).drawCode ? ` (מזהה: ${(t as { drawCode?: string }).drawCode})` : ""}{d && time ? ` – ${dateLabel} ${time}` : ""}</span>
                        <div className="flex gap-2 flex-wrap">
                          <Button size="sm" variant={t.isLocked ? "outline" : "default"} onClick={() => handleLock(t.id, !t.isLocked)}>{t.isLocked ? "פתח" : "נעל"}</Button>
                          <Button size="sm" variant="outline" onClick={() => { setLottoResultTournamentId(t.id); setLottoResultForm({ num1: "", num2: "", num3: "", num4: "", num5: "", num6: "", strongNumber: "" }); }}>עדכן תוצאות</Button>
                          <Button size="sm" variant="outline" className="text-red-400 border-red-400/50 hover:bg-red-500/20" onClick={() => handleDeleteTournament(t.id, t.name)} disabled={deleteTournamentMut.isPending}><Trash2 className="w-4 h-4" /></Button>
                        </div>
                      </div>
                      );
                    })}
                  </div>
                )}
              </div>
              <div>
                <label className="text-slate-400 text-sm block mb-2">עדכון תוצאות – בחר תחרות או הזן מזהה</label>
                <div className="flex flex-wrap gap-2 items-center mb-2">
                  <Input
                    className="bg-slate-800 text-white w-48"
                    placeholder="מזהה תחרות (למשל lotto-1)"
                    value={lottoDrawCodeInput}
                    onChange={(e) => setLottoDrawCodeInput(e.target.value)}
                  />
                  <Button type="button" size="sm" variant="outline" onClick={() => { setLottoDrawCodeInput((c) => c.trim()); }} disabled={!lottoDrawCodeInput.trim()}>
                    טען לפי מזהה
                  </Button>
                </div>
                <select
                  className="bg-slate-900 border border-slate-600 text-white rounded-lg px-4 py-2 w-full max-w-md"
                  value={lottoResultTournamentId === "" ? "" : lottoResultTournamentId}
                  onChange={(e) => {
                    const v = e.target.value;
                    setLottoResultTournamentId(v === "" ? "" : Number(v));
                    setLottoDrawCodeInput("");
                    setLottoResultForm({ num1: "", num2: "", num3: "", num4: "", num5: "", num6: "", strongNumber: "" });
                  }}
                >
                  <option value="">— בחר טורניר —</option>
                  {lottoTournaments.map((t) => (
                    <option key={t.id} value={t.id}>{t.name} – ₪{t.amount}{(t as { drawCode?: string }).drawCode ? ` (${(t as { drawCode?: string }).drawCode})` : ""}</option>
                  ))}
                </select>
              </div>

              {(typeof lottoResultTournamentId === "number" || (lottoDrawResult && "tournamentId" in lottoDrawResult)) && (
                <>
                  {lottoDrawResult && (
                    <div className="p-4 rounded-lg bg-slate-700/30 border border-slate-600">
                      <h3 className="text-amber-400 font-medium mb-2">תוצאה נוכחית</h3>
                      <p className="text-slate-300 text-sm">
                        מספרים: {lottoDrawResult.num1}, {lottoDrawResult.num2}, {lottoDrawResult.num3}, {lottoDrawResult.num4}, {lottoDrawResult.num5}, {lottoDrawResult.num6} • חזק: {lottoDrawResult.strongNumber}
                      </p>
                      {lottoDrawResult.locked && (
                        <Badge className="mt-2 bg-amber-600">נעול</Badge>
                      )}
                    </div>
                  )}

                  {!lottoDrawResult?.locked && (
                    <form
                      className="space-y-4 p-4 rounded-lg bg-slate-700/30"
                      onSubmit={async (e) => {
                        e.preventDefault();
                        const n1 = parseInt(lottoResultForm.num1, 10);
                        const n2 = parseInt(lottoResultForm.num2, 10);
                        const n3 = parseInt(lottoResultForm.num3, 10);
                        const n4 = parseInt(lottoResultForm.num4, 10);
                        const n5 = parseInt(lottoResultForm.num5, 10);
                        const n6 = parseInt(lottoResultForm.num6, 10);
                        const strong = parseInt(lottoResultForm.strongNumber, 10);
                        if ([n1, n2, n3, n4, n5, n6].some((x) => isNaN(x) || x < 1 || x > 37) || isNaN(strong) || strong < 1 || strong > 7) {
                          toast.error("יש למלא 6 מספרים (1–37) ומספר חזק (1–7)");
                          return;
                        }
                        const set = new Set([n1, n2, n3, n4, n5, n6]);
                        if (set.size !== 6) {
                          toast.error("6 המספרים חייבים להיות שונים");
                          return;
                        }
                        try {
                          const tid = typeof lottoResultTournamentId === "number" ? lottoResultTournamentId : (lottoDrawResult as { tournamentId?: number })?.tournamentId;
                          if (tid == null) return;
                          await updateLottoResultsMut.mutateAsync({
                            tournamentId: tid,
                            num1: n1, num2: n2, num3: n3, num4: n4, num5: n5, num6: n6,
                            strongNumber: strong,
                            drawDate: new Date().toISOString().slice(0, 10),
                          });
                          toast.success("תוצאות לוטו עודכנו");
                          setLottoResultForm({ num1: "", num2: "", num3: "", num4: "", num5: "", num6: "", strongNumber: "" });
                          refetchLottoDrawResult();
                          utils.submissions.getLottoLeaderboard.invalidate();
                        } catch (err) {
                          toast.error(err instanceof Error ? err.message : "שגיאה");
                        }
                      }}
                    >
                      <h3 className="text-white font-medium">6 מספרים זוכים (1–37)</h3>
                      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                        {([1, 2, 3, 4, 5, 6] as const).map((i) => (
                          <Input
                            key={i}
                            type="number"
                            min={1}
                            max={37}
                            placeholder={`#${i}`}
                            className="bg-slate-800 text-white text-center"
                            value={lottoResultForm[`num${i}`]}
                            onChange={(e) => setLottoResultForm((p) => ({ ...p, [`num${i}`]: e.target.value }))}
                          />
                        ))}
                      </div>
                      <div>
                        <label className="text-slate-400 text-sm">מספר חזק (1–7)</label>
                        <Input
                          type="number"
                          min={1}
                          max={7}
                          className="mt-1 bg-slate-800 text-white w-24"
                          value={lottoResultForm.strongNumber}
                          onChange={(e) => setLottoResultForm((p) => ({ ...p, strongNumber: e.target.value }))}
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button type="submit" disabled={updateLottoResultsMut.isPending} className="bg-amber-600 hover:bg-amber-700">
                          {updateLottoResultsMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "עדכן תוצאות"}
                        </Button>
                        {lottoDrawResult && !lottoDrawResult.locked && (
                          <Button
                            type="button"
                            variant="outline"
                            onClick={async () => {
                              try {
                                if (typeof lottoResultTournamentId !== "number") return;
                                await lockLottoDrawMut.mutateAsync({ tournamentId: lottoResultTournamentId });
                                toast.success("תוצאות נעולות");
                                refetchLottoDrawResult();
                              } catch {
                                toast.error("שגיאה בנעילה");
                              }
                            }}
                            disabled={lockLottoDrawMut.isPending}
                          >
                            {lockLottoDrawMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "נעל תוצאות"}
                          </Button>
                        )}
                      </div>
                    </form>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        )}

        {section === "players" && (
          <div className="space-y-6">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Gem className="w-5 h-5 text-amber-400" />
                  הפקדה / משיכת נקודות
                </h2>
                <p className="text-slate-400 text-sm">בחר משתמש והזן סכום. משיכה לא תאפשר יתרה שלילית.</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-4 items-end">
                  <div>
                    <label className="block text-slate-400 text-sm mb-1">משתמש</label>
                    <select
                      value={pointsSelectedUserId === "" ? "" : pointsSelectedUserId}
                      onChange={(e) => setPointsSelectedUserId(e.target.value === "" ? "" : parseInt(e.target.value, 10))}
                      className="bg-slate-900 border border-slate-600 text-white rounded-lg px-3 py-2 min-w-[180px]"
                    >
                      <option value="">בחר משתמש</option>
                      {(users ?? []).map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.username ?? u.name ?? `#${u.id}`} {(((u as { unlimitedPoints?: boolean }).unlimitedPoints) || u.role === "admin") ? "(מנהל ללא הגבלה)" : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex gap-3 flex-wrap">
                    <div>
                      <label className="block text-slate-400 text-sm mb-1">הפקדה</label>
                      <Input
                        type="number"
                        min={1}
                        placeholder="סכום"
                        value={pointsDepositAmount}
                        onChange={(e) => setPointsDepositAmount(e.target.value)}
                        className="bg-slate-900 border-slate-600 text-white w-24"
                      />
                    </div>
                    <Button
                      disabled={!pointsSelectedUserId || !pointsDepositAmount || parseInt(pointsDepositAmount, 10) < 1 || depositPointsMut.isPending}
                      onClick={async () => {
                        if (typeof pointsSelectedUserId !== "number") return;
                        const amount = parseInt(pointsDepositAmount, 10);
                        if (amount < 1) return;
                        try {
                          await depositPointsMut.mutateAsync({ userId: pointsSelectedUserId, amount });
                          toast.success("הנקודות הופקדו בהצלחה");
                          setPointsDepositAmount("");
                          refetchPointsLogs();
                          utils.auth.me.invalidate();
                        } catch (e) {
                          toast.error(e instanceof Error ? e.message : "שגיאה");
                        }
                      }}
                      className="bg-emerald-600 hover:bg-emerald-700"
                    >
                      {depositPointsMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "הפקד"}
                    </Button>
                    <div>
                      <label className="block text-slate-400 text-sm mb-1">משיכה</label>
                      <Input
                        type="number"
                        min={1}
                        placeholder="סכום"
                        value={pointsWithdrawAmount}
                        onChange={(e) => setPointsWithdrawAmount(e.target.value)}
                        className="bg-slate-900 border-slate-600 text-white w-24"
                      />
                    </div>
                    <Button
                      variant="destructive"
                      disabled={!pointsSelectedUserId || !pointsWithdrawAmount || parseInt(pointsWithdrawAmount, 10) < 1 || withdrawPointsMut.isPending}
                      onClick={async () => {
                        if (typeof pointsSelectedUserId !== "number") return;
                        const amount = parseInt(pointsWithdrawAmount, 10);
                        if (amount < 1) return;
                        try {
                          await withdrawPointsMut.mutateAsync({ userId: pointsSelectedUserId, amount });
                          toast.success("הנקודות נמשכו בהצלחה");
                          setPointsWithdrawAmount("");
                          refetchPointsLogs();
                          utils.auth.me.invalidate();
                        } catch (e) {
                          toast.error(e instanceof Error ? e.message : "שגיאה");
                        }
                      }}
                    >
                      {withdrawPointsMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "משוך"}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <h2 className="text-xl font-bold text-white">חלוקת פרסים לתחרות</h2>
                <p className="text-slate-400 text-sm">לאחר סיום תחרות – חלוקת קופת הפרסים שווה בין הזוכים (עיגול למטה). פעם אחת לתחרות.</p>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-4 items-end">
                <div>
                  <label className="block text-slate-400 text-sm mb-1">תחרות</label>
                  <select
                    value={pointsDistributeTournamentId === "" ? "" : pointsDistributeTournamentId}
                    onChange={(e) => setPointsDistributeTournamentId(e.target.value === "" ? "" : parseInt(e.target.value, 10))}
                    className="bg-slate-900 border border-slate-600 text-white rounded-lg px-3 py-2 min-w-[200px]"
                  >
                    <option value="">בחר תחרות</option>
                    {(tournaments ?? []).map((t) => (
                      <option key={t.id} value={t.id}>{(t as { name?: string }).name ?? t.name ?? `#${t.id}`}</option>
                    ))}
                  </select>
                </div>
                <Button
                  disabled={!pointsDistributeTournamentId || distributePrizesMut.isPending}
                  onClick={async () => {
                    if (!pointsDistributeTournamentId) return;
                      try {
                        const res = await distributePrizesMut.mutateAsync({ tournamentId: pointsDistributeTournamentId });
                        const tour = (tournaments ?? []).find((x) => x.id === pointsDistributeTournamentId);
                        const name = (tour as { name?: string })?.name ?? `#${pointsDistributeTournamentId}`;
                        toast.success(
                          `חולקו פרסים: ${res.winnerCount} זוכים, ${res.prizePerWinner} נקודות לכל אחד (סה"כ ${res.distributed}). תחרות "${name}" הסתיימה והוסרה מהדף הראשי.`
                        );
                      refetchPointsLogs();
                      utils.auth.me.invalidate();
                      utils.tournaments.getAll.invalidate();
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : "שגיאה");
                    }
                  }}
                  className="bg-amber-600 hover:bg-amber-700"
                >
                  {distributePrizesMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "חלק פרסים לזוכים"}
                </Button>
              </CardContent>
            </Card>
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <h2 className="text-xl font-bold text-white">משתמשים ושחקנים</h2>
                <p className="text-slate-400 text-sm">סה״כ {usersList.length} משתמשים (לפי סינון). סוכנים מופיעים ברשימה עם סיכום עמלות.</p>
                <div className="flex flex-wrap gap-2 items-center mt-2">
                  <span className="text-slate-500 text-sm">סינון לפי תפקיד:</span>
                  <select
                    value={usersListRoleFilter}
                    onChange={(e) => setUsersListRoleFilter(e.target.value as "all" | "user" | "agent" | "admin")}
                    className="bg-slate-900 border border-slate-600 text-white rounded-lg px-3 py-1.5 text-sm"
                  >
                    <option value="all">הכל</option>
                    <option value="user">שחקנים</option>
                    <option value="agent">סוכנים</option>
                    <option value="admin">מנהלים</option>
                  </select>
                  <span className="text-slate-500 text-sm mr-4">לפני ייצוא דוח שחקן – ייפתח חלון לבחירת טווח תאריכים.</span>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-slate-400 text-xs sm:text-sm mb-2">גלול ימינה/שמאלה לראות את כל העמודות. שם ותפקיד קבועים.</p>
                <div className="overflow-x-auto -mx-1 min-w-0">
                  <table className="w-full text-right text-xs sm:text-sm min-w-[640px] border-collapse">
                    <thead>
                      <tr className="border-b border-slate-600 bg-slate-800/90 text-slate-400 sticky top-0 z-10">
                        <th className="py-1.5 sm:py-2 px-2 sm:px-3 text-right whitespace-nowrap bg-slate-800/95 sticky right-0 z-20 border-l border-slate-600/50 min-w-[4.5rem]">שם</th>
                        <th className="py-1.5 sm:py-2 px-2 sm:px-3 text-right whitespace-nowrap bg-slate-800/95 sticky right-[4.5rem] z-20 border-l border-slate-600/50 min-w-[4rem]">תפקיד</th>
                        <th className="py-1.5 sm:py-2 px-2 sm:px-3 whitespace-nowrap">טלפון</th>
                        <th className="py-1.5 sm:py-2 px-2 sm:px-3 whitespace-nowrap">נקודות</th>
                        {usersListRoleFilter === "agent" && (
                          <>
                            <th className="py-1.5 sm:py-2 px-2 sm:px-3 whitespace-nowrap">שחקנים</th>
                            <th className="py-1.5 sm:py-2 px-2 sm:px-3 whitespace-nowrap">עמלות</th>
                            <th className="py-1.5 sm:py-2 px-2 sm:px-3 whitespace-nowrap">הכנסות</th>
                          </>
                        )}
                        {usersListRoleFilter === "all" && (
                          <>
                            <th className="py-1.5 sm:py-2 px-2 sm:px-3 whitespace-nowrap">שחקנים</th>
                            <th className="py-1.5 sm:py-2 px-2 sm:px-3 whitespace-nowrap">עמלות</th>
                            <th className="py-1.5 sm:py-2 px-2 sm:px-3 whitespace-nowrap">הכנסות</th>
                          </>
                        )}
                        <th className="py-1.5 sm:py-2 px-2 sm:px-3 whitespace-nowrap">סטטוס</th>
                        <th className="py-1.5 sm:py-2 px-2 sm:px-3 whitespace-nowrap">פעולות</th>
                      </tr>
                    </thead>
                    <tbody>
                      {usersList.map((u, idx) => (
                        <tr key={u.id} className={`border-b border-slate-700/50 ${idx % 2 === 1 ? "bg-slate-800/30" : ""}`}>
                          <td className="py-1.5 sm:py-2 px-2 sm:px-3 text-white font-medium whitespace-nowrap bg-slate-800/95 sm:bg-transparent sticky right-0 z-10 border-l border-slate-600/50 min-w-[4.5rem]">{u.username || "—"}</td>
                          <td className="py-1.5 sm:py-2 px-2 sm:px-3 whitespace-nowrap bg-slate-800/95 sm:bg-transparent sticky right-[4.5rem] z-10 border-l border-slate-600/50">
                            {u.role === "agent" && <Badge className="bg-emerald-600/80 text-white text-[10px] sm:text-xs">סוכן</Badge>}
                            {u.role === "admin" && <Badge className="bg-amber-600/80 text-white text-[10px] sm:text-xs">מנהל</Badge>}
                            {u.role === "user" && <Badge variant="secondary" className="text-slate-300 text-[10px] sm:text-xs">שחקן</Badge>}
                          </td>
                          <td className="py-1.5 sm:py-2 px-2 sm:px-3 text-slate-300 whitespace-nowrap">{u.phone || "—"}</td>
                          <td className="py-1.5 sm:py-2 px-2 sm:px-3 text-amber-400 font-medium whitespace-nowrap">{((u as { unlimitedPoints?: boolean }).unlimitedPoints) || u.role === "admin" ? "∞" : (u.points ?? 0)}</td>
                          {usersListRoleFilter === "agent" && u.role === "agent" && (
                            <>
                              <td className="py-1.5 sm:py-2 px-2 sm:px-3 text-slate-300 whitespace-nowrap">{u.referredCount ?? 0}</td>
                              <td className="py-1.5 sm:py-2 px-2 sm:px-3 text-emerald-400 whitespace-nowrap">{u.totalCommission ?? 0} ₪</td>
                              <td className="py-1.5 sm:py-2 px-2 sm:px-3 text-slate-300 whitespace-nowrap">{u.totalEntryAmount ?? 0} ₪</td>
                            </>
                          )}
                          {usersListRoleFilter === "all" && u.role === "agent" && (
                            <>
                              <td className="py-1.5 sm:py-2 px-2 sm:px-3 text-slate-300 whitespace-nowrap">{u.referredCount ?? 0}</td>
                              <td className="py-1.5 sm:py-2 px-2 sm:px-3 text-emerald-400 whitespace-nowrap">{u.totalCommission ?? 0} ₪</td>
                              <td className="py-1.5 sm:py-2 px-2 sm:px-3 text-slate-300 whitespace-nowrap">{u.totalEntryAmount ?? 0} ₪</td>
                            </>
                          )}
                          {(usersListRoleFilter === "all" || usersListRoleFilter === "agent") && u.role !== "agent" && (
                            <>
                              <td className="py-1.5 sm:py-2 px-2 sm:px-3 text-slate-400 whitespace-nowrap">—</td>
                              <td className="py-1.5 sm:py-2 px-2 sm:px-3 text-slate-400 whitespace-nowrap">—</td>
                              <td className="py-1.5 sm:py-2 px-2 sm:px-3 text-slate-400 whitespace-nowrap">—</td>
                            </>
                          )}
                          <td className="py-1.5 sm:py-2 px-2 sm:px-3 text-slate-300 whitespace-nowrap">
                            {u.deletedAt ? "מחוק" : u.isBlocked ? "🔴 חסום" : "🟢 פעיל"}
                          </td>
                          <td className="py-1.5 sm:py-2 px-2 sm:px-3">
                            <div className="flex flex-nowrap items-center gap-1 overflow-x-auto min-w-0">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 text-xs border-slate-500 text-slate-300"
                                onClick={() => {
                                  setUserPasswordResetId(u.id);
                                  setUserPasswordNew("");
                                  setUserPasswordConfirm("");
                                }}
                                title="שינוי סיסמה"
                                disabled={u.role === "admin"}
                              >
                                <Lock className="w-4 h-4 ml-1" />
                                שינוי סיסמה
                              </Button>
                              {u.role === "agent" && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 text-xs border-emerald-500 text-emerald-400"
                                  onClick={() => setSection("agents")}
                                  title="צפייה בדוח סוכן"
                                >
                                  דוח סוכן
                                </Button>
                              )}
                              {u.role === "user" && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 text-xs border-amber-500/50 text-amber-400"
                                  onClick={() => {
                                    setExportPlayerUserId(u.id);
                                    setExportPlayerUsername(u.username ?? `#${u.id}`);
                                    setExportPlayerFrom(playersReportFrom);
                                    setExportPlayerTo(playersReportTo);
                                    setExportPlayerError("");
                                    setExportPlayerModalOpen(true);
                                  }}
                                  title="ייצוא דוח שחקן – ייפתח חלון לבחירת טווח תאריכים"
                                >
                                  <FileDown className="w-4 h-4 ml-1" />
                                  ייצוא דוח שחקן
                                </Button>
                              )}
                              {u.role === "user" && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8 text-xs border-emerald-500/50 text-emerald-400"
                                    onClick={() => {
                                      setAssignAgentPlayerId(u.id);
                                      setAssignAgentPlayerName(u.username ?? u.name ?? `#${u.id}`);
                                      setAssignAgentSelectedId(u.agentId ?? "");
                                      setAssignAgentModalOpen(true);
                                    }}
                                    title="שייך שחקן לסוכן"
                                  >
                                    <UserPlus className="w-4 h-4 ml-1" />
                                    שייך לסוכן
                                  </Button>
                                  {u.agentId != null && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-8 text-xs border-slate-500 text-slate-400"
                                      onClick={async () => {
                                        try {
                                          await assignAgentMut.mutateAsync({ playerId: u.id, agentId: null });
                                          toast.success("השיוך הוסר");
                                        } catch (e) {
                                          toast.error(e instanceof Error ? e.message : "שגיאה");
                                        }
                                      }}
                                      disabled={assignAgentMut.isPending}
                                      title="הסר שיוך סוכן"
                                    >
                                      הסר שיוך
                                    </Button>
                                  )}
                                </>
                              )}
                              {!u.deletedAt && u.role !== "admin" && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className={`h-8 text-xs ${u.isBlocked ? "border-amber-500 text-amber-400" : "border-slate-500 text-slate-300"}`}
                                  onClick={async () => {
                                    try {
                                      await setUserBlockedMut.mutateAsync({ userId: u.id, isBlocked: !u.isBlocked });
                                      toast.success(u.isBlocked ? "המשתמש שוחרר מחסימה" : "המשתמש נחסם");
                                      refetchUsersList();
                                      utils.admin.getUsers.invalidate();
                                    } catch (e) {
                                      toast.error(e instanceof Error ? e.message : "שגיאה");
                                    }
                                  }}
                                  disabled={setUserBlockedMut.isPending}
                                >
                                  {u.isBlocked ? "בטל חסימה" : "חסום"}
                                </Button>
                              )}
                              {(u.role === "user" || u.role === "agent") && (
                                <>
                              <Input
                                type="number"
                                min={1}
                                placeholder="+"
                                className="bg-slate-800 text-white w-24 text-center text-sm h-9"
                                value={playerDepositAmount[u.id] ?? ""}
                                onChange={(e) => setPlayerDepositAmount((prev) => ({ ...prev, [u.id]: e.target.value }))}
                              />
                              <Button
                                size="sm"
                                className="h-9 bg-emerald-600 hover:bg-emerald-700 text-xs"
                                disabled={depositPointsMut.isPending || !!((u as { unlimitedPoints?: boolean }).unlimitedPoints) || !(playerDepositAmount[u.id] ?? "").trim() || parseInt(String(playerDepositAmount[u.id]), 10) < 1}
                                onClick={async () => {
                                  const amount = parseInt(String(playerDepositAmount[u.id]), 10);
                                  if (amount < 1) return;
                                  setPointsSelectedUserId(u.id);
                                  try {
                                    await depositPointsMut.mutateAsync({ userId: u.id, amount });
                                    toast.success("הנקודות הופקדו");
                                    setPlayerDepositAmount((prev) => ({ ...prev, [u.id]: "" }));
                                    refetchPointsLogs();
                                    refetchUsersList();
                                    utils.admin.getPlayers.invalidate();
                                    utils.auth.me.invalidate();
                                  } catch (e) {
                                    toast.error(e instanceof Error ? e.message : "שגיאה");
                                  } finally {
                                    setPointsSelectedUserId("");
                                  }
                                }}
                              >
                                {depositPointsMut.isPending && pointsSelectedUserId === u.id ? <Loader2 className="w-3 h-3 animate-spin" /> : "הפקד"}
                              </Button>
                              <Input
                                type="number"
                                min={1}
                                placeholder="−"
                                className="bg-slate-800 text-white w-24 text-center text-sm h-9"
                                value={playerWithdrawAmount[u.id] ?? ""}
                                onChange={(e) => setPlayerWithdrawAmount((prev) => ({ ...prev, [u.id]: e.target.value }))}
                              />
                              <Button
                                size="sm"
                                variant="destructive"
                                className="h-9 text-xs"
                                disabled={withdrawPointsMut.isPending || !!((u as { unlimitedPoints?: boolean }).unlimitedPoints) || !(playerWithdrawAmount[u.id] ?? "").trim() || parseInt(String(playerWithdrawAmount[u.id]), 10) < 1}
                                onClick={async () => {
                                  const amount = parseInt(String(playerWithdrawAmount[u.id]), 10);
                                  if (amount < 1) return;
                                  setPointsSelectedUserId(u.id);
                                  try {
                                    await withdrawPointsMut.mutateAsync({ userId: u.id, amount });
                                    toast.success("הנקודות נמשכו");
                                    setPlayerWithdrawAmount((prev) => ({ ...prev, [u.id]: "" }));
                                    refetchPointsLogs();
                                    refetchUsersList();
                                    utils.admin.getPlayers.invalidate();
                                    utils.auth.me.invalidate();
                                  } catch (e) {
                                    toast.error(e instanceof Error ? e.message : "שגיאה");
                                  } finally {
                                    setPointsSelectedUserId("");
                                  }
                                }}
                              >
                                {withdrawPointsMut.isPending && pointsSelectedUserId === u.id ? <Loader2 className="w-3 h-3 animate-spin" /> : "משוך"}
                              </Button>
                                </>
                              )}
                              {u.role !== "admin" && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-red-400 border-red-400/50 hover:bg-red-500/20"
                                onClick={() => handleDeleteUser(u.id, u.name || u.username || `#${u.id}`, u.role === "agent")}
                                disabled={deleteUserMut.isPending}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {(!usersList || usersList.length === 0) && (
                  <p className="text-slate-500 text-center py-6">אין משתמשים ברשימה</p>
                )}
              </CardContent>
            </Card>

            <Dialog
              open={userPasswordResetId !== null}
              onOpenChange={(open) => {
                if (!open) {
                  setUserPasswordResetId(null);
                  setUserPasswordNew("");
                  setUserPasswordConfirm("");
                }
              }}
            >
              <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-sm">
                <DialogHeader>
                  <DialogTitle className="text-white text-right">🔐 שינוי סיסמה</DialogTitle>
                </DialogHeader>
                <div className="grid gap-3 py-2">
                  <div>
                    <label className="block text-sm text-slate-400 mb-1 text-right">סיסמה חדשה</label>
                    <Input
                      type="password"
                      className="bg-slate-800 text-white border-slate-600 text-right"
                      placeholder="לפחות 6 תווים"
                      value={userPasswordNew}
                      onChange={(e) => setUserPasswordNew(e.target.value)}
                      minLength={6}
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-1 text-right">אימות סיסמה</label>
                    <Input
                      type="password"
                      className="bg-slate-800 text-white border-slate-600 text-right"
                      placeholder="הקלד שוב"
                      value={userPasswordConfirm}
                      onChange={(e) => setUserPasswordConfirm(e.target.value)}
                      minLength={6}
                    />
                  </div>
                  {userPasswordNew.length > 0 && userPasswordNew.length < 6 && (
                    <p className="text-amber-400 text-sm text-right">סיסמה לפחות 6 תווים</p>
                  )}
                  {userPasswordConfirm.length > 0 && userPasswordNew !== userPasswordConfirm && (
                    <p className="text-red-400 text-sm text-right">הסיסמאות אינן תואמות</p>
                  )}
                </div>
                <DialogFooter className="gap-2 sm:gap-0 flex-row-reverse">
                  <Button
                    variant="outline"
                    className="border-slate-600 text-slate-300"
                    onClick={() => {
                      setUserPasswordResetId(null);
                      setUserPasswordNew("");
                      setUserPasswordConfirm("");
                    }}
                  >
                    ביטול
                  </Button>
                  <Button
                    className="bg-emerald-600 hover:bg-emerald-700"
                    disabled={
                      resetUserPasswordMut.isPending ||
                      userPasswordNew.length < 6 ||
                      userPasswordNew !== userPasswordConfirm
                    }
                    onClick={async () => {
                      if (userPasswordResetId == null || userPasswordNew.length < 6 || userPasswordNew !== userPasswordConfirm) return;
                      try {
                        await resetUserPasswordMut.mutateAsync({ userId: userPasswordResetId, newPassword: userPasswordNew });
                        toast.success("הסיסמה עודכנה");
                        setUserPasswordResetId(null);
                        setUserPasswordNew("");
                        setUserPasswordConfirm("");
                        utils.admin.getPlayers.invalidate();
                        utils.admin.getUsersList.invalidate();
                        utils.admin.getAdminAuditLogs?.invalidate?.();
                      } catch (e) {
                        toast.error(e instanceof Error ? e.message : "שגיאה בעדכון סיסמה");
                      }
                    }}
                  >
                    {resetUserPasswordMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "עדכן סיסמה"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <h2 className="text-xl font-bold text-white">לוג תנועות נקודות</h2>
                <p className="text-slate-400 text-sm">מי ביצע, למי, כמות, תאריך, סוג פעולה.</p>
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  {prizeLogTournamentId != null && (
                    <Button variant="outline" size="sm" className="w-fit text-slate-300 border-slate-600" onClick={() => setPrizeLogTournamentId(null)}>
                      ← חזרה ללוג הכללי
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-fit text-red-400 border-red-400/50 hover:bg-red-500/20"
                    onClick={() => setPointsLogDeleteConfirmOpen(true)}
                    disabled={deletePointsLogsHistoryMut.isPending}
                    style={{ display: user?.isSuperAdmin ? undefined : "none" }}
                  >
                    <Trash2 className="w-4 h-4 ml-1" />
                    מחיקת היסטוריה
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {prizeLogTournamentId != null ? (
                  !prizeLogs?.length ? (
                    <p className="text-slate-500 py-4">אין תנועות פרסים לתחרות זו.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-right text-sm">
                        <thead>
                          <tr className="border-b border-slate-600 text-slate-400">
                            <th className="py-2 px-2">תאריך</th>
                            <th className="py-2 px-2">משתמש</th>
                            <th className="py-2 px-2">פעולה</th>
                            <th className="py-2 px-2">כמות</th>
                            <th className="py-2 px-2">יתרה</th>
                          </tr>
                        </thead>
                        <tbody>
                          {prizeLogs.map((row) => (
                            <tr key={row.id} className="border-b border-slate-700/50">
                              <td className="py-2 px-2 text-slate-300">
                                {row.createdAt ? new Date(row.createdAt).toLocaleString("he-IL") : "-"}
                              </td>
                              <td className="py-2 px-2 text-slate-300">{row.userId}</td>
                              <td className="py-2 px-2 text-slate-300">{row.actionType}</td>
                              <td className={`py-2 px-2 ${row.amount >= 0 ? "text-emerald-400" : "text-red-400"}`}>{row.amount >= 0 ? "+" : ""}{row.amount}</td>
                              <td className="py-2 px-2 text-amber-400/90">{row.balanceAfter}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )
                ) : !pointsLogs?.length ? (
                  <p className="text-slate-500 py-4">אין תנועות.</p>
                ) : (
                  <>
                    <div className="flex flex-wrap items-center gap-3 mb-4 p-3 rounded-lg bg-slate-900/50 border border-slate-700">
                      <span className="text-slate-400 text-sm">סינון:</span>
                      <div>
                        <label className="block text-slate-500 text-xs mb-0.5">סוכן</label>
                        <select
                          value={pointsLogAgentId === "" ? "" : pointsLogAgentId}
                          onChange={(e) => setPointsLogAgentId(e.target.value === "" ? "" : parseInt(e.target.value, 10))}
                          className="bg-slate-800 border border-slate-600 text-white rounded px-2 py-1.5 text-sm min-w-[120px]"
                        >
                          <option value="">כל הסוכנים</option>
                          {(agents ?? []).map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.username ?? a.name ?? `#${a.id}`}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-slate-500 text-xs mb-0.5">סוג פעולה</label>
                        <select
                          value={pointsLogActionType}
                          onChange={(e) => setPointsLogActionType(e.target.value)}
                          className="bg-slate-800 border border-slate-600 text-white rounded px-2 py-1.5 text-sm min-w-[140px]"
                        >
                          <option value="">כל הסוגים</option>
                          <option value="deposit">הפקדה</option>
                          <option value="withdraw">משיכה</option>
                          <option value="participation">השתתפות</option>
                          <option value="prize">זכייה</option>
                          <option value="admin_approval">אישור מנהל</option>
                          <option value="refund">החזר</option>
                          <option value="agent_transfer">העברת סוכן</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-slate-500 text-xs mb-0.5">מתאריך</label>
                        <input
                          type="date"
                          placeholder="dd/mm/yyyy"
                          title="dd/mm/yyyy"
                          value={pointsLogFrom}
                          onChange={(e) => setPointsLogFrom(e.target.value)}
                          className="bg-slate-800 border border-slate-600 text-white rounded px-2 py-1.5 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-500 text-xs mb-0.5">עד תאריך</label>
                        <input
                          type="date"
                          placeholder="dd/mm/yyyy"
                          title="dd/mm/yyyy"
                          value={pointsLogTo}
                          onChange={(e) => setPointsLogTo(e.target.value)}
                          className="bg-slate-800 border border-slate-600 text-white rounded px-2 py-1.5 text-sm"
                        />
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-5 text-emerald-400 border-emerald-500/50 hover:bg-emerald-500/20"
                        disabled={pointsLogExporting}
                        onClick={async () => {
                          setPointsLogExporting(true);
                          try {
                            const { csv } = await utils.admin.exportPointsLogsCSV.fetch({
                              userId: pointsSelectedUserId === "" ? undefined : pointsSelectedUserId,
                              from: pointsLogFrom || undefined,
                              to: pointsLogTo || undefined,
                              agentId: pointsLogAgentId === "" ? undefined : pointsLogAgentId,
                              actionType: pointsLogActionType || undefined,
                              limit: 2000,
                            });
                            const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement("a");
                            a.href = url;
                            a.download = `points-logs-${new Date().toISOString().slice(0, 10)}.csv`;
                            a.click();
                            URL.revokeObjectURL(url);
                            toast.success("ה-CSV יוּרד");
                          } catch (e) {
                            toast.error(e instanceof Error ? e.message : "שגיאה בייצוא");
                          } finally {
                            setPointsLogExporting(false);
                          }
                        }}
                      >
                        {pointsLogExporting ? <Loader2 className="w-4 h-4 animate-spin ml-1" /> : <FileDown className="w-4 h-4 ml-1" />}
                        ייצוא CSV
                      </Button>
                    </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-right text-sm">
                      <thead>
                        <tr className="border-b border-slate-600 text-slate-400">
                          <th className="py-2 px-2">תאריך</th>
                          <th className="py-2 px-2">משתמש</th>
                          <th className="py-2 px-2">פעולה</th>
                          <th className="py-2 px-2">כמות</th>
                          <th className="py-2 px-2">יתרה</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pointsLogs.map((row) => (
                          <tr key={row.id} className="border-b border-slate-700/50">
                            <td className="py-2 px-2 text-slate-300">
                              {row.createdAt ? new Date(row.createdAt).toLocaleString("he-IL") : "-"}
                            </td>
                            <td className="py-2 px-2 text-slate-300">{row.userId}</td>
                            <td className="py-2 px-2 text-slate-300">{row.actionType}</td>
                            <td className={`py-2 px-2 ${row.amount >= 0 ? "text-emerald-400" : "text-red-400"}`}>{row.amount >= 0 ? "+" : ""}{row.amount}</td>
                            <td className="py-2 px-2 text-amber-400/90">{row.balanceAfter}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  </>
                )}
              </CardContent>
            </Card>

            <AlertDialog open={pointsLogDeleteConfirmOpen} onOpenChange={setPointsLogDeleteConfirmOpen}>
              <AlertDialogContent className="bg-slate-900 border-slate-700 text-white">
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-white text-right">מחיקת היסטוריית תנועות נקודות</AlertDialogTitle>
                  <AlertDialogDescription className="text-slate-400 text-right">
                    פעולה זו תמחק את כל רשומות לוג תנועות הנקודות (הפקדות, משיכות, פרסים). לא ניתן לשחזר. הנקודות של המשתמשים עצמם לא ישתנו – רק יומן התנועות יימחק.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="flex-row-reverse gap-2">
                  <AlertDialogCancel className="border-slate-600 text-slate-300">ביטול</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-red-600 hover:bg-red-700 text-white"
                    onClick={async (e) => {
                      e.preventDefault();
                      try {
                        await deletePointsLogsHistoryMut.mutateAsync();
                        toast.success("היסטוריית תנועות הנקודות נמחקה");
                        setPointsLogDeleteConfirmOpen(false);
                        refetchPointsLogs();
                        utils.admin.getPointsLogs.invalidate();
                      } catch (err) {
                        toast.error(err instanceof Error ? err.message : "שגיאה במחיקה");
                      }
                    }}
                    disabled={deletePointsLogsHistoryMut.isPending}
                  >
                    {deletePointsLogsHistoryMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "מחוק היסטוריה"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

          </div>
        )}

        <Dialog open={exportPlayerModalOpen} onOpenChange={(open) => { if (!open) { setExportPlayerModalOpen(false); setExportPlayerError(""); } }}>
          <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-sm">
            <DialogHeader>
              <DialogTitle className="text-white text-right">ייצוא דוח שחקן – {exportPlayerUsername}</DialogTitle>
              <DialogDescription className="text-slate-400 text-right">חובה לבחור תאריך התחלה ותאריך סיום לפני יצירת הדוח.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-3 py-2">
              <div>
                <label className="block text-sm text-slate-400 mb-1 text-right">תאריך התחלה</label>
                <Input type="date" value={exportPlayerFrom} onChange={(e) => { setExportPlayerFrom(e.target.value); setExportPlayerError(""); }} placeholder="dd/mm/yyyy" title="dd/mm/yyyy" className="bg-slate-800 border-slate-600 text-white text-right w-full" />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1 text-right">תאריך סיום</label>
                <Input type="date" value={exportPlayerTo} onChange={(e) => { setExportPlayerTo(e.target.value); setExportPlayerError(""); }} placeholder="dd/mm/yyyy" title="dd/mm/yyyy" className="bg-slate-800 border-slate-600 text-white text-right w-full" />
              </div>
              {exportPlayerError && <p className="text-red-400 text-sm text-right">{exportPlayerError}</p>}
            </div>
            <DialogFooter className="gap-2 sm:gap-0 flex-row-reverse">
              <Button variant="outline" className="border-slate-600 text-slate-300" onClick={() => { setExportPlayerModalOpen(false); setExportPlayerError(""); }}>
                ביטול
              </Button>
              <Button
                className="bg-amber-600 hover:bg-amber-700"
                disabled={exportingPlayerId === exportPlayerUserId}
                onClick={async () => {
                  const from = exportPlayerFrom.trim();
                  const to = exportPlayerTo.trim();
                  if (!from || !to) {
                    setExportPlayerError("אנא בחר טווח תאריכים לפני יצירת הדוח");
                    return;
                  }
                  if (exportPlayerUserId == null) return;
                  setExportingPlayerId(exportPlayerUserId);
                  setExportPlayerError("");
                  try {
                    const { csv } = await utils.admin.exportPlayerPnLCSV.fetch({ userId: exportPlayerUserId, from, to });
                    const blob = new Blob([csv ?? ""], { type: "text/csv;charset=utf-8" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `דוח-שחקן-${exportPlayerUsername}-${from}-${to}.csv`;
                    a.click();
                    URL.revokeObjectURL(url);
                    toast.success("הורדת דוח שחקן החלה");
                    setExportPlayerModalOpen(false);
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "שגיאה בייצוא");
                  } finally {
                    setExportingPlayerId(null);
                  }
                }}
              >
                {exportingPlayerId === exportPlayerUserId ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4 ml-1" />}
                ייצא דוח
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={exportAgentModalOpen} onOpenChange={(open) => { if (!open) { setExportAgentModalOpen(false); setExportAgentError(""); } }}>
          <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-sm">
            <DialogHeader>
              <DialogTitle className="text-white text-right">ייצוא דוח סוכן – {exportAgentUsername}</DialogTitle>
              <DialogDescription className="text-slate-400 text-right">חובה לבחור תאריך התחלה ותאריך סיום לפני יצירת הדוח.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-3 py-2">
              <div>
                <label className="block text-sm text-slate-400 mb-1 text-right">תאריך התחלה</label>
                <Input type="date" value={exportAgentFrom} onChange={(e) => { setExportAgentFrom(e.target.value); setExportAgentError(""); }} placeholder="dd/mm/yyyy" title="dd/mm/yyyy" className="bg-slate-800 border-slate-600 text-white text-right w-full" />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1 text-right">תאריך סיום</label>
                <Input type="date" value={exportAgentTo} onChange={(e) => { setExportAgentTo(e.target.value); setExportAgentError(""); }} placeholder="dd/mm/yyyy" title="dd/mm/yyyy" className="bg-slate-800 border-slate-600 text-white text-right w-full" />
              </div>
              {exportAgentError && <p className="text-red-400 text-sm text-right">{exportAgentError}</p>}
            </div>
            <DialogFooter className="gap-2 sm:gap-0 flex-row-reverse">
              <Button variant="outline" className="border-slate-600 text-slate-300" onClick={() => { setExportAgentModalOpen(false); setExportAgentError(""); }}>
                ביטול
              </Button>
              <Button
                className="bg-amber-600 hover:bg-amber-700"
                disabled={exportingAgentId === exportAgentId}
                onClick={async () => {
                  const from = exportAgentFrom.trim();
                  const to = exportAgentTo.trim();
                  if (!from || !to) {
                    setExportAgentError("אנא בחר טווח תאריכים לפני יצירת הדוח");
                    return;
                  }
                  if (exportAgentId == null) return;
                  setExportingAgentId(exportAgentId);
                  setExportAgentError("");
                  try {
                    const { csv } = await utils.admin.exportAgentPnLCSV.fetch({ agentId: exportAgentId, from, to });
                    const blob = new Blob([csv ?? ""], { type: "text/csv;charset=utf-8" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `דוח-סוכן-${exportAgentUsername}-${from}-${to}.csv`;
                    a.click();
                    URL.revokeObjectURL(url);
                    toast.success("הורדת דוח סוכן החלה");
                    setExportAgentModalOpen(false);
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "שגיאה בייצוא");
                  } finally {
                    setExportingAgentId(null);
                  }
                }}
              >
                {exportingAgentId === exportAgentId ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4 ml-1" />}
                ייצא דוח
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={assignAgentModalOpen} onOpenChange={(open) => { if (!open) { setAssignAgentModalOpen(false); setAssignAgentPlayerId(null); setAssignAgentPlayerName(""); setAssignAgentSelectedId(""); } }}>
          <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-sm">
            <DialogHeader>
              <DialogTitle className="text-white text-right">שיוך שחקן לסוכן</DialogTitle>
              <DialogDescription className="text-slate-400 text-right">בחר סוכן לשחקן. פעילות השחקן תופיע בדוחות הסוכן ועמלות יחושבו בהתאם.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-3 py-2">
              <div>
                <label className="block text-sm text-slate-400 mb-1 text-right">שחקן</label>
                <p className="text-white font-medium text-right">{assignAgentPlayerName}</p>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1 text-right">סוכן</label>
                <select
                  value={assignAgentSelectedId === "" ? "" : String(assignAgentSelectedId)}
                  onChange={(e) => setAssignAgentSelectedId(e.target.value === "" ? "" : Number(e.target.value))}
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-right"
                >
                  <option value="">ללא סוכן (הסר שיוך)</option>
                  {(agents ?? []).map((a) => (
                    <option key={a.id} value={a.id}>{(a as { username?: string | null }).username ?? (a as { name?: string | null }).name ?? `#${a.id}`}</option>
                  ))}
                </select>
              </div>
            </div>
            <DialogFooter className="gap-2 sm:gap-0 flex-row-reverse">
              <Button variant="outline" className="border-slate-600 text-slate-300" onClick={() => { setAssignAgentModalOpen(false); setAssignAgentPlayerId(null); setAssignAgentPlayerName(""); setAssignAgentSelectedId(""); }}>
                ביטול
              </Button>
              <Button
                className="bg-emerald-600 hover:bg-emerald-700"
                disabled={assignAgentMut.isPending || assignAgentPlayerId == null}
                onClick={() => {
                  if (assignAgentPlayerId == null) return;
                  assignAgentMut.mutate({
                    playerId: assignAgentPlayerId,
                    agentId: assignAgentSelectedId === "" ? null : assignAgentSelectedId,
                  });
                }}
              >
                {assignAgentMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                שמירה
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {section === "admins" && !user?.isSuperAdmin && (
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="pt-6">
              <p className="text-slate-400 text-center mb-4">גישה לניהול מנהלים שמורה לסופר מנהל בלבד.</p>
              <Button variant="outline" className="border-slate-600 text-slate-300" onClick={() => setSection("dashboard")}>
                חזרה לדשבורד
              </Button>
            </CardContent>
          </Card>
        )}

        {section === "admins" && user?.isSuperAdmin && (
          <div className="space-y-6">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Lock className="w-5 h-5 text-amber-400" />
                  יצירת מנהל חדש
                </h2>
                <p className="text-slate-400 text-sm">רק סופר מנהל (Yoven!) יכול ליצור מנהלים. המנהל ייכנס עם שם משתמש וסיסמה.</p>
              </CardHeader>
              <CardContent>
                <form
                  className="flex flex-wrap gap-4 items-end"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    try {
                      await createAdminMut.mutateAsync(adminForm);
                      toast.success("המנהל נוצר בהצלחה");
                      setAdminForm({ username: "", password: "", name: "" });
                      refetchAdmins();
                    } catch (err: unknown) {
                      toast.error(err instanceof Error ? err.message : "שגיאה ביצירת מנהל");
                    }
                  }}
                >
                  <Input
                    placeholder="שם משתמש"
                    value={adminForm.username}
                    onChange={(e) => setAdminForm((p) => ({ ...p, username: e.target.value }))}
                    className="bg-slate-900 border-slate-600 text-white w-40"
                    minLength={3}
                    required
                  />
                  <Input
                    type="password"
                    placeholder="סיסמה (לפחות 6)"
                    value={adminForm.password}
                    onChange={(e) => setAdminForm((p) => ({ ...p, password: e.target.value }))}
                    className="bg-slate-900 border-slate-600 text-white w-40"
                    minLength={6}
                    required
                  />
                  <Input
                    placeholder="שם (אופציונלי)"
                    value={adminForm.name}
                    onChange={(e) => setAdminForm((p) => ({ ...p, name: e.target.value }))}
                    className="bg-slate-900 border-slate-600 text-white w-40"
                  />
                  <Button type="submit" disabled={createAdminMut.isPending} className="bg-amber-600 hover:bg-amber-700">
                    {createAdminMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "צור מנהל"}
                  </Button>
                </form>
              </CardContent>
            </Card>
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <h2 className="text-xl font-bold text-white">רשימת מנהלים</h2>
                <p className="text-slate-400 text-sm">מחיקה ועדכון סיסמה – רק סופר מנהל. לא ניתן למחוק את עצמך.</p>
              </CardHeader>
              <CardContent>
                {adminsList && adminsList.length > 0 ? (
                  <div className="space-y-2">
                    {adminsList.map((a) => {
                      const isSelf = a.id === user?.id;
                      const isEditing = adminEditId === a.id;
                      return (
                        <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-lg bg-slate-700/30">
                          <span className="text-white font-medium">{(a as { username?: string }).username ?? `#${a.id}`}</span>
                          {isSelf && <Badge variant="secondary">סופר מנהל</Badge>}
                          <div className="flex gap-2">
                            {isEditing ? (
                              <>
                                <Input
                                  type="password"
                                  placeholder="סיסמה חדשה"
                                  value={adminEditPassword}
                                  onChange={(e) => setAdminEditPassword(e.target.value)}
                                  className="bg-slate-900 border-slate-600 text-white w-40"
                                  minLength={6}
                                />
                                <Button
                                  size="sm"
                                  onClick={async () => {
                                    if (!adminEditPassword || adminEditPassword.length < 6) {
                                      toast.error("סיסמה לפחות 6 תווים");
                                      return;
                                    }
                                    try {
                                      await updateAdminMut.mutateAsync({ id: a.id, password: adminEditPassword });
                                      toast.success("הסיסמה עודכנה");
                                      setAdminEditId(null);
                                      setAdminEditPassword("");
                                      refetchAdmins();
                                    } catch (e) {
                                      toast.error(e instanceof Error ? e.message : "שגיאה");
                                    }
                                  }}
                                  disabled={updateAdminMut.isPending}
                                >
                                  שמור
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => { setAdminEditId(null); setAdminEditPassword(""); }}>ביטול</Button>
                              </>
                            ) : (
                              <Button size="sm" variant="outline" onClick={() => setAdminEditId(a.id)} disabled={isSelf}>שינוי סיסמה</Button>
                            )}
                            <Button
                              size="sm"
                              variant="destructive"
                              disabled={isSelf || deleteAdminMut.isPending}
                              onClick={async () => {
                                if (!confirm(`למחוק את המנהל ${(a as { username?: string }).username ?? a.id}?`)) return;
                                try {
                                  await deleteAdminMut.mutateAsync({ id: a.id });
                                  toast.success("המנהל נמחק");
                                  refetchAdmins();
                                } catch (e) {
                                  toast.error(e instanceof Error ? e.message : "שגיאה");
                                }
                              }}
                            >
                              מחק
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-slate-500">אין מנהלים ברשימה.</p>
                )}
              </CardContent>
            </Card>

            <Card className="bg-slate-800/50 border-slate-700 border-red-500/40">
              <CardHeader>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Trash2 className="w-5 h-5 text-red-400" />
                  ניקוי מלא של האתר
                </h2>
                <p className="text-slate-400 text-sm">מוחק את כל המשתמשים (חוץ מסופר מנהל), תחרויות, טפסים, נקודות, דוחות והיסטוריה. האתר יישאר עם סופר מנהל בלבד. פעולה בלתי הפיכה.</p>
              </CardHeader>
              <CardContent>
                <Button
                  variant="destructive"
                  className="bg-red-600 hover:bg-red-700"
                  onClick={() => setFullResetOpen(true)}
                >
                  <Trash2 className="w-4 h-4 ml-2" />
                  ניקוי מלא – איפוס כל הנתונים
                </Button>
              </CardContent>
            </Card>

            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <h2 className="text-xl font-bold text-white">לוג פעולות סופר מנהל</h2>
                <p className="text-slate-400 text-sm">מי ביצע, איזו פעולה, ולמי.</p>
              </CardHeader>
              <CardContent>
                {adminAuditLogs && adminAuditLogs.length > 0 ? (
                  <div className="overflow-x-auto max-h-96">
                    <table className="w-full text-right text-sm">
                      <thead>
                        <tr className="border-b border-slate-600 text-slate-400">
                          <th className="py-2 px-2">תאריך</th>
                          <th className="py-2 px-2">מבצע</th>
                          <th className="py-2 px-2">פעולה</th>
                          <th className="py-2 px-2">למשתמש</th>
                          <th className="py-2 px-2">פרטים</th>
                        </tr>
                      </thead>
                      <tbody>
                        {adminAuditLogs.map((log) => (
                          <tr key={log.id} className="border-b border-slate-700/50">
                            <td className="py-2 px-2 text-slate-300">{log.createdAt ? new Date(log.createdAt).toLocaleString("he-IL") : "-"}</td>
                            <td className="py-2 px-2 text-slate-300">{log.performedBy}</td>
                            <td className="py-2 px-2 text-amber-400/90">{log.action}</td>
                            <td className="py-2 px-2 text-slate-300">{log.targetUserId ?? "–"}</td>
                            <td className="py-2 px-2 text-slate-400">{log.details != null ? JSON.stringify(log.details) : "–"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-slate-500">אין רשומות בלוג.</p>
                )}
              </CardContent>
            </Card>

            <Dialog open={fullResetOpen} onOpenChange={setFullResetOpen}>
              <DialogContent className="bg-slate-800 border-slate-600 text-white">
                <DialogHeader>
                  <DialogTitle className="text-red-400">ניקוי מלא – איפוס כל הנתונים</DialogTitle>
                  <DialogDescription>
                    פעולה זו תמחק לצמיתות את כל המשתמשים (חוץ מסופר מנהל), התחרויות, הטפסים, תנועות הנקודות, דוחות רווח/הפסד והיסטוריית כספים. לא ניתן לשחזר. להמשך יש להזין את סיסמת סופר המנהל ולהקליד בדיוק: ניקוי מלא
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                  <div>
                    <label className="text-slate-400 text-sm block mb-1">סיסמת סופר מנהל</label>
                    <Input
                      type="password"
                      value={fullResetPassword}
                      onChange={(e) => setFullResetPassword(e.target.value)}
                      placeholder="סיסמה"
                      className="bg-slate-900 border-slate-600 text-white"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 text-sm block mb-1">הקלד לאישור: ניקוי מלא</label>
                    <Input
                      value={fullResetConfirmPhrase}
                      onChange={(e) => setFullResetConfirmPhrase(e.target.value)}
                      placeholder="ניקוי מלא"
                      className="bg-slate-900 border-slate-600 text-white"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => { setFullResetOpen(false); setFullResetPassword(""); setFullResetConfirmPhrase(""); }}>ביטול</Button>
                  <Button
                    variant="destructive"
                    className="bg-red-600 hover:bg-red-700"
                    disabled={!fullResetPassword || fullResetConfirmPhrase !== "ניקוי מלא" || fullResetMut.isPending}
                    onClick={() => fullResetMut.mutate({ password: fullResetPassword, confirmPhrase: fullResetConfirmPhrase })}
                  >
                    {fullResetMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "ביצוע ניקוי מלא"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        )}

        {section === "agents" && (
          <div className="space-y-6">
            {(balanceSummary != null || (agentsWithBalances && agentsWithBalances.length > 0)) && (
              <Card className="bg-slate-800/50 border-slate-700">
                <CardHeader>
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <Gem className="w-5 h-5 text-amber-400" />
                    מאזני סוכנים ושחקנים
                  </h2>
                  <p className="text-slate-400 text-sm">סיכום מאזן כללי ובטבלה לפי סוכן.</p>
                </CardHeader>
                <CardContent>
                  {balanceSummary != null && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                      <div className="p-3 rounded-lg bg-slate-900/80">
                        <p className="text-slate-500 text-sm">מאזן כללי כל השחקנים</p>
                        <p className="text-xl font-bold text-amber-400">{balanceSummary.totalPlayersBalance ?? 0} נקודות</p>
                      </div>
                      <div className="p-3 rounded-lg bg-slate-900/80">
                        <p className="text-slate-500 text-sm">מאזן כללי כל הסוכנים</p>
                        <p className="text-xl font-bold text-emerald-400">{balanceSummary.totalAgentsBalance ?? 0} נקודות</p>
                      </div>
                    </div>
                  )}
                  {agentsWithBalances && agentsWithBalances.length > 0 ? (
                    <div className="overflow-x-auto -mx-1 min-w-0">
                      <table className="w-full text-xs sm:text-sm text-right min-w-[320px] border-collapse">
                        <thead>
                          <tr className="border-b border-slate-600 bg-slate-800/90 text-slate-400 sticky top-0 z-10">
                            <th className="py-1.5 sm:py-2 px-2 text-right whitespace-nowrap bg-slate-800/95 sticky right-0 z-20 border-l border-slate-600/50 min-w-[4.5rem]">סוכן</th>
                            <th className="py-1.5 sm:py-2 px-2 whitespace-nowrap">יתרה</th>
                            <th className="py-1.5 sm:py-2 px-2 whitespace-nowrap">מאזן שחקנים</th>
                          </tr>
                        </thead>
                        <tbody>
                          {agentsWithBalances.map((a, idx) => (
                            <tr key={a.id} className={`border-b border-slate-700/50 ${idx % 2 === 1 ? "bg-slate-800/30" : ""}`}>
                              <td className="py-1.5 sm:py-2 px-2 text-white font-medium whitespace-nowrap bg-slate-800/95 sm:bg-transparent sticky right-0 z-10 border-l border-slate-600/50">{a.name || a.username || `#${a.id}`}</td>
                              <td className="py-1.5 sm:py-2 px-2 text-amber-400 font-mono whitespace-nowrap">{a.points ?? 0}</td>
                              <td className="py-1.5 sm:py-2 px-2 text-emerald-400 font-mono whitespace-nowrap">{a.totalPlayersBalance ?? 0}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-slate-500 text-center py-4">אין סוכנים או נתוני מאזן</p>
                  )}
                </CardContent>
              </Card>
            )}
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
                <div className="flex flex-wrap gap-2 items-center mt-2">
                  <span className="text-slate-500 text-sm">לפני ייצוא דוח סוכן – ייפתח חלון לבחירת טווח תאריכים.</span>
                </div>
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
                              className="h-8 text-xs border-amber-500/50 text-amber-400"
                              onClick={() => {
                                setExportAgentId(r.agentId);
                                setExportAgentUsername(r.username ?? `סוכן #${r.agentId}`);
                                setExportAgentFrom(agentsReportFrom);
                                setExportAgentTo(agentsReportTo);
                                setExportAgentError("");
                                setExportAgentModalOpen(true);
                              }}
                              title="ייצוא דוח סוכן – ייפתח חלון לבחירת טווח תאריכים"
                            >
                              <FileDown className="w-4 h-4 ml-1" />
                              ייצוא דוח סוכן
                            </Button>
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

        {section === "pnl" && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <TrendingUp className="w-8 h-8 text-amber-400" />
              דוח רווח והפסד
            </h2>
            <p className="text-slate-400">בחר טווח תאריכים וסוג תחרות. רווח = זכיות והחזרים (שחקנים) / עמלות (סוכנים). הפסד = השתתפויות (שחקנים) / הפקדות לשחקנים (סוכנים).</p>
            <div className="flex flex-wrap gap-2 items-end">
              <div>
                <label className="text-slate-400 text-xs block mb-1">מתאריך</label>
                <Input type="date" value={pnlFrom} onChange={(e) => setPnlFrom(e.target.value)} placeholder="dd/mm/yyyy" title="dd/mm/yyyy" className="bg-slate-900 border-slate-600 text-white w-40" />
              </div>
              <div>
                <label className="text-slate-400 text-xs block mb-1">עד תאריך</label>
                <Input type="date" value={pnlTo} onChange={(e) => setPnlTo(e.target.value)} placeholder="dd/mm/yyyy" title="dd/mm/yyyy" className="bg-slate-900 border-slate-600 text-white w-40" />
              </div>
              <div>
                <label className="text-slate-400 text-xs block mb-1">סוג תחרות</label>
                <select value={pnlTournamentType} onChange={(e) => setPnlTournamentType(e.target.value)} className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm w-40">
                  {PNL_TOURNAMENT_TYPE_OPTIONS.map((o) => (
                    <option key={o.value || "all"} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-slate-400 text-xs block mb-1">סוכן</label>
                <select
                  value={pnlFilterAgentId === "" ? "" : pnlFilterAgentId}
                  onChange={(e) => setPnlFilterAgentId(e.target.value === "" ? "" : Number(e.target.value))}
                  className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm w-48"
                >
                  <option value="">כל הסוכנים</option>
                  {(users ?? []).filter((u) => (u as { role?: string }).role === "agent").map((u) => (
                    <option key={u.id} value={u.id}>{(u as { name?: string }).name || (u as { username?: string }).username || `#${u.id}`}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-slate-400 text-xs block mb-1">שחקן</label>
                <select
                  value={pnlFilterPlayerId === "" ? "" : pnlFilterPlayerId}
                  onChange={(e) => setPnlFilterPlayerId(e.target.value === "" ? "" : Number(e.target.value))}
                  className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm w-48"
                >
                  <option value="">כל השחקנים</option>
                  {(users ?? []).filter((u) => (u as { role?: string }).role === "user").map((u) => (
                    <option key={u.id} value={u.id}>{(u as { name?: string }).name || (u as { username?: string }).username || `#${u.id}`}</option>
                  ))}
                </select>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-amber-500/50 text-amber-400 hover:bg-amber-500/10"
                disabled={pnlExporting}
                onClick={async () => {
                  setPnlExporting(true);
                  try {
                    const { csv } = await utils.admin.exportPnLSummaryCSV.fetch({
                      from: pnlFrom || undefined,
                      to: pnlTo || undefined,
                      tournamentType: pnlTournamentType || undefined,
                    });
                    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `pnl-summary-${pnlFrom || "all"}-${pnlTo || "all"}.csv`;
                    a.click();
                    URL.revokeObjectURL(url);
                    toast.success("הורדת CSV החלה");
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "שגיאה בייצוא");
                  } finally {
                    setPnlExporting(false);
                  }
                }}
              >
                {pnlExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
                <span className="mr-1">ייצא דוח</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-slate-600 text-slate-300 hover:bg-slate-700/40"
                disabled={pnlDetailedExporting}
                onClick={async () => {
                  setPnlDetailedExporting(true);
                  try {
                    const { csv } = await utils.admin.exportPnLReportCSV.fetch({
                      from: pnlFrom || undefined,
                      to: pnlTo || undefined,
                      tournamentType: pnlTournamentType || undefined,
                      agentId: pnlFilterAgentId === "" ? undefined : pnlFilterAgentId,
                      playerId: pnlFilterPlayerId === "" ? undefined : pnlFilterPlayerId,
                      limit: 5000,
                    });
                    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `pnl-detailed-${pnlFrom || "all"}-${pnlTo || "all"}.csv`;
                    a.click();
                    URL.revokeObjectURL(url);
                    toast.success("הורדת CSV החלה");
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "שגיאה בייצוא");
                  } finally {
                    setPnlDetailedExporting(false);
                  }
                }}
              >
                {pnlDetailedExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
                <span className="mr-1">ייצא דוח מפורט</span>
              </Button>
            </div>
            {pnlSummaryLoading ? (
              <div className="flex items-center justify-center py-12"><Loader2 className="w-10 h-10 animate-spin text-amber-500" /></div>
            ) : pnlSummary ? (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card className="bg-slate-800/50 border-slate-700">
                    <CardContent className="pt-4">
                      <p className="text-slate-500 text-sm">סה״כ רווח שחקנים</p>
                      <p className="text-xl font-bold text-emerald-400">{pnlSummary.totalPlayersProfit}</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-slate-800/50 border-slate-700">
                    <CardContent className="pt-4">
                      <p className="text-slate-500 text-sm">סה״כ הפסד שחקנים</p>
                      <p className="text-xl font-bold text-amber-400">{pnlSummary.totalPlayersLoss}</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-slate-800/50 border-slate-700">
                    <CardContent className="pt-4">
                      <p className="text-slate-500 text-sm">סה״כ רווח סוכנים</p>
                      <p className="text-xl font-bold text-emerald-400">{pnlSummary.totalAgentsProfit}</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-slate-800/50 border-slate-700">
                    <CardContent className="pt-4">
                      <p className="text-slate-500 text-sm">סה״כ הפסד סוכנים</p>
                      <p className="text-xl font-bold text-amber-400">{pnlSummary.totalAgentsLoss}</p>
                    </CardContent>
                  </Card>
                </div>
                <Card className="bg-slate-800/50 border-slate-700 border-amber-500/30">
                  <CardContent className="pt-4">
                    <p className="text-slate-500 text-sm">רווח והפסד כולל כל השחקנים והסוכנים (נקודות)</p>
                    <p className="text-3xl font-bold text-amber-400">{pnlSummary.totalNet}</p>
                  </CardContent>
                </Card>
                <Card className="bg-slate-800/50 border-slate-700">
                  <CardHeader>
                    <h3 className="text-lg font-bold text-white">גרף רווח מול הפסד</h3>
                  </CardHeader>
                  <CardContent>
                    <div className="h-64 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={[
                            { name: "רווח שחקנים", value: pnlSummary.totalPlayersProfit, fill: "#34d399" },
                            { name: "הפסד שחקנים", value: pnlSummary.totalPlayersLoss, fill: "#f59e0b" },
                            { name: "רווח סוכנים", value: pnlSummary.totalAgentsProfit, fill: "#10b981" },
                            { name: "הפסד סוכנים", value: pnlSummary.totalAgentsLoss, fill: "#d97706" },
                            { name: "סה״כ נטו", value: pnlSummary.totalNet, fill: pnlSummary.totalNet >= 0 ? "#fbbf24" : "#ef4444" },
                          ]}
                          layout="vertical"
                          margin={{ top: 5, right: 30, left: 80, bottom: 5 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
                          <XAxis type="number" stroke="#94a3b8" />
                          <YAxis type="category" dataKey="name" stroke="#94a3b8" width={75} tick={{ fill: "#cbd5e1" }} />
                          <Tooltip contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #475569", borderRadius: "8px" }} labelStyle={{ color: "#e2e8f0" }} />
                          <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                            {[
                              { name: "רווח שחקנים", value: pnlSummary.totalPlayersProfit, fill: "#34d399" },
                              { name: "הפסד שחקנים", value: pnlSummary.totalPlayersLoss, fill: "#f59e0b" },
                              { name: "רווח סוכנים", value: pnlSummary.totalAgentsProfit, fill: "#10b981" },
                              { name: "הפסד סוכנים", value: pnlSummary.totalAgentsLoss, fill: "#d97706" },
                              { name: "סה״כ נטו", value: pnlSummary.totalNet, fill: pnlSummary.totalNet >= 0 ? "#fbbf24" : "#ef4444" },
                            ].map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.fill} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-slate-800/50 border-slate-700">
                  <CardHeader>
                    <h3 className="text-lg font-bold text-white">טבלת סוכנים</h3>
                  </CardHeader>
                  <CardContent>
                    {pnlSummary.agents.length > 0 ? (
                      <div className="overflow-x-auto -mx-1 min-w-0">
                        <table className="w-full text-xs sm:text-sm text-right min-w-[320px] border-collapse">
                          <thead>
                            <tr className="border-b border-slate-600 bg-slate-800/90 text-slate-400 sticky top-0 z-10">
                              <th className="py-1.5 sm:py-2 px-2 text-right whitespace-nowrap bg-slate-800/95 sticky right-0 z-20 border-l border-slate-600/50 min-w-[4.5rem]">סוכן</th>
                              <th className="py-1.5 sm:py-2 px-2 whitespace-nowrap">רווח</th>
                              <th className="py-1.5 sm:py-2 px-2 whitespace-nowrap">הפסד</th>
                              <th className="py-1.5 sm:py-2 px-2 whitespace-nowrap">רווח נטו</th>
                              <th className="py-1.5 sm:py-2 px-2 whitespace-nowrap"></th>
                            </tr>
                          </thead>
                          <tbody>
                            {pnlSummary.agents.map((a, idx) => (
                              <tr key={a.id} className={`border-b border-slate-700/50 ${idx % 2 === 1 ? "bg-slate-800/30" : ""}`}>
                                <td className="py-1.5 sm:py-2 px-2 text-white font-medium whitespace-nowrap bg-slate-800/95 sm:bg-transparent sticky right-0 z-10 border-l border-slate-600/50">{a.name || a.username || `#${a.id}`}</td>
                                <td className="py-1.5 sm:py-2 px-2 text-emerald-400 whitespace-nowrap">{a.profit}</td>
                                <td className="py-1.5 sm:py-2 px-2 text-amber-400 whitespace-nowrap">{a.loss}</td>
                                <td className="py-1.5 sm:py-2 px-2 font-medium text-white whitespace-nowrap">{a.net}</td>
                                <td className="py-1.5 sm:py-2 px-2">
                                  <Button size="sm" variant="outline" className="text-slate-400 text-xs" onClick={() => setPnlDetailAgentId(a.id)}>דוח מפורט</Button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-slate-500 py-4">אין סוכנים</p>
                    )}
                  </CardContent>
                </Card>
                <Card className="bg-slate-800/50 border-slate-700">
                  <CardHeader>
                    <h3 className="text-lg font-bold text-white">שחקנים לפי סוכן</h3>
                  </CardHeader>
                  <CardContent>
                    {pnlSummary.playersByAgent.length > 0 ? (
                      <div className="space-y-4">
                        {pnlSummary.playersByAgent.map((group) => (
                          <div key={group.agentId}>
                            <p className="text-slate-400 text-sm font-medium mb-2">סוכן: {group.agentName}</p>
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm text-right">
                                <thead>
                                  <tr className="border-b border-slate-600 text-slate-400">
                                    <th className="py-2 px-2">שחקן</th>
                                    <th className="py-2 px-2">רווח</th>
                                    <th className="py-2 px-2">הפסד</th>
                                    <th className="py-2 px-2">רווח נטו</th>
                                    <th className="py-2 px-2"></th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {group.players.map((p) => (
                                    <tr key={p.playerId} className="border-b border-slate-700/50">
                                      <td className="py-2 px-2 text-white">{p.name || p.username || `#${p.playerId}`}</td>
                                      <td className="py-2 px-2 text-emerald-400">{p.profit}</td>
                                      <td className="py-2 px-2 text-amber-400">{p.loss}</td>
                                      <td className="py-2 px-2 font-medium text-white">{p.net}</td>
                                      <td className="py-2 px-2">
                                        <Button size="sm" variant="outline" className="text-slate-400" onClick={() => setPnlDetailPlayerId(p.playerId)}>דוח מפורט</Button>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-slate-500 py-4">אין שחקנים</p>
                    )}
                  </CardContent>
                </Card>
                <Card className="bg-slate-800/50 border-slate-700">
                  <CardHeader>
                    <h3 className="text-lg font-bold text-white">תנועות מלאות (עמלות + נקודות)</h3>
                    <p className="text-slate-400 text-sm">כולל השתתפויות, זכיות, הפקדות/משיכות והעברות סוכן. פילטרים למעלה חלים גם כאן.</p>
                  </CardHeader>
                  <CardContent>
                    {pnlReportRowsLoading ? (
                      <div className="flex items-center justify-center py-10"><Loader2 className="w-8 h-8 animate-spin text-amber-500" /></div>
                    ) : pnlReportRows && pnlReportRows.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm text-right">
                          <thead>
                            <tr className="border-b border-slate-600/50 text-slate-400 bg-slate-800/40">
                              <th className="py-2 px-2">תאריך ושעה</th>
                              <th className="py-2 px-2">סוג פעולה</th>
                              <th className="py-2 px-2">שחקן</th>
                              <th className="py-2 px-2">סוכן</th>
                              <th className="py-2 px-2">סוג תחרות</th>
                              <th className="py-2 px-2">השתתפות</th>
                              <th className="py-2 px-2">זכייה</th>
                              <th className="py-2 px-2">עמלת אתר</th>
                              <th className="py-2 px-2">עמלת סוכן</th>
                              <th className="py-2 px-2">שינוי נק׳</th>
                              <th className="py-2 px-2">יתרה לאחר</th>
                            </tr>
                          </thead>
                          <tbody>
                            {pnlReportRows.map((r) => (
                              <tr key={r.id} className="border-b border-slate-700/40 hover:bg-slate-700/30">
                                <td className="py-2 px-2 text-slate-300">{r.createdAt ? new Date(r.createdAt).toLocaleString("he-IL", { dateStyle: "short", timeStyle: "short" }) : "—"}</td>
                                <td className="py-2 px-2 text-white">{r.actionType}</td>
                                <td className="py-2 px-2 text-slate-200">{r.playerName ?? "—"}</td>
                                <td className="py-2 px-2 text-slate-200">{r.agentName ?? "—"}</td>
                                <td className="py-2 px-2 text-slate-400">{r.tournamentType ?? "—"}</td>
                                <td className="py-2 px-2 text-slate-200">{r.participationAmount ? r.participationAmount : "—"}</td>
                                <td className="py-2 px-2 text-emerald-400">{r.prizeAmount ? `+${r.prizeAmount}` : "—"}</td>
                                <td className="py-2 px-2 text-amber-400">{r.siteCommission ? r.siteCommission : "—"}</td>
                                <td className="py-2 px-2 text-emerald-400">{r.agentCommission ? r.agentCommission : "—"}</td>
                                <td className="py-2 px-2 font-mono">
                                  {r.pointsDelta >= 0 ? <span className="text-emerald-400">+{r.pointsDelta}</span> : <span className="text-amber-400">{r.pointsDelta}</span>}
                                </td>
                                <td className="py-2 px-2 font-mono text-white">{r.balanceAfter}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-slate-500 py-6 text-center">אין תנועות להצגה בטווח/פילטר שנבחר.</p>
                    )}
                  </CardContent>
                </Card>
              </>
            ) : null}

            <Dialog open={pnlDetailAgentId != null} onOpenChange={(open) => !open && setPnlDetailAgentId(null)}>
              <DialogContent className="bg-slate-800 border-slate-600 text-white max-h-[85vh] overflow-hidden flex flex-col">
                <DialogHeader>
                  <DialogTitle>דוח רווח והפסד מפורט – סוכן #{pnlDetailAgentId}</DialogTitle>
                  <DialogDescription>עמלות = רווח. הפקדות לשחקנים = הפסד.</DialogDescription>
                </DialogHeader>
                <div className="overflow-y-auto flex-1 min-h-0">
                  {pnlAgentDetail ? (
                    <>
                      <div className="grid grid-cols-3 gap-2 mb-4 p-3 rounded-lg bg-slate-900/80 text-sm">
                        <div><span className="text-slate-500">רווח:</span> <span className="text-emerald-400 font-bold">{pnlAgentDetail.profit}</span></div>
                        <div><span className="text-slate-500">הפסד:</span> <span className="text-amber-400 font-bold">{pnlAgentDetail.loss}</span></div>
                        <div><span className="text-slate-500">רווח נטו:</span> <span className="text-white font-bold">{pnlAgentDetail.net}</span></div>
                      </div>
                      {(((pnlAgentDetail as { transactions?: Array<{ id: number; date?: string | Date | null; type: string; amount: number; playerName?: string | null; tournamentName?: string | null; balanceAfter?: number }> }).transactions) ?? []).length > 0 ? (
                        <table className="w-full text-sm text-right">
                          <thead>
                            <tr className="border-b border-slate-600 text-slate-400">
                              <th className="py-2 px-2">תאריך</th>
                              <th className="py-2 px-2">שחקן</th>
                              <th className="py-2 px-2">סוג</th>
                              <th className="py-2 px-2">סכום</th>
                              <th className="py-2 px-2">תחרות</th>
                              <th className="py-2 px-2">מאזן לאחר</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(((pnlAgentDetail as { transactions?: Array<{ id: number; date?: string | Date | null; type: string; amount: number; playerName?: string | null; tournamentName?: string | null; balanceAfter?: number }> }).transactions) ?? []).map((t) => (
                              <tr key={t.id} className="border-b border-slate-700/50">
                                <td className="py-2 px-2 text-slate-300">{t.date ? new Date(t.date).toLocaleDateString("he-IL") : "—"}</td>
                                <td className="py-2 px-2 text-white">{(t as { playerName?: string | null }).playerName ?? "—"}</td>
                                <td className="py-2 px-2 text-slate-300">
                                  {t.type === "COMMISSION" ? "עמלה" : t.type === "DEPOSIT" ? "הפקדה" : "זכייה"}
                                </td>
                                <td className={`py-2 px-2 ${t.amount >= 0 ? "text-emerald-400" : "text-amber-400"}`}>{t.amount >= 0 ? "+" : ""}{t.amount}</td>
                                <td className="py-2 px-2 text-slate-400">{(t as { tournamentName?: string | null }).tournamentName ?? "—"}</td>
                                <td className="py-2 px-2 text-white">{(t as { balanceAfter?: number }).balanceAfter ?? "—"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <p className="text-slate-500 py-4">אין תנועות בתקופה</p>
                      )}
                    </>
                  ) : (
                    <p className="text-slate-500 py-4">טוען...</p>
                  )}
                </div>
                </DialogContent>
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    className="border-amber-500/50 text-amber-400"
                    disabled={pnlDetailExporting === "agent"}
                    onClick={async () => {
                      if (pnlDetailAgentId == null) return;
                      setPnlDetailExporting("agent");
                      try {
                        const { csv } = await utils.admin.exportAgentPnLCSV.fetch({
                          agentId: pnlDetailAgentId,
                          from: pnlFrom || undefined,
                          to: pnlTo || undefined,
                          tournamentType: pnlTournamentType || undefined,
                        });
                        const blob = new Blob([csv ?? ""], { type: "text/csv;charset=utf-8" });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = `pnl-agent-${pnlDetailAgentId}.csv`;
                        a.click();
                        URL.revokeObjectURL(url);
                        toast.success("הורדת CSV החלה");
                      } catch (e) {
                        toast.error(e instanceof Error ? e.message : "שגיאה בייצוא");
                      } finally {
                        setPnlDetailExporting(null);
                      }
                    }}
                  >
                    {pnlDetailExporting === "agent" ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
                    <span className="mr-1">ייצוא CSV</span>
                  </Button>
                  <Button variant="outline" onClick={() => setPnlDetailAgentId(null)}>סגור</Button>
                </DialogFooter>
              </Dialog>
            <Dialog open={pnlDetailPlayerId != null} onOpenChange={(open) => !open && setPnlDetailPlayerId(null)}>
              <DialogContent className="bg-slate-800 border-slate-600 text-white max-h-[85vh] overflow-hidden flex flex-col">
                <DialogHeader>
                  <DialogTitle>דוח רווח והפסד מפורט – שחקן #{pnlDetailPlayerId}</DialogTitle>
                  <DialogDescription>זכיות והחזרים = רווח. השתתפויות = הפסד.</DialogDescription>
                </DialogHeader>
                <div className="overflow-y-auto flex-1 min-h-0">
                  {pnlPlayerDetail ? (
                    <>
                      <div className="grid grid-cols-3 gap-2 mb-4 p-3 rounded-lg bg-slate-900/80 text-sm">
                        <div><span className="text-slate-500">רווח:</span> <span className="text-emerald-400 font-bold">{pnlPlayerDetail.profit}</span></div>
                        <div><span className="text-slate-500">הפסד:</span> <span className="text-amber-400 font-bold">{pnlPlayerDetail.loss}</span></div>
                        <div><span className="text-slate-500">רווח נטו:</span> <span className="text-white font-bold">{pnlPlayerDetail.net}</span></div>
                      </div>
                      {pnlPlayerDetail.transactions.length > 0 ? (
                        <table className="w-full text-sm text-right">
                          <thead>
                            <tr className="border-b border-slate-600 text-slate-400">
                              <th className="py-2 px-2">תאריך</th>
                              <th className="py-2 px-2">סוג</th>
                              <th className="py-2 px-2">סכום</th>
                              <th className="py-2 px-2">יתרה לאחר</th>
                            </tr>
                          </thead>
                          <tbody>
                            {pnlPlayerDetail.transactions.map((t) => (
                              <tr key={t.id} className="border-b border-slate-700/50">
                                <td className="py-2 px-2 text-slate-300">{t.createdAt ? new Date(t.createdAt).toLocaleDateString("he-IL") : "—"}</td>
                                <td className="py-2 px-2 text-slate-300">{t.actionType === "prize" ? "זכייה" : t.actionType === "refund" ? "החזר" : "השתתפות"}</td>
                                <td className={`py-2 px-2 ${t.kind === "profit" ? "text-emerald-400" : "text-amber-400"}`}>{t.amount > 0 ? "+" : ""}{t.amount}</td>
                                <td className="py-2 px-2 text-amber-400/90">{t.balanceAfter}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <p className="text-slate-500 py-4">אין תנועות בתקופה</p>
                      )}
                    </>
                  ) : (
                    <p className="text-slate-500 py-4">טוען...</p>
                  )}
                </div>
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    className="border-amber-500/50 text-amber-400"
                    disabled={pnlDetailExporting === "player"}
                    onClick={async () => {
                      if (pnlDetailPlayerId == null) return;
                      setPnlDetailExporting("player");
                      try {
                        const { csv } = await utils.admin.exportPlayerPnLCSV.fetch({
                          userId: pnlDetailPlayerId,
                          from: pnlFrom || undefined,
                          to: pnlTo || undefined,
                          tournamentType: pnlTournamentType || undefined,
                        });
                        const blob = new Blob([csv ?? ""], { type: "text/csv;charset=utf-8" });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = `pnl-player-${pnlDetailPlayerId}.csv`;
                        a.click();
                        URL.revokeObjectURL(url);
                        toast.success("הורדת CSV החלה");
                      } catch (e) {
                        toast.error(e instanceof Error ? e.message : "שגיאה בייצוא");
                      } finally {
                        setPnlDetailExporting(null);
                      }
                    }}
                  >
                    {pnlDetailExporting === "player" ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
                    <span className="mr-1">ייצוא CSV</span>
                  </Button>
                  <Button variant="outline" onClick={() => setPnlDetailPlayerId(null)}>סגור</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        )}

        {section === "competitions" && competitionSubType === "mondial" && (
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Trophy className="w-6 h-6 text-amber-400" />
                  תחרויות מונדיאל (כדורגל)
                </h2>
                <p className="text-slate-400 text-sm">תחרויות ניחושי משחקים. פתיחה, נעילה ומחיקה. עדכון תוצאות ושמות קבוצות למטה.</p>
              </div>
              <Button variant="outline" size="sm" className="text-slate-400 shrink-0" onClick={() => setCompetitionSubType(null)}>← חזרה</Button>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h3 className="text-white font-medium mb-2">צור תחרות מונדיאל חדשה</h3>
                <form onSubmit={(e) => handleCreateTournament(e, "football")} className="flex flex-wrap gap-4 items-end p-4 rounded-lg bg-slate-700/30">
                  <div className="flex flex-col gap-1">
                    <label className="text-slate-400 text-sm">שם תחרות</label>
                    <Input className="bg-slate-800 text-white w-40" placeholder="טורניר 300" value={newTournament.name} onChange={(e) => setNewTournament((p) => ({ ...p, name: e.target.value }))} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-slate-400 text-sm">סכום (₪)</label>
                    <Input type="number" min={1} className="bg-slate-800 text-white w-24" value={newTournament.amount} onChange={(e) => setNewTournament((p) => ({ ...p, amount: e.target.value }))} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-slate-400 text-sm">מזהה ייחודי (אופציונלי)</label>
                    <Input className="bg-slate-800 text-white w-36" placeholder="ריק = אפשר כמה עם אותו סכום" value={newTournament.customIdentifier} onChange={(e) => setNewTournament((p) => ({ ...p, customIdentifier: e.target.value }))} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-slate-400 text-sm">תאריך פתיחה <span className="text-red-400">*</span></label>
                    <Input type="date" required className="bg-slate-800 text-white w-40" value={newTournament.openDate} onChange={(e) => setNewTournament((p) => ({ ...p, openDate: e.target.value }))} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-slate-400 text-sm">שעת פתיחה <span className="text-red-400">*</span></label>
                    <Input type="time" required className="bg-slate-800 text-white w-28" value={newTournament.openTime} onChange={(e) => setNewTournament((p) => ({ ...p, openTime: e.target.value }))} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-slate-400 text-sm">תאריך סגירה <span className="text-red-400">*</span></label>
                    <Input type="date" required className="bg-slate-800 text-white w-40" value={newTournament.closeDate} onChange={(e) => setNewTournament((p) => ({ ...p, closeDate: e.target.value }))} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-slate-400 text-sm">שעת סגירה <span className="text-red-400">*</span></label>
                    <Input type="time" required className="bg-slate-800 text-white w-28" value={newTournament.closeTime} onChange={(e) => setNewTournament((p) => ({ ...p, closeTime: e.target.value }))} />
                  </div>
                  <Button type="submit" size="sm" disabled={createTournamentMut.isPending} className="bg-amber-600 hover:bg-amber-700">
                    {createTournamentMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "צור תחרות מונדיאל"}
                  </Button>
                </form>
              </div>
              <div>
                <h3 className="text-white font-medium mb-2">רשימת תחרויות מונדיאל</h3>
                {footballTournaments.length === 0 ? (
                  <p className="text-slate-500 text-sm">אין תחרויות מונדיאל. צור אחת למעלה.</p>
                ) : (
                  <div className="space-y-2">
                    {footballTournaments.map((t) => (
                      <div key={t.id} className="flex flex-wrap items-center justify-between gap-2 p-3 rounded bg-slate-700/30">
                        <span className="text-white font-medium">{t.name} – ₪{t.amount}{(t as { drawCode?: string }).drawCode ? ` (מזהה: ${(t as { drawCode?: string }).drawCode})` : ""}</span>
                        <div className="flex gap-2">
                          <Button size="sm" variant={t.isLocked ? "outline" : "default"} onClick={() => handleLock(t.id, !t.isLocked)}>{t.isLocked ? "פתח" : "נעל"}</Button>
                          <Button size="sm" variant="outline" className="text-red-400 border-red-400/50 hover:bg-red-500/20" onClick={() => handleDeleteTournament(t.id, t.name)} disabled={deleteTournamentMut.isPending}><Trash2 className="w-4 h-4" /></Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <h3 className="text-white font-medium mb-2">רשימת משחקים – תוצאות ושמות קבוצות</h3>
                <p className="text-slate-400 text-sm mb-2">עדכון תוצאות: לאחר שמירה – ניקוד כל המשתתפים מחושב מחדש. עריכת שמות: ניתן לשנות את שמות הקבוצות לפי רצונך.</p>
                <div className="space-y-2 max-h-[70vh] overflow-y-auto">
                  {matches?.map((m) => (
                    <div
                      key={m.id}
                      className="flex flex-col gap-2 p-3 rounded bg-slate-700/30 hover:bg-slate-700/50 transition-colors"
                    >
                      {editMatchTeams?.id === m.id ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-slate-500 text-sm">#{m.matchNumber}</span>
                          <Input
                            className="flex-1 min-w-[120px] bg-slate-800 text-white"
                            placeholder="קבוצה ביתית"
                            value={editMatchTeams?.homeTeam ?? ""}
                            onChange={(e) => setEditMatchTeams((x) => (x ? { ...x, homeTeam: e.target.value } : null))}
                          />
                          <span className="text-slate-500">vs</span>
                          <Input
                            className="flex-1 min-w-[120px] bg-slate-800 text-white"
                            placeholder="קבוצה אורחת"
                            value={editMatchTeams?.awayTeam ?? ""}
                            onChange={(e) => setEditMatchTeams((x) => (x ? { ...x, awayTeam: e.target.value } : null))}
                          />
                          <Button size="sm" onClick={handleSaveMatchTeams} disabled={updateMatchMut.isPending}>
                            {updateMatchMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "שמור שמות"}
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setEditMatchTeams(null)}>
                            ביטול
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <span className="text-white text-sm">
                            #{m.matchNumber} {m.homeTeam} vs {m.awayTeam}
                          </span>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-slate-400"
                              onClick={() => setEditMatchTeams({ id: m.id, homeTeam: m.homeTeam, awayTeam: m.awayTeam })}
                              title="ערוך שמות קבוצות"
                            >
                              <Pencil className="w-3.5 h-3.5 ml-1" />
                              ערוך שמות
                            </Button>
                            {editMatch?.id === m.id ? (
                              <div className="flex gap-2 items-center">
                                <Input
                                  type="number"
                                  min={0}
                                  max={20}
                                  value={editMatch?.home ?? 0}
                                  onChange={(e) => setEditMatch((x) => (x ? { ...x, home: +e.target.value } : null))}
                                  className="w-14 text-center bg-slate-800"
                                />
                                <span className="text-slate-500">-</span>
                                <Input
                                  type="number"
                                  min={0}
                                  max={20}
                                  value={editMatch?.away ?? 0}
                                  onChange={(e) => setEditMatch((x) => (x ? { ...x, away: +e.target.value } : null))}
                                  className="w-14 text-center bg-slate-800"
                                />
                                <Button size="sm" onClick={handleSaveResult}>
                                  שמור תוצאה
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => setEditMatch(null)}>
                                  ביטול
                                </Button>
                              </div>
                            ) : (
                              <>
                                <span className="text-emerald-400 text-sm">
                                  {m.homeScore != null && m.awayScore != null ? `${m.homeScore}-${m.awayScore}` : "—"}
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
                                  ערוך תוצאה
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {section === "competitions" && competitionSubType === "football_custom" && (
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Trophy className="w-6 h-6 text-amber-400" />
                  ניהול תחרויות כדורגל
                </h2>
                <p className="text-slate-400 text-sm">תחרות עם משחקים שתגדיר ידנית (שם, סכום, רשימת משחקים). עמלה 12.5%, ניקוד 3 לכל ניחוש נכון.</p>
              </div>
              <Button variant="outline" size="sm" className="text-slate-400 shrink-0" onClick={() => setCompetitionSubType(null)}>← חזרה</Button>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h3 className="text-white font-medium mb-2">פתיחת תחרות חדשה</h3>
                <form onSubmit={(e) => handleCreateTournament(e, "football_custom")} className="flex flex-wrap gap-4 items-end p-4 rounded-lg bg-slate-700/30">
                  <div className="flex flex-col gap-1">
                    <label className="text-slate-400 text-sm">שם התחרות</label>
                    <Input className="bg-slate-800 text-white w-40" placeholder="למשל ליגה חודשית" value={newTournament.name} onChange={(e) => setNewTournament((p) => ({ ...p, name: e.target.value }))} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-slate-400 text-sm">סכום השתתפות (₪)</label>
                    <Input type="number" min={1} className="bg-slate-800 text-white w-24" value={newTournament.amount} onChange={(e) => setNewTournament((p) => ({ ...p, amount: e.target.value }))} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-slate-400 text-sm">מזהה ייחודי (אופציונלי)</label>
                    <Input className="bg-slate-800 text-white w-36" placeholder="ריק = אפשר כמה עם אותו סכום" value={newTournament.customIdentifier} onChange={(e) => setNewTournament((p) => ({ ...p, customIdentifier: e.target.value }))} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-slate-400 text-sm">תאריך פתיחה <span className="text-red-400">*</span></label>
                    <Input type="date" required className="bg-slate-800 text-white w-40" value={newTournament.openDate} onChange={(e) => setNewTournament((p) => ({ ...p, openDate: e.target.value }))} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-slate-400 text-sm">שעת פתיחה <span className="text-red-400">*</span></label>
                    <Input type="time" required className="bg-slate-800 text-white w-28" value={newTournament.openTime} onChange={(e) => setNewTournament((p) => ({ ...p, openTime: e.target.value }))} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-slate-400 text-sm">תאריך סגירה <span className="text-red-400">*</span></label>
                    <Input type="date" required className="bg-slate-800 text-white w-40" value={newTournament.closeDate} onChange={(e) => setNewTournament((p) => ({ ...p, closeDate: e.target.value }))} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-slate-400 text-sm">שעת סגירה <span className="text-red-400">*</span></label>
                    <Input type="time" required className="bg-slate-800 text-white w-28" value={newTournament.closeTime} onChange={(e) => setNewTournament((p) => ({ ...p, closeTime: e.target.value }))} />
                  </div>
                  <Button type="submit" size="sm" disabled={createTournamentMut.isPending} className="bg-amber-600 hover:bg-amber-700">
                    {createTournamentMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "צור תחרות"}
                  </Button>
                </form>
              </div>
              <div>
                <h3 className="text-white font-medium mb-2">רשימת תחרויות כדורגל</h3>
                {footballCustomTournaments.length === 0 ? (
                  <p className="text-slate-500 text-sm">אין תחרויות. צור תחרות למעלה, אחר כך הוסף משחקים.</p>
                ) : (
                  <div className="space-y-4">
                    {footballCustomTournaments.map((t) => (
                      <div key={t.id} className="p-4 rounded-lg bg-slate-700/30 border border-slate-600 space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-white font-medium">{t.name} – ₪{t.amount}</span>
                          <div className="flex gap-2">
                            <Button size="sm" variant={t.isLocked ? "outline" : "default"} onClick={() => handleLock(t.id, !t.isLocked)}>{t.isLocked ? "פתח" : "נעל"}</Button>
                            <Button size="sm" variant="outline" onClick={() => { setFootballCustomSelectedId(t.id); setFootballCustomResultEdit({}); }}>משחקים / עדכון תוצאות</Button>
                            <Button size="sm" variant="outline" onClick={() => setFootballCustomSelectedId(t.id)}>דירוג</Button>
                            <Button size="sm" variant="outline" className="text-red-400 border-red-400/50 hover:bg-red-500/20" onClick={() => handleDeleteTournament(t.id, t.name)} disabled={deleteTournamentMut.isPending}><Trash2 className="w-4 h-4" /></Button>
                          </div>
                        </div>
                        {footballCustomSelectedId === t.id && (
                          <div className="border-t border-slate-600 pt-3 space-y-3">
                            <h4 className="text-amber-400 text-sm font-medium">הוספת משחק</h4>
                            <form
                              className="flex flex-wrap gap-2 items-end"
                              onSubmit={async (e) => {
                                e.preventDefault();
                                if (!footballCustomNewMatch.homeTeam.trim() || !footballCustomNewMatch.awayTeam.trim()) {
                                  toast.error("יש להזין קבוצה ביתית ואורחת");
                                  return;
                                }
                                try {
                                  await addCustomFootballMatchMut.mutateAsync({
                                    tournamentId: t.id,
                                    homeTeam: footballCustomNewMatch.homeTeam.trim(),
                                    awayTeam: footballCustomNewMatch.awayTeam.trim(),
                                    matchDate: footballCustomNewMatch.matchDate.trim() || undefined,
                                    matchTime: footballCustomNewMatch.matchTime.trim() || undefined,
                                  });
                                  toast.success("משחק נוסף");
                                  setFootballCustomNewMatch({ homeTeam: "", awayTeam: "", matchDate: "", matchTime: "" });
                                  await utils.admin.getCustomFootballMatches.invalidate();
                                } catch {
                                  toast.error("שגיאה");
                                }
                              }}
                            >
                              <Input placeholder="קבוצה ביתית" className="bg-slate-800 text-white w-32" value={footballCustomNewMatch.homeTeam} onChange={(e) => setFootballCustomNewMatch((p) => ({ ...p, homeTeam: e.target.value }))} />
                              <Input placeholder="קבוצה אורחת" className="bg-slate-800 text-white w-32" value={footballCustomNewMatch.awayTeam} onChange={(e) => setFootballCustomNewMatch((p) => ({ ...p, awayTeam: e.target.value }))} />
                              <Input type="date" placeholder="dd/mm/yyyy" title="dd/mm/yyyy" className="bg-slate-800 text-white w-36" value={footballCustomNewMatch.matchDate} onChange={(e) => setFootballCustomNewMatch((p) => ({ ...p, matchDate: e.target.value }))} />
                              <Input type="time" placeholder="שעה" className="bg-slate-800 text-white w-28" value={footballCustomNewMatch.matchTime} onChange={(e) => setFootballCustomNewMatch((p) => ({ ...p, matchTime: e.target.value }))} />
                              <Button type="submit" size="sm" disabled={addCustomFootballMatchMut.isPending}>הוסף משחק</Button>
                            </form>
                            {customFootballMatches && customFootballMatches.length > 0 && (
                              <>
                                <h4 className="text-amber-400 text-sm font-medium">משחקים – עדכון תוצאות</h4>
                                <div className="space-y-2">
                                  {customFootballMatches.map((m) => (
                                    <div key={m.id} className="flex flex-wrap items-center gap-2 p-2 rounded bg-slate-800/50">
                                      <span className="text-slate-300 text-sm min-w-[140px]">{m.homeTeam} – {m.awayTeam}</span>
                                      <Input type="number" min={0} className="bg-slate-800 text-white w-14 text-center" placeholder="בית" value={footballCustomResultEdit[m.id]?.homeScore ?? (m.homeScore != null ? String(m.homeScore) : "")} onChange={(e) => setFootballCustomResultEdit((p) => ({ ...p, [m.id]: { ...(p[m.id] ?? {}), homeScore: e.target.value } }))} />
                                      <span className="text-slate-500">-</span>
                                      <Input type="number" min={0} className="bg-slate-800 text-white w-14 text-center" placeholder="חוץ" value={footballCustomResultEdit[m.id]?.awayScore ?? (m.awayScore != null ? String(m.awayScore) : "")} onChange={(e) => setFootballCustomResultEdit((p) => ({ ...p, [m.id]: { ...(p[m.id] ?? {}), awayScore: e.target.value } }))} />
                                      <Button
                                        size="sm"
                                        onClick={async () => {
                                          const h = footballCustomResultEdit[m.id]?.homeScore != null ? parseInt(footballCustomResultEdit[m.id].homeScore, 10) : m.homeScore;
                                          const a = footballCustomResultEdit[m.id]?.awayScore != null ? parseInt(footballCustomResultEdit[m.id].awayScore, 10) : m.awayScore;
                                          if (h == null || a == null || isNaN(h) || isNaN(a)) {
                                            toast.error("הזן תוצאה למשחק");
                                            return;
                                          }
                                          try {
                                            await updateCustomFootballMatchResultMut.mutateAsync({ matchId: m.id, homeScore: h, awayScore: a });
                                            toast.success("תוצאה נשמרה, נקודות חושבו מחדש");
                                            await utils.admin.getCustomFootballMatches.invalidate();
                                            await utils.admin.getCustomFootballLeaderboard.invalidate();
                                          } catch {
                                            toast.error("שגיאה");
                                          }
                                        }}
                                        disabled={updateCustomFootballMatchResultMut.isPending}
                                      >
                                        שמור תוצאה
                                      </Button>
                                      <Button size="sm" variant="outline" className="text-red-400" onClick={async () => {
                                        if (!confirm("למחוק משחק?")) return;
                                        try {
                                          await deleteCustomFootballMatchMut.mutateAsync({ matchId: m.id });
                                          toast.success("משחק נמחק");
                                          await utils.admin.getCustomFootballMatches.invalidate();
                                        } catch {
                                          toast.error("שגיאה");
                                        }
                                      }} disabled={deleteCustomFootballMatchMut.isPending}><Trash2 className="w-4 h-4" /></Button>
                                    </div>
                                  ))}
                                </div>
                                <Button size="sm" variant="outline" onClick={async () => {
                                  try {
                                    await recalcCustomFootballPointsMut.mutateAsync({ tournamentId: t.id });
                                    toast.success("נקודות חושבו מחדש");
                                    await utils.admin.getCustomFootballLeaderboard.invalidate();
                                  } catch {
                                    toast.error("שגיאה");
                                  }
                                }} disabled={recalcCustomFootballPointsMut.isPending}>חשב מחדש נקודות</Button>
                              </>
                            )}
                            {customFootballMatches && customFootballLeaderboard && (
                              <div className="border-t border-slate-600 pt-3">
                                <h4 className="text-amber-400 text-sm font-medium mb-2">דירוג</h4>
                                <div className="overflow-x-auto">
                                  <table className="w-full text-sm text-right">
                                    <thead>
                                      <tr className="text-slate-400">
                                        <th className="p-2">מיקום</th>
                                        <th className="p-2">שם</th>
                                        <th className="p-2">ניחושים נכונים</th>
                                        <th className="p-2">נקודות</th>
                                        <th className="p-2">זכייה</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {customFootballLeaderboard.rows.map((r) => (
                                        <tr key={r.submissionId} className="border-t border-slate-700">
                                          <td className="p-2 text-white">{r.rank}</td>
                                          <td className="p-2 text-white">{r.username}</td>
                                          <td className="p-2 text-slate-300">{r.correctCount}</td>
                                          <td className="p-2 text-amber-400">{r.points}</td>
                                          <td className="p-2 text-emerald-400">₪{r.prizeAmount.toLocaleString("he-IL")}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                                <p className="text-slate-500 text-xs mt-2">קופת פרסים: ₪{customFootballLeaderboard.prizePool.toLocaleString("he-IL")} • {customFootballLeaderboard.winnerCount} זוכים</p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        </div>
      </main>
    </div>
  );
}
