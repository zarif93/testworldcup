/**
 * Admin: Jackpot hero background – upload, list, one active, reorder, overlay, preview.
 * Section: "ג׳קפוט – תמונת רקע". Production-ready: duplicate, dangerous delete, overlay control, preview simulation.
 */

import { useState, useRef, useEffect } from "react";
import { Loader2, Upload, Check, RefreshCw, Trash2, Eye, ImageIcon, Copy, ChevronUp, ChevronDown } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
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
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { getUploadErrorMessage, validateImageFile, uploadImage, MAX_JACKPOT_BACKGROUND_BYTES, ACCEPT_IMAGES } from "@/lib/uploadUtils";

type JackpotBgImage = {
  id: number;
  filename: string;
  thumbnailFilename: string | null;
  url: string;
  thumbnailUrl: string | null;
  isActive: boolean;
  displayOrder: number;
  createdAt: Date | null;
};

function formatDate(d: Date | null): string {
  if (!d) return "—";
  const date = d instanceof Date ? d : new Date(d);
  return date.toLocaleDateString("he-IL", { dateStyle: "short" }) + " " + date.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
}

function JackpotConversionDashboard({ images }: { images: JackpotBgImage[] }) {
  const { data: stats, isLoading } = trpc.admin.getJackpotConversionStats.useQuery(undefined, { staleTime: 60_000 });
  if (isLoading) return <div className="mt-2 text-slate-500 text-sm">טוען...</div>;
  if (!stats?.length) return <p className="mt-2 text-slate-500 text-sm">אין עדיין נתוני צפיות/לחיצות לרקעים.</p>;
  const idToLabel = (id: number) => images.find((i) => i.id === id)?.filename ?? `רקע #${id}`;
  return (
    <div className="mt-2 overflow-x-auto">
      <table className="w-full text-sm text-left text-slate-300">
        <thead>
          <tr className="border-b border-slate-600">
            <th className="py-2 pr-2">רקע</th>
            <th className="py-2 pr-2">צפיות</th>
            <th className="py-2 pr-2">לחיצות</th>
            <th className="py-2">CTR</th>
          </tr>
        </thead>
        <tbody>
          {stats.map((row) => (
            <tr key={row.backgroundId} className="border-b border-slate-700/50">
              <td className="py-1.5 pr-2 font-medium">{idToLabel(row.backgroundId)}</td>
              <td className="py-1.5 pr-2 tabular-nums">{row.views}</td>
              <td className="py-1.5 pr-2 tabular-nums">{row.clicks}</td>
              <td className="py-1.5 tabular-nums">{(row.ctr * 100).toFixed(2)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type DeleteConfirm = { id: number; isActive: boolean; name: string };

export function JackpotBackgroundSection() {
  const [uploading, setUploading] = useState(false);
  const [activateAfterUpload, setActivateAfterUpload] = useState(true);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirm | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const utils = trpc.useUtils();
  const { data: images, isLoading } = trpc.admin.listJackpotBackgroundImages.useQuery();
  const doUpload = async (file: File) => {
    setUploading(true);
    try {
      await uploadImage({ type: "jackpot-background", file, activate: activateAfterUpload });
      utils.admin.listJackpotBackgroundImages.invalidate();
      utils.settings.getActiveJackpotBackground.invalidate();
      toast.success("תמונת רקע הג׳קפוט הועלתה");
    } catch (e) {
      toast.error(getUploadErrorMessage(e));
    } finally {
      setUploading(false);
    }
  };
  const setActiveMut = trpc.admin.setActiveJackpotBackground.useMutation({
    onSuccess: () => {
      utils.admin.listJackpotBackgroundImages.invalidate();
      utils.settings.getActiveJackpotBackground.invalidate();
      toast.success("התמונה הופעלה");
    },
    onError: (e) => toast.error(e.message),
  });
  const deleteMut = trpc.admin.deleteJackpotBackgroundImage.useMutation({
    onSuccess: () => {
      setDeleteConfirm(null);
      utils.admin.listJackpotBackgroundImages.invalidate();
      utils.settings.getActiveJackpotBackground.invalidate();
      toast.success("התמונה נמחקה");
    },
    onError: (e) => toast.error(e.message),
  });
  const duplicateMut = trpc.admin.duplicateJackpotBackgroundImage.useMutation({
    onSuccess: () => {
      utils.admin.listJackpotBackgroundImages.invalidate();
      utils.settings.getActiveJackpotBackground.invalidate();
      toast.success("התמונה שוכפלה");
    },
    onError: (e) => toast.error(e.message),
  });
  const reorderMut = trpc.admin.reorderJackpotBackgroundImages.useMutation({
    onSuccess: () => {
      utils.admin.listJackpotBackgroundImages.invalidate();
      toast.success("הסדר עודכן");
    },
    onError: (e) => toast.error(e.message),
  });
  const overlayMut = trpc.admin.setJackpotBackgroundOverlay.useMutation({
    onSuccess: () => {
      utils.settings.getActiveJackpotBackground.invalidate();
      toast.success("עוצמת השכבות נשמרה");
    },
    onError: (e) => toast.error(e.message),
  });
  const { data: siteSettings } = trpc.admin.getSiteSettings.useQuery(undefined, { staleTime: 30_000 });

  const overlayOpacity = Math.min(100, Math.max(0, parseFloat(siteSettings?.jackpot_bg_overlay_opacity ?? "70") || 70));
  const vignetteStrength = Math.min(100, Math.max(0, parseFloat(siteSettings?.jackpot_bg_vignette_strength ?? "80") || 80));
  const fxIntensity = Math.min(100, Math.max(0, parseFloat(siteSettings?.jackpot_bg_fx_intensity ?? "80") || 80));
  const glowStrength = Math.min(100, Math.max(0, parseFloat(siteSettings?.jackpot_bg_glow_strength ?? "80") || 80));
  const intensity = Math.min(100, Math.max(0, parseInt(siteSettings?.jackpot_intensity ?? "70", 10) || 70));
  const preset = (siteSettings?.jackpot_bg_preset ?? "") as "" | "aggressive" | "luxury" | "calm" | "explosive";

  const [previewSimulationUrl, setPreviewSimulationUrl] = useState<string | null>(null);
  const [localOverlayOpacity, setLocalOverlayOpacity] = useState(overlayOpacity);
  const [localVignette, setLocalVignette] = useState(vignetteStrength);
  const [localFx, setLocalFx] = useState(fxIntensity);
  const [localGlow, setLocalGlow] = useState(glowStrength);
  const [localIntensity, setLocalIntensity] = useState(intensity);

  useEffect(() => {
    setLocalOverlayOpacity(overlayOpacity);
    setLocalVignette(vignetteStrength);
    setLocalFx(fxIntensity);
    setLocalGlow(glowStrength);
    setLocalIntensity(intensity);
  }, [overlayOpacity, vignetteStrength, fxIntensity, glowStrength, intensity]);

  const handleSaveOverlay = () => {
    overlayMut.mutate({
      overlayOpacity: localOverlayOpacity,
      vignetteStrength: localVignette,
      fxIntensity: localFx,
      glowStrength: localGlow,
      intensity: localIntensity,
    });
  };

  const handleApplyPreset = (p: "aggressive" | "luxury" | "calm" | "explosive") => {
    overlayMut.mutate({ preset: p }, {
      onSuccess: () => {
        utils.admin.getSiteSettings.invalidate();
      },
    });
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const validation = validateImageFile(file, MAX_JACKPOT_BACKGROUND_BYTES, ACCEPT_IMAGES);
    if (!validation.ok) {
      toast.error(validation.error);
      return;
    }
    doUpload(file);
    e.target.value = "";
  };

  const handleDeleteClick = (img: JackpotBgImage) => {
    setDeleteConfirm({ id: img.id, isActive: img.isActive, name: img.filename });
  };

  const handleDeleteConfirm = () => {
    if (deleteConfirm) deleteMut.mutate({ id: deleteConfirm.id });
  };

  const handleMove = (index: number, direction: "up" | "down") => {
    const list = (images ?? []) as JackpotBgImage[];
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= list.length) return;
    const reordered = [...list];
    [reordered[index], reordered[newIndex]] = [reordered[newIndex], reordered[index]];
    reorderMut.mutate({
      updates: reordered.map((img, i) => ({ id: img.id, displayOrder: list.length - 1 - i })),
    });
  };

  const list = (images ?? []) as JackpotBgImage[];

  return (
    <Card className="bg-slate-800/50 border-slate-700">
      <CardHeader>
        <h3 className="text-lg font-bold text-white">ג׳קפוט – תמונת רקע</h3>
        <p className="text-slate-400 text-sm font-normal">תמונת רקע לרכיב הג׳קפוט בדף הבית בלבד. לא משפיעה על רקע האתר הכללי.</p>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <Label className="text-slate-400">העלאת תמונת רקע לג׳קפוט (רוחב מינימלי 1200px, אוטומטית WebP)</Label>
          <input ref={fileRef} type="file" accept={ACCEPT_IMAGES} className="hidden" onChange={handleFile} />
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="outline"
              className="border-slate-600 text-slate-300"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? <Loader2 className="w-4 h-4 animate-spin ml-1" /> : <Upload className="w-4 h-4 ml-1" />}
              העלה תמונה (JPEG, PNG, GIF, WebP – עד 8MB, מינימום 1200px רוחב)
            </Button>
            <label className="flex items-center gap-2 text-slate-400 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={activateAfterUpload}
                onChange={(e) => setActivateAfterUpload(e.target.checked)}
                className="rounded border-slate-600"
              />
              הפעל מיד אחרי ההעלאה
            </label>
          </div>
        </div>

        <div className="rounded-lg border border-slate-700 bg-slate-900/40 p-4 space-y-4">
          <div>
            <Label className="text-slate-400">פריסת רגש (overlay / fx / glow / vignette)</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {(["aggressive", "luxury", "calm", "explosive"] as const).map((p) => (
                <Button
                  key={p}
                  type="button"
                  size="sm"
                  variant={preset === p ? "default" : "outline"}
                  className={preset === p ? "bg-amber-600 border-amber-500" : "border-slate-600 text-slate-300"}
                  onClick={() => handleApplyPreset(p)}
                  disabled={overlayMut.isPending}
                >
                  {p === "aggressive" && "אגרסיבי"}
                  {p === "luxury" && "יוקרה"}
                  {p === "calm" && "רגוע"}
                  {p === "explosive" && "פיצוץ"}
                </Button>
              ))}
            </div>
          </div>
          <div>
            <Label className="text-slate-400">עוצמה פסיכולוגית (0–100): תנועה, זוהר, קרן, דחיפות ספירה</Label>
            <div className="mt-2 flex items-center gap-3">
              <Slider
                value={[localIntensity]}
                onValueChange={([v]) => setLocalIntensity(v)}
                min={0}
                max={100}
                step={5}
                className="flex-1 max-w-xs"
              />
              <span className="text-slate-400 text-sm tabular-nums w-10">{localIntensity}</span>
            </div>
          </div>
          <div>
            <Label className="text-slate-400">עוצמת שכבות על גבי הרקע (חשיכה, וינייט, אפקטים, זוהר)</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-2">
              <div>
                <p className="text-xs text-slate-500 mb-1">חשיכת רקע (0–100%)</p>
                <Slider
                  value={[localOverlayOpacity]}
                  onValueChange={([v]) => setLocalOverlayOpacity(v)}
                  min={0}
                  max={100}
                  step={5}
                  className="w-full"
                />
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">וינייט (0–100%)</p>
                <Slider
                  value={[localVignette]}
                  onValueChange={([v]) => setLocalVignette(v)}
                  min={0}
                  max={100}
                  step={5}
                  className="w-full"
                />
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">אפקטי אור (0–100%)</p>
                <Slider
                  value={[localFx]}
                  onValueChange={([v]) => setLocalFx(v)}
                  min={0}
                  max={100}
                  step={5}
                  className="w-full"
                />
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">זוהר (0–100%)</p>
                <Slider
                  value={[localGlow]}
                  onValueChange={([v]) => setLocalGlow(v)}
                  min={0}
                  max={100}
                  step={5}
                  className="w-full"
                />
              </div>
            </div>
            <Button type="button" size="sm" variant="outline" className="border-slate-600 text-slate-300 mt-3" onClick={handleSaveOverlay} disabled={overlayMut.isPending}>
              {overlayMut.isPending ? <Loader2 className="w-4 h-4 animate-spin ml-1" /> : null}
              שמור עוצמת שכבות
            </Button>
          </div>
        </div>

        <div className="rounded-lg border border-slate-700 bg-slate-900/40 p-4">
          <Label className="text-slate-400">ממשק המרות (CTR לפי רקע)</Label>
          <JackpotConversionDashboard images={list} />
        </div>

        <div>
          <p className="text-slate-400 text-sm mb-2">היסטוריית תמונות ({list.length})</p>
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-10 h-10 animate-spin text-amber-500" />
            </div>
          ) : list.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-600 bg-slate-900/30 py-12 px-6 text-center">
              <ImageIcon className="mx-auto w-12 h-12 text-slate-500 mb-3" aria-hidden />
              <p className="text-slate-400 font-medium mb-1">אין עדיין תמונת רקע לג׳קפוט</p>
              <p className="text-slate-500 text-sm mb-4">העלה תמונה כדי שתשמש כרקע לרכיב הג׳קפוט בדף הבית.</p>
              <Button
                type="button"
                variant="outline"
                className="border-slate-600 text-slate-300"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? <Loader2 className="w-4 h-4 animate-spin ml-1" /> : <Upload className="w-4 h-4 ml-1" />}
                העלה תמונת רקע ראשונה
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {list.map((img, index) => (
                <div
                  key={img.id}
                  className={`rounded-xl overflow-hidden transition-all flex gap-3 items-stretch ${
                    img.isActive
                      ? "border-2 border-amber-400 bg-amber-500/20 ring-2 ring-amber-400/60 shadow-lg shadow-amber-500/10"
                      : "border border-slate-600 bg-slate-900/40 opacity-90"
                  }`}
                >
                  <div className="flex flex-col justify-center gap-0.5 py-2 pl-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0 text-slate-400 hover:text-white"
                      onClick={() => handleMove(index, "up")}
                      disabled={index === 0 || reorderMut.isPending}
                      title="העלה בסדר"
                    >
                      <ChevronUp className="w-4 h-4" />
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0 text-slate-400 hover:text-white"
                      onClick={() => handleMove(index, "down")}
                      disabled={index === list.length - 1 || reorderMut.isPending}
                      title="הורד בסדר"
                    >
                      <ChevronDown className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="aspect-video w-48 sm:w-56 flex-shrink-0 bg-slate-800 relative">
                    <img src={img.thumbnailUrl ?? img.url} alt="" className="w-full h-full object-cover" />
                    {img.isActive && (
                      <span className="absolute top-1 right-1 px-2 py-0.5 rounded text-xs font-bold bg-amber-400 text-slate-900 shadow">
                        פעילה
                      </span>
                    )}
                  </div>
                  <div className="p-3 flex-1 min-w-0 flex flex-col justify-between">
                    <div>
                      <p className="text-sm font-medium text-white truncate" title={img.filename}>
                        {img.filename}
                      </p>
                      <div className="text-xs text-slate-400">{formatDate(img.createdAt)}</div>
                      {!img.isActive && (
                        <span className="inline-block mt-1 px-2 py-0.5 rounded text-xs bg-slate-700 text-slate-400">
                          לא פעילה
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1 pt-2">
                      {!img.isActive && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-amber-600 text-amber-400 hover:bg-amber-600/20 h-8 text-xs"
                            onClick={() => setActiveMut.mutate({ id: img.id })}
                            disabled={setActiveMut.isPending}
                          >
                            <Check className="w-3 h-3 ml-1" />
                            הפעל
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-slate-600 text-slate-300 h-8 text-xs"
                            onClick={() => setActiveMut.mutate({ id: img.id })}
                            disabled={setActiveMut.isPending}
                            title="החלף לתמונה זו"
                          >
                            <RefreshCw className="w-3 h-3 ml-1" />
                            החלף
                          </Button>
                        </>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-slate-600 text-slate-300 h-8 text-xs"
                        onClick={() => setPreviewSimulationUrl(img.url)}
                        title="תצוגה עם ג׳קפוט (כמו בדף הבית)"
                      >
                        <Eye className="w-3.5 h-3.5 ml-1" />
                        תצוגה
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-slate-400 h-8 w-8 p-0"
                        onClick={() => setPreviewUrl(img.url)}
                        title="תצוגת תמונה בלבד"
                      >
                        <ImageIcon className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-slate-600 text-slate-300 h-8 text-xs"
                        onClick={() => duplicateMut.mutate({ id: img.id })}
                        disabled={duplicateMut.isPending}
                        title="שכפל תמונה"
                      >
                        <Copy className="w-3 h-3 ml-1" />
                        שכפל
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="h-8 text-xs"
                        onClick={() => handleDeleteClick(img)}
                        disabled={deleteMut.isPending}
                        title="מחק לצמיתות"
                      >
                        <Trash2 className="w-3.5 h-3.5 ml-1" />
                        מחק
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>

      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <AlertDialogContent className="bg-slate-800 border-slate-700 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">מחיקת תמונת רקע ג׳קפוט</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              {deleteConfirm?.isActive ? (
                <>
                  <span className="block font-medium text-amber-400 mb-1">זו התמונה הפעילה כרגע.</span>
                  אם תמחק אותה, רכיב הג׳קפוט יחזור לרקע גרדיאנט ברירת מחדל עד שתפעיל תמונה אחרת.
                </>
              ) : (
                <>למחוק את תמונת הרקע &quot;{deleteConfirm?.name}&quot;?</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-slate-600 text-slate-300 hover:bg-slate-700">ביטול</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700 text-white" onClick={handleDeleteConfirm}>
              מחק
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {previewUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setPreviewUrl(null)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === "Escape" && setPreviewUrl(null)}
          aria-label="סגור תצוגה מקדימה"
        >
          <img
            src={previewUrl}
            alt="תצוגה מקדימה"
            className="max-w-full max-h-full object-contain rounded shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      <Dialog open={!!previewSimulationUrl} onOpenChange={(open) => !open && setPreviewSimulationUrl(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-auto bg-slate-900 border-slate-700">
          <DialogTitle className="text-white sr-only">תצוגת סימולציה – רקע ג׳קפוט</DialogTitle>
          {previewSimulationUrl && (
            <div className="rounded-xl overflow-hidden border border-slate-600" aria-hidden>
              <div
                className="relative w-full min-h-[280px] rounded-xl bg-cover bg-center bg-no-repeat"
                style={{ backgroundImage: `url(${previewSimulationUrl})` }}
              >
                <div className="absolute inset-0 bg-black/60" />
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4">
                  <p className="text-amber-400 font-black text-2xl tracking-widest mb-2">JACKPOT</p>
                  <p className="text-white/90 text-sm mb-1">הגרלה בעוד</p>
                  <p className="font-mono text-xl font-bold text-white mb-4">12:00:00</p>
                  <p className="text-4xl font-black text-amber-400 drop-shadow-lg">₪50,000</p>
                </div>
              </div>
              <p className="text-slate-500 text-xs mt-2 text-center">סימולציה עם נתוני דמה – כך ייראה הרקע עם הג׳קפוט בדף הבית</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
