/**
 * Phase 8: Admin CRUD for universal competition item sets and items.
 * Lists DB-backed sets (editable) and resolved legacy sets (read-only).
 */

import { useState } from "react";
import { Loader2, Plus, Pencil, Trash2, ChevronRight } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
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
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { toast } from "sonner";

interface CompetitionItemsManageModalProps {
  tournamentId: number;
  tournamentName?: string;
  onClose: () => void;
}

type SetRow = { id: number; title: string; description?: string | null; itemType: string; sourceType: string; sortOrder: number };
type ItemRow = { id: number; title: string; subtitle?: string | null; itemKind: string; sortOrder: number; status: string };

const SOURCE_LABELS: Record<string, string> = {
  universal_db: "DB (עריכה)",
  legacy_worldcup: "ליגה (legacy)",
  legacy_custom_matches: "משחקים מותאמים (legacy)",
  legacy_lotto: "לוטו (legacy)",
  legacy_chance: "צ'אנס (legacy)",
};

function safeJsonString(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "object") return JSON.stringify(v, null, 2);
  return String(v);
}

export function CompetitionItemsManageModal({
  tournamentId,
  tournamentName,
  onClose,
}: CompetitionItemsManageModalProps) {
  const [selectedSetId, setSelectedSetId] = useState<number | null>(null);
  const [setFormOpen, setSetFormOpen] = useState<boolean>(false);
  const [setEditId, setSetEditId] = useState<number | null>(null);
  const [itemFormOpen, setItemFormOpen] = useState<boolean>(false);
  const [itemEditId, itemEditIdSet] = useState<number | null>(null);
  const [deleteSetId, setDeleteSetId] = useState<number | null>(null);
  const [deleteItemId, setDeleteItemId] = useState<number | null>(null);

  const utils = trpc.useUtils();
  const { data: dbSets, isLoading: setsLoading } = trpc.admin.getCompetitionItemSets.useQuery(
    { tournamentId },
    { enabled: true }
  );
  const { data: resolvedLegacy } = trpc.admin.getResolvedTournamentItems.useQuery(
    { tournamentId },
    { enabled: true }
  );
  const { data: setItems, isLoading: itemsLoading } = trpc.admin.getCompetitionItemsBySet.useQuery(
    { itemSetId: selectedSetId! },
    { enabled: selectedSetId != null }
  );

  const createSetMut = trpc.admin.createCompetitionItemSet.useMutation({
    onSuccess: () => {
      utils.admin.getCompetitionItemSets.invalidate({ tournamentId });
      setSetFormOpen(false);
      setSetForm({ title: "", description: "", itemType: "custom", sortOrder: 0, metadataJson: "" });
      toast.success("הסט נוצר");
    },
    onError: (e) => toast.error(e.message),
  });
  const updateSetMut = trpc.admin.updateCompetitionItemSet.useMutation({
    onSuccess: () => {
      utils.admin.getCompetitionItemSets.invalidate({ tournamentId });
      setSetFormOpen(false);
      setSetEditId(null);
      toast.success("הסט עודכן");
    },
    onError: (e) => toast.error(e.message),
  });
  const deleteSetMut = trpc.admin.deleteCompetitionItemSet.useMutation({
    onSuccess: () => {
      utils.admin.getCompetitionItemSets.invalidate({ tournamentId });
      setDeleteSetId(null);
      if (deleteSetId === selectedSetId) setSelectedSetId(null);
      toast.success("הסט נמחק");
    },
    onError: (e) => toast.error(e.message),
  });
  const createItemMut = trpc.admin.createCompetitionItem.useMutation({
    onSuccess: () => {
      if (selectedSetId) utils.admin.getCompetitionItemsBySet.invalidate({ itemSetId: selectedSetId });
      setItemFormOpen(false);
      resetItemForm();
      toast.success("הפריט נוצר");
    },
    onError: (e) => toast.error(e.message),
  });
  const updateItemMut = trpc.admin.updateCompetitionItem.useMutation({
    onSuccess: () => {
      if (selectedSetId) utils.admin.getCompetitionItemsBySet.invalidate({ itemSetId: selectedSetId });
      setItemFormOpen(false);
      itemEditIdSet(null);
      resetItemForm();
      toast.success("הפריט עודכן");
    },
    onError: (e) => toast.error(e.message),
  });
  const deleteItemMut = trpc.admin.deleteCompetitionItem.useMutation({
    onSuccess: () => {
      if (selectedSetId) utils.admin.getCompetitionItemsBySet.invalidate({ itemSetId: selectedSetId });
      setDeleteItemId(null);
      toast.success("הפריט נמחק");
    },
    onError: (e) => toast.error(e.message),
  });

  const [setForm, setSetForm] = useState({ title: "", description: "", itemType: "custom", sortOrder: 0, metadataJson: "" });
  const [itemForm, setItemForm] = useState({
    title: "",
    subtitle: "",
    itemKind: "custom",
    sortOrder: 0,
    status: "open",
    optionSchemaJson: "",
    resultSchemaJson: "",
    metadataJson: "",
  });

  function resetItemForm() {
    setItemForm({
      title: "",
      subtitle: "",
      itemKind: "custom",
      sortOrder: 0,
      status: "open",
      optionSchemaJson: "",
      resultSchemaJson: "",
      metadataJson: "",
    });
  }

  const selectedSet = selectedSetId != null ? (dbSets ?? []).find((s) => s.id === selectedSetId) : null;

  return (
    <>
      <Dialog open onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-slate-900 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white">
              ניהול פריטי תחרות — {tournamentName ?? `#${tournamentId}`}
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              סטים שמורים ב-DB (ניתנים לעריכה) ופריטים שמוחזרים מ-legacy (לקריאה בלבד).
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* DB Item sets */}
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <span className="text-sm font-medium text-slate-300">סטים ב-DB (עריכה)</span>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-slate-600"
                  onClick={() => {
                    setSetEditId(null);
                    setSetForm({ title: "", description: "", itemType: "custom", sortOrder: 0, metadataJson: "" });
                    setSetFormOpen(true);
                  }}
                >
                  <Plus className="w-4 h-4 ml-1" /> הוסף סט
                </Button>
              </CardHeader>
              <CardContent>
                {setsLoading ? (
                  <p className="text-slate-500 text-sm py-2">טוען...</p>
                ) : !dbSets?.length ? (
                  <p className="text-slate-500 text-sm py-2">אין סטים. הוסף סט כדי לנהל פריטים.</p>
                ) : (
                  <ul className="space-y-1">
                    {(dbSets as SetRow[]).map((s) => (
                      <li
                        key={s.id}
                        className="flex items-center justify-between rounded p-2 bg-slate-900/50 border border-slate-700 group"
                      >
                        <button
                          type="button"
                          className="flex-1 text-left text-white text-sm flex items-center gap-2"
                          onClick={() => setSelectedSetId(s.id)}
                        >
                          <ChevronRight className="w-4 h-4 text-slate-500" />
                          {s.title}
                          <span className="text-slate-500 text-xs">({s.itemType})</span>
                        </button>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0"
                            onClick={() => {
                              setSetEditId(s.id);
                              setSetForm({
                                title: s.title,
                                description: s.description ?? "",
                                itemType: s.itemType,
                                sortOrder: s.sortOrder,
                                metadataJson: safeJsonString((s as { metadataJson?: unknown }).metadataJson),
                              });
                              setSetFormOpen(true);
                            }}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 text-red-400"
                            onClick={() => setDeleteSetId(s.id)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            {/* Resolved legacy (read-only) */}
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <span className="text-sm font-medium text-slate-300">מקורות Legacy (לקריאה)</span>
              </CardHeader>
              <CardContent>
                {!resolvedLegacy?.length ? (
                  <p className="text-slate-500 text-sm py-2">אין סטים שמוחזרים מ-legacy לתחרות זו.</p>
                ) : (
                  <ul className="space-y-1">
                    {resolvedLegacy.map((set) => (
                      <li key={set.id} className="rounded p-2 bg-slate-900/50 border border-slate-700 text-sm">
                        <span className="text-white font-medium">{set.title}</span>
                        <span className="text-slate-500 text-xs mr-2">
                          — {SOURCE_LABELS[set.sourceLabel ?? ""] ?? set.sourceLabel ?? set.sourceType} · {set.items.length} פריטים
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Items in selected set */}
          {selectedSetId != null && selectedSet && (
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <span className="text-sm font-medium text-slate-300">פריטים: {selectedSet.title}</span>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-slate-600"
                  onClick={() => {
                    itemEditIdSet(null);
                    resetItemForm();
                    setItemFormOpen(true);
                  }}
                >
                  <Plus className="w-4 h-4 ml-1" /> הוסף פריט
                </Button>
              </CardHeader>
              <CardContent>
                {itemsLoading ? (
                  <p className="text-slate-500 text-sm py-2">טוען פריטים...</p>
                ) : !setItems?.length ? (
                  <p className="text-slate-500 text-sm py-2">אין פריטים בסט זה.</p>
                ) : (
                  <ul className="space-y-1">
                    {(setItems as ItemRow[]).map((it) => (
                      <li
                        key={it.id}
                        className="flex items-center justify-between rounded p-2 bg-slate-900/50 border border-slate-700 group"
                      >
                        <span className="text-white text-sm">{it.title}</span>
                        <span className="text-slate-500 text-xs">{it.itemKind} · {it.status}</span>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0"
                            onClick={() => {
                              const row = it as ItemRow & {
                                subtitle?: string | null;
                                optionSchemaJson?: unknown;
                                resultSchemaJson?: unknown;
                                metadataJson?: unknown;
                              };
                              itemEditIdSet(it.id);
                              setItemForm({
                                title: it.title,
                                subtitle: row.subtitle ?? "",
                                itemKind: it.itemKind,
                                sortOrder: it.sortOrder,
                                status: it.status,
                                optionSchemaJson: safeJsonString(row.optionSchemaJson),
                                resultSchemaJson: safeJsonString(row.resultSchemaJson),
                                metadataJson: safeJsonString(row.metadataJson),
                              });
                              setItemFormOpen(true);
                            }}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 text-red-400"
                            onClick={() => setDeleteItemId(it.id)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          )}
        </DialogContent>
      </Dialog>

      {/* Create/Edit Set form */}
      <Dialog open={setFormOpen} onOpenChange={setSetFormOpen}>
        <DialogContent className="bg-slate-900 border-slate-700 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">{setEditId != null ? "עריכת סט" : "סט חדש"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-slate-300">כותרת</Label>
              <Input
                className="bg-slate-800 border-slate-600 text-white mt-1"
                value={setForm.title}
                onChange={(e) => setSetForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="שם הסט"
              />
            </div>
            <div>
              <Label className="text-slate-300">תיאור</Label>
              <Input
                className="bg-slate-800 border-slate-600 text-white mt-1"
                value={setForm.description}
                onChange={(e) => setSetForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="אופציונלי"
              />
            </div>
            <div>
              <Label className="text-slate-300">סוג (itemType)</Label>
              <Input
                className="bg-slate-800 border-slate-600 text-white mt-1"
                value={setForm.itemType}
                onChange={(e) => setSetForm((f) => ({ ...f, itemType: e.target.value || "custom" }))}
                placeholder="custom"
              />
            </div>
            <div>
              <Label className="text-slate-300">סדר (sortOrder)</Label>
              <Input
                type="number"
                className="bg-slate-800 border-slate-600 text-white mt-1"
                value={setForm.sortOrder}
                onChange={(e) => setSetForm((f) => ({ ...f, sortOrder: parseInt(e.target.value, 10) || 0 }))}
              />
            </div>
            <div>
              <Label className="text-slate-300">metadata (JSON)</Label>
              <Textarea
                className="bg-slate-800 border-slate-600 text-white mt-1 font-mono text-xs min-h-[80px]"
                value={setForm.metadataJson}
                onChange={(e) => setSetForm((f) => ({ ...f, metadataJson: e.target.value }))}
                placeholder="{}"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="border-slate-600" onClick={() => setSetFormOpen(false)}>
              ביטול
            </Button>
            <Button
              disabled={!setForm.title.trim() || createSetMut.isPending || updateSetMut.isPending}
              onClick={() => {
                if (setEditId != null) {
                  updateSetMut.mutate({
                    id: setEditId,
                    title: setForm.title.trim(),
                    description: setForm.description?.trim() || null,
                    itemType: setForm.itemType.trim() || "custom",
                    sortOrder: setForm.sortOrder,
                    metadataJson: setForm.metadataJson.trim() || null,
                  });
                } else {
                  createSetMut.mutate({
                    tournamentId,
                    title: setForm.title.trim(),
                    description: setForm.description?.trim() || null,
                    itemType: setForm.itemType.trim() || "custom",
                    sortOrder: setForm.sortOrder,
                    metadataJson: setForm.metadataJson.trim() || null,
                  });
                }
              }}
            >
              {(createSetMut.isPending || updateSetMut.isPending) && <Loader2 className="w-4 h-4 animate-spin ml-1" />}
              {setEditId != null ? "שמירה" : "צור סט"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create/Edit Item form */}
      <Dialog open={itemFormOpen} onOpenChange={setItemFormOpen}>
        <DialogContent className="bg-slate-900 border-slate-700 max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white">{itemEditId != null ? "עריכת פריט" : "פריט חדש"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-slate-300">כותרת</Label>
              <Input
                className="bg-slate-800 border-slate-600 text-white mt-1"
                value={itemForm.title}
                onChange={(e) => setItemForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="כותרת הפריט"
              />
            </div>
            <div>
              <Label className="text-slate-300">כותרת משנה</Label>
              <Input
                className="bg-slate-800 border-slate-600 text-white mt-1"
                value={itemForm.subtitle}
                onChange={(e) => setItemForm((f) => ({ ...f, subtitle: e.target.value }))}
                placeholder="אופציונלי"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-slate-300">סוג (itemKind)</Label>
                <Input
                  className="bg-slate-800 border-slate-600 text-white mt-1"
                  value={itemForm.itemKind}
                  onChange={(e) => setItemForm((f) => ({ ...f, itemKind: e.target.value || "custom" }))}
                />
              </div>
              <div>
                <Label className="text-slate-300">סטטוס</Label>
                <Input
                  className="bg-slate-800 border-slate-600 text-white mt-1"
                  value={itemForm.status}
                  onChange={(e) => setItemForm((f) => ({ ...f, status: e.target.value || "open" }))}
                  placeholder="open"
                />
              </div>
            </div>
            <div>
              <Label className="text-slate-300">סדר (sortOrder)</Label>
              <Input
                type="number"
                className="bg-slate-800 border-slate-600 text-white mt-1"
                value={itemForm.sortOrder}
                onChange={(e) => setItemForm((f) => ({ ...f, sortOrder: parseInt(e.target.value, 10) || 0 }))}
              />
            </div>
            <div>
              <Label className="text-slate-300">optionSchemaJson (JSON)</Label>
              <Textarea
                className="bg-slate-800 border-slate-600 text-white mt-1 font-mono text-xs min-h-[60px]"
                value={itemForm.optionSchemaJson}
                onChange={(e) => setItemForm((f) => ({ ...f, optionSchemaJson: e.target.value }))}
                placeholder="{}"
              />
            </div>
            <div>
              <Label className="text-slate-300">resultSchemaJson (JSON)</Label>
              <Textarea
                className="bg-slate-800 border-slate-600 text-white mt-1 font-mono text-xs min-h-[60px]"
                value={itemForm.resultSchemaJson}
                onChange={(e) => setItemForm((f) => ({ ...f, resultSchemaJson: e.target.value }))}
                placeholder="{}"
              />
            </div>
            <div>
              <Label className="text-slate-300">metadataJson (JSON)</Label>
              <Textarea
                className="bg-slate-800 border-slate-600 text-white mt-1 font-mono text-xs min-h-[60px]"
                value={itemForm.metadataJson}
                onChange={(e) => setItemForm((f) => ({ ...f, metadataJson: e.target.value }))}
                placeholder="{}"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="border-slate-600" onClick={() => setItemFormOpen(false)}>
              ביטול
            </Button>
            <Button
              disabled={!itemForm.title.trim() || !selectedSetId || createItemMut.isPending || updateItemMut.isPending}
              onClick={() => {
                if (!selectedSetId) return;
                const payload = {
                  title: itemForm.title.trim(),
                  subtitle: itemForm.subtitle?.trim() || null,
                  itemKind: itemForm.itemKind.trim() || "custom",
                  sortOrder: itemForm.sortOrder,
                  status: itemForm.status.trim() || "open",
                  optionSchemaJson: itemForm.optionSchemaJson.trim() || null,
                  resultSchemaJson: itemForm.resultSchemaJson.trim() || null,
                  metadataJson: itemForm.metadataJson.trim() || null,
                };
                if (itemEditId != null) {
                  updateItemMut.mutate({ id: itemEditId, ...payload });
                } else {
                  createItemMut.mutate({ itemSetId: selectedSetId, ...payload });
                }
              }}
            >
              {(createItemMut.isPending || updateItemMut.isPending) && <Loader2 className="w-4 h-4 animate-spin ml-1" />}
              {itemEditId != null ? "שמירה" : "צור פריט"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete set confirm */}
      <AlertDialog open={deleteSetId != null} onOpenChange={(open) => !open && setDeleteSetId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>מחיקת סט</AlertDialogTitle>
            <AlertDialogDescription>כל הפריטים בסט יימחקו. להמשיך?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ביטול</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => deleteSetId != null && deleteSetMut.mutate({ id: deleteSetId })}
            >
              מחק
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete item confirm */}
      <AlertDialog open={deleteItemId != null} onOpenChange={(open) => !open && setDeleteItemId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>מחיקת פריט</AlertDialogTitle>
            <AlertDialogDescription>למחוק פריט זה?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ביטול</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => deleteItemId != null && deleteItemMut.mutate({ id: deleteItemId })}
            >
              מחק
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
