/**
 * Admin: Site background image management – upload, history, activate/deactivate, switch.
 * Section title: "תמונות רקע של האתר". Guarded by settings.manage.
 */

import { useState, useRef } from "react";
import { Loader2, Upload, Check, X, RefreshCw, Trash2, Eye, ImageIcon } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
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

const MAX_SIZE_BYTES = 8 * 1024 * 1024; // 8MB
const ACCEPT = "image/jpeg,image/png,image/gif,image/webp";

type BackgroundImage = {
  id: number;
  filename: string;
  originalName: string;
  url: string;
  isActive: boolean;
  sizeBytes: number | null;
  width: number | null;
  height: number | null;
  uploadedBy: number | null;
  createdAt: Date | null;
  updatedAt: Date | null;
};

function formatDate(d: Date | null): string {
  if (!d) return "—";
  const date = d instanceof Date ? d : new Date(d);
  return date.toLocaleDateString("he-IL", { dateStyle: "short" }) + " " + date.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
}

function formatSize(bytes: number | null): string {
  if (bytes == null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDimensions(w: number | null, h: number | null): string {
  if (w != null && h != null) return `${w}×${h}`;
  return "—";
}

type DeleteConfirm = { id: number; isActive: boolean; name: string };

export function BackgroundImagesSection() {
  const [uploading, setUploading] = useState(false);
  const [activateAfterUpload, setActivateAfterUpload] = useState(true);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirm | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const utils = trpc.useUtils();
  const { data: images, isLoading } = trpc.admin.listSiteBackgroundImages.useQuery();
  const uploadMut = trpc.admin.uploadSiteBackgroundImage.useMutation({
    onSuccess: () => {
      setUploading(false);
      utils.admin.listSiteBackgroundImages.invalidate();
      utils.settings.getActiveBackground.invalidate();
      toast.success("תמונת הרקע הועלתה");
    },
    onError: (e) => {
      setUploading(false);
      toast.error(e.message);
    },
  });
  const setActiveMut = trpc.admin.setActiveSiteBackground.useMutation({
    onSuccess: () => {
      utils.admin.listSiteBackgroundImages.invalidate();
      utils.settings.getActiveBackground.invalidate();
      toast.success("התמונה הופעלה");
    },
    onError: (e) => toast.error(e.message),
  });
  const deactivateMut = trpc.admin.deactivateSiteBackground.useMutation({
    onSuccess: () => {
      utils.admin.listSiteBackgroundImages.invalidate();
      utils.settings.getActiveBackground.invalidate();
      toast.success("התמונה כובתה");
    },
    onError: (e) => toast.error(e.message),
  });
  const deleteMut = trpc.admin.deleteSiteBackgroundImage.useMutation({
    onSuccess: () => {
      setDeleteConfirm(null);
      utils.admin.listSiteBackgroundImages.invalidate();
      utils.settings.getActiveBackground.invalidate();
      toast.success("התמונה נמחקה");
    },
    onError: (e) => toast.error(e.message),
  });

  const handleDeleteClick = (img: BackgroundImage) => {
    setDeleteConfirm({ id: img.id, isActive: img.isActive, name: img.originalName });
  };

  const handleDeleteConfirm = () => {
    if (deleteConfirm) deleteMut.mutate({ id: deleteConfirm.id });
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.match(/^image\/(jpeg|png|gif|webp)$/i)) {
      toast.error("נא לבחור קובץ תמונה (JPEG, PNG, GIF, WebP)");
      return;
    }
    if (file.size > MAX_SIZE_BYTES) {
      toast.error("גודל מקסימלי 8MB");
      return;
    }
    setUploading(true);
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.replace(/^data:[^;]+;base64,/, "");
      uploadMut.mutate({
        fileBase64: base64,
        originalName: file.name,
        mimeType: file.type,
        activate: activateAfterUpload,
      });
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const list = (images ?? []) as BackgroundImage[];

  return (
    <Card className="bg-slate-800/50 border-slate-700">
      <CardHeader>
        <h3 className="text-lg font-bold text-white">תמונות רקע של האתר</h3>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Upload */}
        <div>
          <Label className="text-slate-400">העלאת תמונת רקע חדשה</Label>
          <input
            ref={fileRef}
            type="file"
            accept={ACCEPT}
            className="hidden"
            onChange={handleFile}
          />
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="outline"
              className="border-slate-600 text-slate-300"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? <Loader2 className="w-4 h-4 animate-spin ml-1" /> : <Upload className="w-4 h-4 ml-1" />}
              העלה תמונה (JPEG, PNG, GIF, WebP – עד 8MB)
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

        {/* List / history */}
        <div>
          <p className="text-slate-400 text-sm mb-2">היסטוריית תמונות ({list.length})</p>
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-10 h-10 animate-spin text-amber-500" />
            </div>
          ) : list.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-600 bg-slate-900/30 py-12 px-6 text-center">
              <ImageIcon className="mx-auto w-12 h-12 text-slate-500 mb-3" aria-hidden />
              <p className="text-slate-400 font-medium mb-1">אין עדיין תמונות רקע</p>
              <p className="text-slate-500 text-sm mb-4">העלה תמונה למעלה כדי שתופיע כרקע האתר. תוכל להפעיל או להחליף אותה בכל עת.</p>
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {list.map((img) => (
                <div
                  key={img.id}
                  className={`rounded-xl overflow-hidden transition-all ${
                    img.isActive
                      ? "border-2 border-amber-400 bg-amber-500/20 ring-2 ring-amber-400/60 shadow-lg shadow-amber-500/10"
                      : "border border-slate-700 bg-slate-900/50"
                  }`}
                >
                  <div className="aspect-video bg-slate-800 relative">
                    <img src={img.url} alt={img.originalName} className="w-full h-full object-cover" />
                    {img.isActive && (
                      <span className="absolute top-2 right-2 px-2.5 py-1 rounded-md text-xs font-semibold bg-amber-400 text-slate-900 shadow">
                        פעילה
                      </span>
                    )}
                  </div>
                  <div className="p-3 space-y-2">
                    <p className="text-sm text-white font-medium truncate" title={img.originalName}>
                      {img.originalName}
                    </p>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-400">
                      <span>{formatDate(img.createdAt)}</span>
                      <span>{formatSize(img.sizeBytes)}</span>
                      <span>{formatDimensions(img.width, img.height)}</span>
                    </div>
                    {!img.isActive && (
                      <span className="inline-block px-2 py-0.5 rounded text-xs bg-slate-700 text-slate-400">
                        לא פעילה
                      </span>
                    )}
                    <div className="flex flex-wrap gap-1 pt-1">
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
                            החלף לתמונה זו
                          </Button>
                        </>
                      )}
                      {img.isActive && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-slate-600 text-slate-300 h-8 text-xs"
                          onClick={() => deactivateMut.mutate({ id: img.id })}
                          disabled={deactivateMut.isPending}
                        >
                          <X className="w-3 h-3 ml-1" />
                          כבה
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-slate-400 h-8 w-8 p-0"
                        onClick={() => setPreviewUrl(img.url)}
                        title="תצוגה מקדימה"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-400 h-8 w-8 p-0"
                        onClick={() => handleDeleteClick(img)}
                        disabled={deleteMut.isPending}
                        title="מחק"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <AlertDialogContent className="bg-slate-800 border-slate-700 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">מחיקת תמונת רקע</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              {deleteConfirm?.isActive ? (
                <>
                  <span className="block font-medium text-amber-400 mb-1">זו התמונה הפעילה כרגע.</span>
                  אם תמחק אותה, האתר יעבור אוטומטית לרקע ברירת המחדל עד שתפעיל תמונה אחרת. האם להמשיך?
                </>
              ) : (
                <>למחוק את תמונת הרקע &quot;{deleteConfirm?.name}&quot;? פעולה זו לא ניתנת לביטול.</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-slate-600 text-slate-300 hover:bg-slate-700">ביטול</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={handleDeleteConfirm}
            >
              מחק
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Preview modal */}
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
    </Card>
  );
}
