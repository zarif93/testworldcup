/**
 * Phase 15: Admin media manager – upload, list, copy URL, delete.
 * Guarded by cms.edit.
 */

import { useState, useRef } from "react";
import { Loader2, Upload, Copy, Trash2, Image } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export function MediaManagerSection() {
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const utils = trpc.useUtils();
  const { data: assets, isLoading } = trpc.admin.listMediaAssets.useQuery();
  const uploadMut = trpc.admin.uploadMediaAsset.useMutation({
    onSuccess: () => {
      setUploading(false);
      utils.admin.listMediaAssets.invalidate();
      toast.success("התמונה הועלתה");
    },
    onError: (e) => {
      setUploading(false);
      toast.error(e.message);
    },
  });
  const deleteMut = trpc.admin.deleteMediaAsset.useMutation({
    onSuccess: () => { utils.admin.listMediaAssets.invalidate(); toast.success("נמחק"); },
    onError: (e) => toast.error(e.message),
  });

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("נא לבחור קובץ תמונה (JPEG, PNG, GIF, WebP)");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("גודל מקסימלי 5MB");
      return;
    }
    setUploading(true);
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.replace(/^data:[^;]+;base64,/, "");
      uploadMut.mutate({ fileBase64: base64, originalName: file.name, mimeType: file.type });
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const copyUrl = (url: string) => {
    const full = window.location.origin + url;
    navigator.clipboard.writeText(full).then(() => toast.success("הקישור הועתק"));
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader className="flex flex-row items-center justify-between">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Image className="w-5 h-5 text-amber-400" />
            ניהול מדיה
          </h2>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-slate-400">העלאת תמונה</Label>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp" className="hidden" onChange={handleFile} />
            <Button type="button" variant="outline" className="mt-2 border-slate-600 text-slate-300" onClick={() => fileRef.current?.click()} disabled={uploading}>
              {uploading ? <Loader2 className="w-4 h-4 animate-spin ml-1" /> : <Upload className="w-4 h-4 ml-1" />}
              העלה תמונה (JPEG, PNG, GIF, WebP – עד 5MB)
            </Button>
          </div>
          <div>
            <p className="text-slate-400 text-sm mb-2">תמונות שהועלו ({assets?.length ?? 0})</p>
            {isLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="w-10 h-10 animate-spin text-amber-500" /></div>
            ) : !assets?.length ? (
              <p className="text-slate-500 py-8">אין תמונות. העלה תמונה למעלה לשימוש בבאנרים וסקשנים.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {(assets as Array<{ id: number; filename: string; originalName: string; url: string; mimeType: string }>).map((a) => (
                  <div key={a.id} className="rounded-lg border border-slate-700 bg-slate-900/50 overflow-hidden">
                    <div className="aspect-square bg-slate-800">
                      <img src={a.url} alt={a.originalName} className="w-full h-full object-cover" />
                    </div>
                    <div className="p-2 flex items-center justify-between gap-1">
                      <span className="text-xs text-slate-400 truncate flex-1" title={a.originalName}>{a.originalName}</span>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-slate-400" onClick={() => copyUrl(a.url)} title="העתק קישור"><Copy className="w-3.5 h-3.5" /></Button>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-400" onClick={() => deleteMut.mutate({ id: a.id })} disabled={deleteMut.isPending} title="מחק"><Trash2 className="w-3.5 h-3.5" /></Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
