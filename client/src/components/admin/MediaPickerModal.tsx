/**
 * Phase 15: Modal to pick an uploaded media asset (or upload new).
 * Used in CMS banner/section forms. Returns selected URL via onSelect.
 */

import { useState, useRef } from "react";
import { Loader2, Upload, Copy, Trash2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { getUploadErrorMessage, validateImageFile, uploadImage, MAX_MEDIA_ASSET_BYTES, ACCEPT_IMAGES } from "@/lib/uploadUtils";

type Asset = { id: number; filename: string; originalName: string; url: string; mimeType: string };

export function MediaPickerModal({
  open,
  onClose,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (url: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const utils = trpc.useUtils();
  const { data: assets, isLoading } = trpc.admin.listMediaAssets.useQuery(undefined, { enabled: open });
  const doUpload = async (file: File) => {
    setUploading(true);
    try {
      const data = await uploadImage({ type: "media", file });
      utils.admin.listMediaAssets.invalidate();
      onSelect(data.url);
      onClose();
      toast.success("התמונה הועלתה ונבחרה");
    } catch (e) {
      toast.error(getUploadErrorMessage(e));
    } finally {
      setUploading(false);
    }
  };
  const deleteMut = trpc.admin.deleteMediaAsset.useMutation({
    onSuccess: () => { utils.admin.listMediaAssets.invalidate(); toast.success("נמחק"); },
    onError: (e) => toast.error(e.message),
  });

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const validation = validateImageFile(file, MAX_MEDIA_ASSET_BYTES, ACCEPT_IMAGES);
    if (!validation.ok) {
      toast.error(validation.error);
      return;
    }
    doUpload(file);
    e.target.value = "";
  };

  const copyUrl = (url: string) => {
    const full = window.location.origin + url;
    navigator.clipboard.writeText(full).then(() => toast.success("הקישור הועתק"));
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-white">בחירת תמונה מהספרייה</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 flex-1 min-h-0">
          <div>
            <Label className="text-slate-400 text-sm">העלאת תמונה חדשה</Label>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp" className="hidden" onChange={handleFile} />
            <Button type="button" variant="outline" className="mt-1 border-slate-600 text-slate-300" onClick={() => fileRef.current?.click()} disabled={uploading}>
              {uploading ? <Loader2 className="w-4 h-4 animate-spin ml-1" /> : <Upload className="w-4 h-4 ml-1" />}
              העלה תמונה (JPEG, PNG, GIF, WebP – עד 5MB)
            </Button>
          </div>
          <div className="border-t border-slate-700 pt-3 flex-1 overflow-auto">
            <p className="text-slate-400 text-sm mb-2">בחר תמונה קיימת:</p>
            {isLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="w-8 h-8 animate-spin text-amber-500" /></div>
            ) : !assets?.length ? (
              <p className="text-slate-500 py-4">אין תמונות. העלה תמונה למעלה.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {(assets as Asset[]).map((a) => (
                  <div key={a.id} className="rounded-lg border border-slate-700 bg-slate-800/50 overflow-hidden group">
                    <div className="aspect-square bg-slate-800 relative">
                      <img src={a.url} alt={a.originalName} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 bg-black/50 transition">
                        <Button size="sm" className="h-8 bg-amber-600 hover:bg-amber-700" onClick={() => { onSelect(a.url); onClose(); }}>
                          בחר
                        </Button>
                        <Button size="sm" variant="outline" className="h-8 border-slate-500" onClick={() => copyUrl(a.url)}><Copy className="w-3.5 h-3.5" /></Button>
                        <Button size="sm" variant="outline" className="h-8 border-red-500/50 text-red-400" onClick={() => deleteMut.mutate({ id: a.id })} disabled={deleteMut.isPending}><Trash2 className="w-3.5 h-3.5" /></Button>
                      </div>
                    </div>
                    <p className="text-xs text-slate-500 truncate px-1 py-0.5" title={a.originalName}>{a.originalName}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
