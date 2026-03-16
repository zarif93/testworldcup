/**
 * Team library for football_custom (תחרויות ספורט) only.
 * Categories + teams with live search. Used only in admin when competition sub-type is football_custom.
 */

import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { Loader2, FolderOpen, Plus, Pencil, Trash2, ArrowRight } from "lucide-react";
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
import { toast } from "sonner";

/** Backend scope: team library is only for football_custom. Must match server/teamLibraryScope.ts */
const TEAM_LIBRARY_SCOPE = "football_custom" as const;
const SEARCH_DEBOUNCE_MS = 200;

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState<T>(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

type Props = { onBack?: () => void };

export function TeamLibrarySection({ onBack }: Props) {
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [teamSearch, setTeamSearch] = useState("");
  const debouncedSearch = useDebouncedValue(teamSearch.trim(), SEARCH_DEBOUNCE_MS);
  const [newTeamName, setNewTeamName] = useState("");
  const [editingTeamId, setEditingTeamId] = useState<number | null>(null);
  const [editingTeamName, setEditingTeamName] = useState("");
  const [deleteConfirmTeam, setDeleteConfirmTeam] = useState<{ id: number; name: string } | null>(null);

  const utils = trpc.useUtils();

  const { data: categories = [], isLoading: categoriesLoading } = trpc.admin.listTeamLibraryCategories.useQuery(
    { scope: TEAM_LIBRARY_SCOPE },
    { enabled: true }
  );

  const { data: teams = [], isLoading: teamsLoading } = trpc.admin.listTeamLibraryTeams.useQuery(
    { scope: TEAM_LIBRARY_SCOPE, categoryId: selectedCategoryId!, search: debouncedSearch || undefined },
    { enabled: typeof selectedCategoryId === "number" }
  );

  const createTeamMut = trpc.admin.createTeamLibraryTeam.useMutation({
    onSuccess: () => {
      setNewTeamName("");
      utils.admin.listTeamLibraryTeams.invalidate({ scope: TEAM_LIBRARY_SCOPE, categoryId: selectedCategoryId! });
      toast.success("הקבוצה נוספה");
    },
    onError: (e) => toast.error(e.message || "שגיאה"),
  });

  const updateTeamMut = trpc.admin.updateTeamLibraryTeam.useMutation({
    onSuccess: () => {
      setEditingTeamId(null);
      setEditingTeamName("");
      utils.admin.listTeamLibraryTeams.invalidate({ scope: TEAM_LIBRARY_SCOPE, categoryId: selectedCategoryId! });
      toast.success("הקבוצה עודכנה");
    },
    onError: (e) => toast.error(e.message || "שגיאה"),
  });

  const deleteTeamMut = trpc.admin.deleteTeamLibraryTeam.useMutation({
    onSuccess: () => {
      setDeleteConfirmTeam(null);
      utils.admin.listTeamLibraryTeams.invalidate({ scope: TEAM_LIBRARY_SCOPE, categoryId: selectedCategoryId! });
      toast.success("הקבוצה נמחקה");
    },
    onError: (e) => toast.error(e.message || "שגיאה"),
  });

  const selectedCategory = useMemo(
    () => categories.find((c) => c.id === selectedCategoryId),
    [categories, selectedCategoryId]
  );

  return (
    <Card className="bg-slate-800/50 border-slate-700">
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <div>
          <CardTitle className="text-xl font-bold text-white flex items-center gap-2">
            <FolderOpen className="w-6 h-6 text-amber-400" />
            ספריית קבוצות (תחרויות ספורט)
          </CardTitle>
          <CardDescription className="text-slate-400 text-sm">
            קטגוריות וקבוצות לשימוש בתחרויות ספורט בלבד. לא משפיע על מונדיאל, לוטו או צ'אנס.
          </CardDescription>
        </div>
        {onBack && (
          <Button variant="outline" size="sm" className="text-slate-400 shrink-0" onClick={onBack}>
            ← חזרה
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-6">
        {categoriesLoading ? (
          <div className="flex items-center gap-2 text-slate-400">
            <Loader2 className="w-4 h-4 animate-spin" />
            טוען קטגוריות...
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h3 className="text-white font-medium mb-2">קטגוריות</h3>
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => {
                      setSelectedCategoryId(cat.id);
                      setTeamSearch("");
                      setEditingTeamId(null);
                      setNewTeamName("");
                    }}
                    className={`w-full text-right px-3 py-2 rounded-lg transition-colors flex items-center justify-between gap-2 ${
                      selectedCategoryId === cat.id ? "bg-amber-600/80 text-white" : "bg-slate-700/50 text-slate-300 hover:bg-slate-700"
                    }`}
                  >
                    <span>{cat.name}</span>
                    <ArrowRight className="w-4 h-4 shrink-0 opacity-70" />
                  </button>
                ))}
              </div>
            </div>

            <div>
              {selectedCategoryId == null ? (
                <p className="text-slate-500 text-sm">בחר קטגוריה כדי לראות ולהוסיף קבוצות.</p>
              ) : (
                <>
                  <h3 className="text-white font-medium mb-2">קבוצות – {selectedCategory?.name ?? ""}</h3>
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                      <Input
                        placeholder="חיפוש קבוצות (למשל: אש)"
                        className="bg-slate-800 text-white max-w-xs"
                        value={teamSearch}
                        onChange={(e) => setTeamSearch(e.target.value)}
                        dir="rtl"
                      />
                    </div>
                    <form
                      className="flex flex-wrap gap-2 items-center"
                      onSubmit={(e) => {
                        e.preventDefault();
                        const name = newTeamName.trim();
                        if (!name) {
                          toast.error("הזן שם קבוצה");
                          return;
                        }
                        createTeamMut.mutate({ scope: TEAM_LIBRARY_SCOPE, categoryId: selectedCategoryId, name });
                      }}
                    >
                      <Input
                        placeholder="שם קבוצה חדשה"
                        className="bg-slate-800 text-white w-48"
                        value={newTeamName}
                        onChange={(e) => setNewTeamName(e.target.value)}
                        dir="rtl"
                      />
                      <Button type="submit" size="sm" disabled={createTeamMut.isPending}>
                        {createTeamMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                        הוסף קבוצה
                      </Button>
                    </form>
                    {teamsLoading ? (
                      <div className="flex items-center gap-2 text-slate-400 py-4">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        טוען...
                      </div>
                    ) : teams.length === 0 ? (
                      <p className="text-slate-500 text-sm py-2">
                        {debouncedSearch ? "אין קבוצות התואמות את החיפוש." : "אין עדיין קבוצות בקטגוריה זו."}
                      </p>
                    ) : (
                      <ul className="space-y-1 border border-slate-600 rounded-lg p-2 max-h-72 overflow-y-auto">
                        {teams.map((team) => (
                          <li
                            key={team.id}
                            className="flex flex-wrap items-center gap-2 py-1.5 px-2 rounded bg-slate-700/30 hover:bg-slate-700/50"
                          >
                            {editingTeamId === team.id ? (
                              <>
                                <Input
                                  className="bg-slate-800 text-white flex-1 min-w-0 max-w-[200px]"
                                  value={editingTeamName}
                                  onChange={(e) => setEditingTeamName(e.target.value)}
                                  dir="rtl"
                                  autoFocus
                                />
                                <Button
                                  size="sm"
                                  onClick={() => {
                                    const name = editingTeamName.trim();
                                    if (!name) {
                                      toast.error("הזן שם");
                                      return;
                                    }
                                    updateTeamMut.mutate({ scope: TEAM_LIBRARY_SCOPE, teamId: team.id, name });
                                  }}
                                  disabled={updateTeamMut.isPending}
                                >
                                  {updateTeamMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "שמור"}
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => { setEditingTeamId(null); setEditingTeamName(""); }}>
                                  ביטול
                                </Button>
                              </>
                            ) : (
                              <>
                                <span className="text-slate-200 flex-1 min-w-0 truncate" dir="rtl">{team.name}</span>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-slate-400 hover:text-white h-8 w-8 p-0"
                                  onClick={() => {
                                    setEditingTeamId(team.id);
                                    setEditingTeamName(team.name);
                                  }}
                                  title="ערוך שם"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-red-400 hover:text-red-300 hover:bg-red-500/20 h-8 w-8 p-0"
                                  onClick={() => setDeleteConfirmTeam({ id: team.id, name: team.name })}
                                  title="מחק"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </CardContent>

      <AlertDialog open={!!deleteConfirmTeam} onOpenChange={(open) => !open && setDeleteConfirmTeam(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>מחיקת קבוצה</AlertDialogTitle>
            <AlertDialogDescription>
              האם למחוק את הקבוצה &quot;{deleteConfirmTeam?.name}&quot;? לא ניתן לשחזר.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ביטול</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => deleteConfirmTeam && deleteTeamMut.mutate({ scope: TEAM_LIBRARY_SCOPE, teamId: deleteConfirmTeam.id })}
              disabled={deleteTeamMut.isPending}
            >
              {deleteTeamMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "מחק"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
