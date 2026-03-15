import { useMemo, useState } from "react";
import { Lock, Trash2, Code, ListChecks } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getCompetitionTypeDisplayName, type CompetitionTypeFromApi } from "@/lib/competitionTypeDisplay";

export interface TournamentRow {
  id: number;
  name: string;
  amount: number;
  type?: string | null;
  competitionTypeId?: number | null;
  status?: string | null;
  isLocked?: boolean | null;
  opensAt?: unknown;
  closesAt?: unknown;
  createdAt?: unknown;
}

interface CompetitionsTableProps {
  tournaments: TournamentRow[];
  typesFromApi: CompetitionTypeFromApi[] | undefined;
  submissionCountByTournamentId: Record<number, number> | Map<number, number>;
  onLock: (tournamentId: number, locked: boolean) => void;
  onDelete: (tournamentId: number, name: string) => void;
  /** Phase 2C: optional debug – show resolved schema for this tournament */
  onViewSchema?: (tournamentId: number) => void;
  /** Phase 8: manage universal competition item sets/items for this tournament */
  onViewItems?: (tournamentId: number, tournamentName: string) => void;
  isLoading?: boolean;
}

const STATUS_LABELS: Record<string, string> = {
  OPEN: "פתוח",
  LOCKED: "נעול",
  UPCOMING: "עתידי",
  CLOSED: "סגור",
  SETTLED: "הושלם",
  ARCHIVED: "בארכיון",
};

export function CompetitionsTable({
  tournaments,
  typesFromApi,
  submissionCountByTournamentId,
  onLock,
  onDelete,
  onViewSchema,
  onViewItems,
  isLoading,
}: CompetitionsTableProps) {
  const [typeFilter, setTypeFilter] = useState<string>("");

  const countFor = (tid: number): number => {
    if (submissionCountByTournamentId instanceof Map) return submissionCountByTournamentId.get(tid) ?? 0;
    return (submissionCountByTournamentId as Record<number, number>)[tid] ?? 0;
  };

  const filtered = useMemo(() => {
    if (!typeFilter) return tournaments;
    return tournaments.filter((t) => (t.type ?? "football") === typeFilter);
  }, [tournaments, typeFilter]);

  const formatDate = (v: unknown) => {
    if (v == null) return "—";
    const d = typeof v === "number" ? new Date(v) : new Date(v as string);
    return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit", year: "numeric" });
  };

  return (
    <Card className="bg-slate-800/50 border-slate-700">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-4">
        <h3 className="text-lg font-semibold text-white">רשימת תחרויות</h3>
        <div className="flex items-center gap-2">
          <span className="text-slate-400 text-sm">סינון לפי סוג:</span>
          <select
            className="rounded-lg px-3 py-2 bg-slate-800 text-white border border-slate-600 text-sm"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="">כל הסוגים</option>
            {(typesFromApi ?? []).map((t) => (
              <option key={t.id} value={t.code}>{t.name ?? t.code}</option>
            ))}
          </select>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-slate-500 py-8 text-center">טוען...</p>
        ) : filtered.length === 0 ? (
          <p className="text-slate-500 py-8 text-center">
            {typeFilter ? "אין תחרויות בסוג זה." : "אין תחרויות."}
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-700">
            <Table>
              <TableHeader>
                <TableRow className="border-slate-700 hover:bg-transparent">
                  <TableHead className="text-slate-400">שם</TableHead>
                  <TableHead className="text-slate-400">סוג</TableHead>
                  <TableHead className="text-slate-400">סטטוס</TableHead>
                  <TableHead className="text-slate-400">עלות</TableHead>
                  <TableHead className="text-slate-400">משתתפים</TableHead>
                  <TableHead className="text-slate-400">תאריך</TableHead>
                  <TableHead className="text-slate-400 text-left">פעולות</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((t) => (
                  <TableRow key={t.id} className="border-slate-700">
                    <TableCell className="font-medium text-white">{t.name}</TableCell>
                    <TableCell className="text-slate-300">
                      {getCompetitionTypeDisplayName(
                        { competitionTypeId: t.competitionTypeId, type: t.type },
                        typesFromApi
                      )}
                    </TableCell>
                    <TableCell className="text-slate-300">
                      {STATUS_LABELS[t.status ?? ""] ?? t.status ?? "—"}
                    </TableCell>
                    <TableCell className="text-slate-300">{t.amount} נק׳</TableCell>
                    <TableCell className="text-slate-300">{countFor(t.id)}</TableCell>
                    <TableCell className="text-slate-300">{formatDate(t.createdAt ?? t.opensAt)}</TableCell>
                    <TableCell className="text-left">
                      <div className="flex gap-2 flex-wrap">
                        <Button
                          size="sm"
                          variant={t.isLocked ? "outline" : "default"}
                          className="h-8"
                          onClick={() => onLock(t.id, !t.isLocked)}
                        >
                          <Lock className="w-3.5 h-3.5 ml-1" />
                          {t.isLocked ? "פתח" : "נעל"}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-red-400 border-red-400/50 hover:bg-red-500/20"
                          onClick={() => onDelete(t.id, t.name)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                        {onViewSchema && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-slate-400 border-slate-600 hover:bg-slate-700/50"
                            onClick={() => onViewSchema(t.id)}
                            title="הצג schema (דיבאג)"
                          >
                            <Code className="w-3.5 h-3.5" />
                          </Button>
                        )}
                        {onViewItems && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-amber-400/80 border-amber-500/50 hover:bg-amber-500/20"
                            onClick={() => onViewItems(t.id, t.name)}
                            title="ניהול פריטי תחרות (Phase 8)"
                          >
                            <ListChecks className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
