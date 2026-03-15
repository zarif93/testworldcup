/**
 * Phase 11: CMS admin UI – banners, announcements, pages, sections.
 * Guarded by cms.view / cms.edit (handled by router); section only visible when user has permission.
 */

import { useState, useEffect } from "react";
import { Loader2, Plus, Pencil, Trash2, Image, Megaphone, FileText, Layout } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import {
  BANNER_KEYS,
  PAGE_SLUGS,
  SECTION_KEYS,
  SECTION_TYPES,
  ANNOUNCEMENT_VARIANTS,
  CMS_CUSTOM_VALUE,
  CMS_CUSTOM_LABEL_HE,
} from "@/config/cmsPredefinedOptions";
import { MediaPickerModal } from "@/components/admin/MediaPickerModal";
import { toast } from "sonner";

type CmsTab = "banners" | "announcements" | "pages" | "sections";

export function CmsSection() {
  const [tab, setTab] = useState<CmsTab>("banners");
  const [bannerFormOpen, setBannerFormOpen] = useState(false);
  const [editingBannerId, setEditingBannerId] = useState<number | null>(null);
  const [announcementFormOpen, setAnnouncementFormOpen] = useState(false);
  const [editingAnnouncementId, setEditingAnnouncementId] = useState<number | null>(null);
  const [pageFormOpen, setPageFormOpen] = useState(false);
  const [editingPageId, setEditingPageId] = useState<number | null>(null);
  const [sectionFormOpen, setSectionFormOpen] = useState(false);
  const [editingSectionId, setEditingSectionId] = useState<number | null>(null);
  const [deleteBannerId, setDeleteBannerId] = useState<number | null>(null);
  const [deleteAnnouncementId, setDeleteAnnouncementId] = useState<number | null>(null);
  const [deletePageId, setDeletePageId] = useState<number | null>(null);
  const [deleteSectionId, setDeleteSectionId] = useState<number | null>(null);

  const utils = trpc.useUtils();
  const { data: banners, isLoading: bannersLoading } = trpc.admin.listSiteBanners.useQuery(undefined, { enabled: tab === "banners" });
  const { data: announcements, isLoading: announcementsLoading } = trpc.admin.listSiteAnnouncements.useQuery(undefined, { enabled: tab === "announcements" });
  const { data: pages, isLoading: pagesLoading } = trpc.admin.listContentPages.useQuery(undefined, { enabled: tab === "pages" || tab === "sections" });
  const { data: sections, isLoading: sectionsLoading } = trpc.admin.listContentSections.useQuery({ pageId: null }, { enabled: tab === "sections" });

  const tabs: { id: CmsTab; label: string; icon: React.ReactNode }[] = [
    { id: "banners", label: "באנרים", icon: <Image className="w-4 h-4" /> },
    { id: "announcements", label: "הודעות/פופאפ", icon: <Megaphone className="w-4 h-4" /> },
    { id: "pages", label: "דפים", icon: <FileText className="w-4 h-4" /> },
    { id: "sections", label: "סקשנים", icon: <Layout className="w-4 h-4" /> },
  ];

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-wrap gap-2 border-b border-slate-700 pb-4">
        {tabs.map((t) => (
          <Button
            key={t.id}
            variant={tab === t.id ? "default" : "ghost"}
            size="sm"
            className={tab === t.id ? "bg-amber-600 hover:bg-amber-700" : "text-slate-400 hover:text-white"}
            onClick={() => setTab(t.id)}
          >
            {t.icon}
            <span className="mr-1">{t.label}</span>
          </Button>
        ))}
      </div>

      {tab === "banners" && (
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader className="flex flex-row items-center justify-between">
            <h3 className="text-lg font-bold text-white">באנרים</h3>
            <Button size="sm" className="bg-amber-600 hover:bg-amber-700" onClick={() => { setEditingBannerId(null); setBannerFormOpen(true); }}>
              <Plus className="w-4 h-4 ml-1" /> הוסף באנר
            </Button>
          </CardHeader>
          <CardContent>
            {bannersLoading ? <div className="flex justify-center py-8"><Loader2 className="w-8 h-8 animate-spin text-amber-500" /></div> : !banners?.length ? <p className="text-slate-500 py-4">אין באנרים. הוסף באנר עם מפתח למשל homepage_hero.</p> : (
              <div className="space-y-2">
                {(banners ?? []).map((b) => (
                  <div key={b.id} className="flex items-center justify-between gap-2 p-3 rounded-lg bg-slate-900/50 border border-slate-700">
                    <div>
                      <span className="font-medium text-white">{b.key}</span>
                      {b.title && <span className="text-slate-400 text-sm mr-2"> – {b.title}</span>}
                      <span className="text-slate-500 text-xs">פעיל: {b.isActive ? "כן" : "לא"}</span>
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" className="text-slate-400" onClick={() => { setEditingBannerId(b.id); setBannerFormOpen(true); }}><Pencil className="w-4 h-4" /></Button>
                      <Button size="sm" variant="ghost" className="text-red-400" onClick={() => setDeleteBannerId(b.id)}><Trash2 className="w-4 h-4" /></Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {tab === "announcements" && (
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader className="flex flex-row items-center justify-between">
            <h3 className="text-lg font-bold text-white">הודעות / פופאפ</h3>
            <Button size="sm" className="bg-amber-600 hover:bg-amber-700" onClick={() => { setEditingAnnouncementId(null); setAnnouncementFormOpen(true); }}>
              <Plus className="w-4 h-4 ml-1" /> הוסף הודעה
            </Button>
          </CardHeader>
          <CardContent>
            {announcementsLoading ? <div className="flex justify-center py-8"><Loader2 className="w-8 h-8 animate-spin text-amber-500" /></div> : !announcements?.length ? <p className="text-slate-500 py-4">אין הודעות.</p> : (
              <div className="space-y-2">
                {(announcements ?? []).map((a) => (
                  <div key={a.id} className="flex items-center justify-between gap-2 p-3 rounded-lg bg-slate-900/50 border border-slate-700">
                    <div>
                      <span className="font-medium text-white">{a.title}</span>
                      <span className="text-slate-500 text-xs mr-2"> ({a.variant})</span>
                      <span className="text-slate-500 text-xs">פעיל: {a.isActive ? "כן" : "לא"}</span>
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" className="text-slate-400" onClick={() => { setEditingAnnouncementId(a.id); setAnnouncementFormOpen(true); }}><Pencil className="w-4 h-4" /></Button>
                      <Button size="sm" variant="ghost" className="text-red-400" onClick={() => setDeleteAnnouncementId(a.id)}><Trash2 className="w-4 h-4" /></Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {tab === "pages" && (
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader className="flex flex-row items-center justify-between">
            <h3 className="text-lg font-bold text-white">דפי תוכן</h3>
            <Button size="sm" className="bg-amber-600 hover:bg-amber-700" onClick={() => { setEditingPageId(null); setPageFormOpen(true); }}>
              <Plus className="w-4 h-4 ml-1" /> הוסף דף
            </Button>
          </CardHeader>
          <CardContent>
            {pagesLoading ? <div className="flex justify-center py-8"><Loader2 className="w-8 h-8 animate-spin text-amber-500" /></div> : !pages?.length ? <p className="text-slate-500 py-4">אין דפים. הוסף דף עם slug (למשל about).</p> : (
              <div className="space-y-2">
                {(pages ?? []).map((p) => (
                  <div key={p.id} className="flex items-center justify-between gap-2 p-3 rounded-lg bg-slate-900/50 border border-slate-700">
                    <div>
                      <span className="font-medium text-white">{p.slug}</span>
                      <span className="text-slate-400 text-sm mr-2"> – {p.title}</span>
                      <span className="text-slate-500 text-xs">סטטוס: {p.status}</span>
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" className="text-slate-400" onClick={() => { setEditingPageId(p.id); setPageFormOpen(true); }}><Pencil className="w-4 h-4" /></Button>
                      <Button size="sm" variant="ghost" className="text-red-400" onClick={() => setDeletePageId(p.id)}><Trash2 className="w-4 h-4" /></Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {tab === "sections" && (
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader className="flex flex-row items-center justify-between">
            <h3 className="text-lg font-bold text-white">סקשנים (ללא דף / גלובלי)</h3>
            <Button size="sm" className="bg-amber-600 hover:bg-amber-700" onClick={() => { setEditingSectionId(null); setSectionFormOpen(true); }}>
              <Plus className="w-4 h-4 ml-1" /> הוסף סקשן
            </Button>
          </CardHeader>
          <CardContent>
            {sectionsLoading ? <div className="flex justify-center py-8"><Loader2 className="w-8 h-8 animate-spin text-amber-500" /></div> : !sections?.length ? <p className="text-slate-500 py-4">אין סקשנים גלובליים.</p> : (
              <div className="space-y-2">
                {(sections ?? []).map((s) => (
                  <div key={s.id} className="flex items-center justify-between gap-2 p-3 rounded-lg bg-slate-900/50 border border-slate-700">
                    <div>
                      <span className="font-medium text-white">{s.key}</span>
                      <span className="text-slate-400 text-sm mr-2"> ({s.type})</span>
                      {s.title && <span className="text-slate-400 text-sm"> – {s.title}</span>}
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" className="text-slate-400" onClick={() => { setEditingSectionId(s.id); setSectionFormOpen(true); }}><Pencil className="w-4 h-4" /></Button>
                      <Button size="sm" variant="ghost" className="text-red-400" onClick={() => setDeleteSectionId(s.id)}><Trash2 className="w-4 h-4" /></Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Banner form modal – minimal: key, title, subtitle, imageUrl, buttonText, buttonUrl, isActive */}
      <BannerFormModal
        open={bannerFormOpen}
        onClose={() => { setBannerFormOpen(false); setEditingBannerId(null); utils.admin.listSiteBanners.invalidate(); }}
        editingId={editingBannerId}
      />
      <AnnouncementFormModal
        open={announcementFormOpen}
        onClose={() => { setAnnouncementFormOpen(false); setEditingAnnouncementId(null); utils.admin.listSiteAnnouncements.invalidate(); }}
        editingId={editingAnnouncementId}
      />
      <PageFormModal
        open={pageFormOpen}
        onClose={() => { setPageFormOpen(false); setEditingPageId(null); utils.admin.listContentPages.invalidate(); }}
        editingId={editingPageId}
      />
      <SectionFormModal
        open={sectionFormOpen}
        onClose={() => { setSectionFormOpen(false); setEditingSectionId(null); utils.admin.listContentSections.invalidate(); }}
        editingId={editingSectionId}
        pageId={null}
      />

      <DeleteBannerDialog id={deleteBannerId} onClose={() => setDeleteBannerId(null)} onSuccess={() => { utils.admin.listSiteBanners.invalidate(); setDeleteBannerId(null); }} />
      <DeleteAnnouncementDialog id={deleteAnnouncementId} onClose={() => setDeleteAnnouncementId(null)} onSuccess={() => { utils.admin.listSiteAnnouncements.invalidate(); setDeleteAnnouncementId(null); }} />
      <DeletePageDialog id={deletePageId} onClose={() => setDeletePageId(null)} onSuccess={() => { utils.admin.listContentPages.invalidate(); setDeletePageId(null); }} />
      <DeleteSectionDialog id={deleteSectionId} onClose={() => setDeleteSectionId(null)} onSuccess={() => { utils.admin.listContentSections.invalidate(); setDeleteSectionId(null); }} />
    </div>
  );
}

function BannerFormModal({ open, onClose, editingId }: { open: boolean; onClose: () => void; editingId: number | null }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<"image" | "mobile" | null>(null);
  const { data: banner } = trpc.admin.getSiteBannerById.useQuery({ id: editingId! }, { enabled: open && editingId != null });
  const create = trpc.admin.createSiteBanner.useMutation({ onSuccess: () => { toast.success("באנר נוצר"); onClose(); }, onError: (e) => toast.error(e.message) });
  const update = trpc.admin.updateSiteBanner.useMutation({ onSuccess: () => { toast.success("באנר עודכן"); onClose(); }, onError: (e) => toast.error(e.message) });
  const [keySelect, setKeySelect] = useState("");
  const [keyCustom, setKeyCustom] = useState("");
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [mobileImageUrl, setMobileImageUrl] = useState("");
  const [buttonText, setButtonText] = useState("");
  const [buttonUrl, setButtonUrl] = useState("");
  const [isActive, setIsActive] = useState(true);
  const key = keySelect === CMS_CUSTOM_VALUE ? keyCustom : keySelect;
  useEffect(() => {
    if (banner) {
      const inList = BANNER_KEYS.some((o) => o.value === banner.key);
      setKeySelect(inList ? banner.key : CMS_CUSTOM_VALUE);
      setKeyCustom(inList ? "" : banner.key);
      setTitle(banner.title ?? ""); setSubtitle(banner.subtitle ?? ""); setImageUrl(banner.imageUrl ?? ""); setMobileImageUrl(banner.mobileImageUrl ?? ""); setButtonText(banner.buttonText ?? ""); setButtonUrl(banner.buttonUrl ?? ""); setIsActive(banner.isActive);
    } else if (!editingId && open) {
      setKeySelect(""); setKeyCustom(""); setTitle(""); setSubtitle(""); setImageUrl(""); setMobileImageUrl(""); setButtonText(""); setButtonUrl(""); setIsActive(true);
    }
  }, [banner, editingId, open]);
  const submit = () => {
    if (!key.trim()) { toast.error("מפתח חובה"); return; }
    if (editingId) update.mutate({ id: editingId, key: key.trim(), title: title.trim() || null, subtitle: subtitle.trim() || null, imageUrl: imageUrl.trim() || null, mobileImageUrl: mobileImageUrl.trim() || null, buttonText: buttonText.trim() || null, buttonUrl: buttonUrl.trim() || null, isActive });
    else create.mutate({ key: key.trim(), title: title.trim() || null, subtitle: subtitle.trim() || null, imageUrl: imageUrl.trim() || null, mobileImageUrl: mobileImageUrl.trim() || null, buttonText: buttonText.trim() || null, buttonUrl: buttonUrl.trim() || null, isActive });
  };
  const openPicker = (target: "image" | "mobile") => { setPickerTarget(target); setPickerOpen(true); };
  const handlePickerSelect = (url: string) => { if (pickerTarget === "image") setImageUrl(url); else if (pickerTarget === "mobile") setMobileImageUrl(url); setPickerTarget(null); };
  return (
    <>
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-md">
        <DialogHeader><DialogTitle className="text-white">{editingId ? "עריכת באנר" : "באנר חדש"}</DialogTitle></DialogHeader>
        <div className="grid gap-3 py-2">
          <div>
            <Label className="text-slate-400">מפתח באנר</Label>
            <select className="bg-slate-800 text-white rounded px-3 py-2 w-full mt-1 border border-slate-600" value={keySelect} onChange={(e) => setKeySelect(e.target.value)}>
              <option value="">בחר מפתח...</option>
              {BANNER_KEYS.map((o) => (
                <option key={o.value} value={o.value}>{o.labelHe} ({o.value})</option>
              ))}
              <option value={CMS_CUSTOM_VALUE}>{CMS_CUSTOM_LABEL_HE}</option>
            </select>
            {keySelect === CMS_CUSTOM_VALUE && (
              <Input className="bg-slate-800 text-white mt-2 border-slate-600" value={keyCustom} onChange={(e) => setKeyCustom(e.target.value)} placeholder="homepage_hero" />
            )}
          </div>
          <div><Label className="text-slate-400">כותרת</Label><Input className="bg-slate-800 text-white mt-1" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
          <div><Label className="text-slate-400">תת־כותרת</Label><Input className="bg-slate-800 text-white mt-1" value={subtitle} onChange={(e) => setSubtitle(e.target.value)} /></div>
          <div>
            <Label className="text-slate-400">קישור תמונה</Label>
            <div className="flex gap-2 mt-1">
              <Input className="bg-slate-800 text-white border-slate-600 flex-1" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://... או /uploads/..." />
              <Button type="button" size="sm" variant="outline" className="border-slate-600 text-slate-300 shrink-0" onClick={() => openPicker("image")}>בחר מהספרייה</Button>
            </div>
          </div>
          <div>
            <Label className="text-slate-400">קישור תמונה מובייל (אופציונלי)</Label>
            <div className="flex gap-2 mt-1">
              <Input className="bg-slate-800 text-white border-slate-600 flex-1" value={mobileImageUrl} onChange={(e) => setMobileImageUrl(e.target.value)} placeholder="אותו קישור או אחר" />
              <Button type="button" size="sm" variant="outline" className="border-slate-600 text-slate-300 shrink-0" onClick={() => openPicker("mobile")}>בחר מהספרייה</Button>
            </div>
          </div>
          <div><Label className="text-slate-400">טקסט כפתור</Label><Input className="bg-slate-800 text-white mt-1" value={buttonText} onChange={(e) => setButtonText(e.target.value)} /></div>
          <div><Label className="text-slate-400">קישור כפתור</Label><Input className="bg-slate-800 text-white mt-1" value={buttonUrl} onChange={(e) => setButtonUrl(e.target.value)} placeholder="/tournaments" /></div>
          <label className="flex items-center gap-2 text-slate-400"><input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />פעיל</label>
        </div>
        <DialogFooter><Button variant="ghost" onClick={onClose}>ביטול</Button><Button className="bg-amber-600 hover:bg-amber-700" onClick={submit} disabled={create.isPending || update.isPending}>{create.isPending || update.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "שמירה"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
    <MediaPickerModal open={pickerOpen} onClose={() => { setPickerOpen(false); setPickerTarget(null); }} onSelect={handlePickerSelect} />
    </>
  );
}

function AnnouncementFormModal({ open, onClose, editingId }: { open: boolean; onClose: () => void; editingId: number | null }) {
  const { data: ann } = trpc.admin.getSiteAnnouncementById.useQuery({ id: editingId! }, { enabled: open && editingId != null });
  const create = trpc.admin.createSiteAnnouncement.useMutation({ onSuccess: () => { toast.success("הודעה נוצרה"); onClose(); }, onError: (e) => toast.error(e.message) });
  const update = trpc.admin.updateSiteAnnouncement.useMutation({ onSuccess: () => { toast.success("הודעה עודכנה"); onClose(); }, onError: (e) => toast.error(e.message) });
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [variant, setVariant] = useState<"info" | "warning" | "success" | "neutral">("info");
  const [isActive, setIsActive] = useState(true);
  useEffect(() => {
    if (ann) { setTitle(ann.title); setBody(ann.body ?? ""); setVariant(ann.variant as "info" | "warning" | "success" | "neutral"); setIsActive(ann.isActive); }
    else if (!editingId && open) { setTitle(""); setBody(""); setVariant("info"); setIsActive(true); }
  }, [ann, editingId, open]);
  const submit = () => {
    if (!title.trim()) { toast.error("כותרת חובה"); return; }
    if (editingId) update.mutate({ id: editingId, title: title.trim(), body: body.trim() || null, variant, isActive });
    else create.mutate({ title: title.trim(), body: body.trim() || null, variant, isActive });
  };
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-md">
        <DialogHeader><DialogTitle className="text-white">{editingId ? "עריכת הודעה" : "הודעה חדשה"}</DialogTitle></DialogHeader>
        <div className="grid gap-3 py-2">
          <div><Label className="text-slate-400">כותרת</Label><Input className="bg-slate-800 text-white mt-1" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
          <div><Label className="text-slate-400">תוכן</Label><Input className="bg-slate-800 text-white mt-1" value={body} onChange={(e) => setBody(e.target.value)} /></div>
          <div><Label className="text-slate-400">סוג</Label><select className="bg-slate-800 text-white rounded px-3 py-2 w-full mt-1 border border-slate-600" value={variant} onChange={(e) => setVariant(e.target.value as "info" | "warning" | "success" | "neutral")}>{ANNOUNCEMENT_VARIANTS.map((o) => (<option key={o.value} value={o.value}>{o.labelHe} ({o.value})</option>))}</select></div>
          <label className="flex items-center gap-2 text-slate-400"><input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />פעיל</label>
        </div>
        <DialogFooter><Button variant="ghost" onClick={onClose}>ביטול</Button><Button className="bg-amber-600 hover:bg-amber-700" onClick={submit} disabled={create.isPending || update.isPending}>{create.isPending || update.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "שמירה"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PageFormModal({ open, onClose, editingId }: { open: boolean; onClose: () => void; editingId: number | null }) {
  const { data: page } = trpc.admin.getContentPageById.useQuery({ id: editingId! }, { enabled: open && editingId != null });
  const create = trpc.admin.createContentPage.useMutation({ onSuccess: () => { toast.success("דף נוצר"); onClose(); }, onError: (e) => toast.error(e.message) });
  const update = trpc.admin.updateContentPage.useMutation({ onSuccess: () => { toast.success("דף עודכן"); onClose(); }, onError: (e) => toast.error(e.message) });
  const [slugSelect, setSlugSelect] = useState("");
  const [slugCustom, setSlugCustom] = useState("");
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState<"draft" | "published">("draft");
  const slug = slugSelect === CMS_CUSTOM_VALUE ? slugCustom : slugSelect;
  useEffect(() => {
    if (page) {
      const inList = PAGE_SLUGS.some((o) => o.value === page.slug);
      setSlugSelect(inList ? page.slug : CMS_CUSTOM_VALUE);
      setSlugCustom(inList ? "" : page.slug);
      setTitle(page.title); setStatus(page.status as "draft" | "published");
    } else if (!editingId && open) { setSlugSelect(""); setSlugCustom(""); setTitle(""); setStatus("draft"); }
  }, [page, editingId, open]);
  const submit = () => {
    if (!slug.trim() || !title.trim()) { toast.error("נתיב (slug) וכותרת חובה"); return; }
    if (editingId) update.mutate({ id: editingId, slug: slug.trim(), title: title.trim(), status });
    else create.mutate({ slug: slug.trim(), title: title.trim(), status });
  };
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-md">
        <DialogHeader><DialogTitle className="text-white">{editingId ? "עריכת דף" : "דף חדש"}</DialogTitle></DialogHeader>
        <div className="grid gap-3 py-2">
          <div>
            <Label className="text-slate-400">נתיב (Slug)</Label>
            <select className="bg-slate-800 text-white rounded px-3 py-2 w-full mt-1 border border-slate-600" value={slugSelect} onChange={(e) => setSlugSelect(e.target.value)}>
              <option value="">בחר נתיב...</option>
              {PAGE_SLUGS.map((o) => (
                <option key={o.value} value={o.value}>{o.labelHe} ({o.value})</option>
              ))}
              <option value={CMS_CUSTOM_VALUE}>{CMS_CUSTOM_LABEL_HE}</option>
            </select>
            {slugSelect === CMS_CUSTOM_VALUE && (
              <Input className="bg-slate-800 text-white mt-2 border-slate-600" value={slugCustom} onChange={(e) => setSlugCustom(e.target.value)} placeholder="about" />
            )}
          </div>
          <div><Label className="text-slate-400">כותרת</Label><Input className="bg-slate-800 text-white mt-1" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
          <div><Label className="text-slate-400">סטטוס</Label><select className="bg-slate-800 text-white rounded px-3 py-2 w-full mt-1 border border-slate-600" value={status} onChange={(e) => setStatus(e.target.value as "draft" | "published")}><option value="draft">טיוטה</option><option value="published">פורסם</option></select></div>
        </div>
        <DialogFooter><Button variant="ghost" onClick={onClose}>ביטול</Button><Button className="bg-amber-600 hover:bg-amber-700" onClick={submit} disabled={create.isPending || update.isPending}>{create.isPending || update.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "שמירה"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SectionFormModal({ open, onClose, editingId, pageId }: { open: boolean; onClose: () => void; editingId: number | null; pageId: number | null }) {
  const [sectionPickerOpen, setSectionPickerOpen] = useState(false);
  const { data: section } = trpc.admin.getContentSectionById.useQuery({ id: editingId! }, { enabled: open && editingId != null });
  const create = trpc.admin.createContentSection.useMutation({ onSuccess: () => { toast.success("סקשן נוצר"); onClose(); }, onError: (e) => toast.error(e.message) });
  const update = trpc.admin.updateContentSection.useMutation({ onSuccess: () => { toast.success("סקשן עודכן"); onClose(); }, onError: (e) => toast.error(e.message) });
  const [keySelect, setKeySelect] = useState("");
  const [keyCustom, setKeyCustom] = useState("");
  const [typeSelect, setTypeSelect] = useState("hero");
  const [typeCustom, setTypeCustom] = useState("");
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [body, setBody] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [isActive, setIsActive] = useState(true);
  const key = keySelect === CMS_CUSTOM_VALUE ? keyCustom : keySelect;
  const type = typeSelect === CMS_CUSTOM_VALUE ? typeCustom : typeSelect;
  useEffect(() => {
    if (section) {
      const keyInList = SECTION_KEYS.some((o) => o.value === section.key);
      const typeInList = SECTION_TYPES.some((o) => o.value === section.type);
      setKeySelect(keyInList ? section.key : CMS_CUSTOM_VALUE);
      setKeyCustom(keyInList ? "" : section.key);
      setTypeSelect(typeInList ? section.type : CMS_CUSTOM_VALUE);
      setTypeCustom(typeInList ? "" : section.type);
      setTitle(section.title ?? ""); setSubtitle(section.subtitle ?? ""); setBody(section.body ?? ""); setImageUrl(section.imageUrl ?? ""); setIsActive(section.isActive);
    } else if (!editingId && open) {
      setKeySelect(""); setKeyCustom(""); setTypeSelect("hero"); setTypeCustom(""); setTitle(""); setSubtitle(""); setBody(""); setImageUrl(""); setIsActive(true);
    }
  }, [section, editingId, open]);
  const submit = () => {
    if (!key.trim() || !type.trim()) { toast.error("מפתח וסוג חובה"); return; }
    if (editingId) update.mutate({ id: editingId, key: key.trim(), type: type.trim(), title: title.trim() || null, subtitle: subtitle.trim() || null, body: body.trim() || null, imageUrl: imageUrl.trim() || null, isActive });
    else create.mutate({ pageId, key: key.trim(), type: type.trim(), title: title.trim() || null, subtitle: subtitle.trim() || null, body: body.trim() || null, imageUrl: imageUrl.trim() || null, isActive });
  };
  return (
    <>
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-md">
        <DialogHeader><DialogTitle className="text-white">{editingId ? "עריכת סקשן" : "סקשן חדש"}</DialogTitle></DialogHeader>
        <div className="grid gap-3 py-2">
          <div>
            <Label className="text-slate-400">מפתח סקשן</Label>
            <select className="bg-slate-800 text-white rounded px-3 py-2 w-full mt-1 border border-slate-600" value={keySelect} onChange={(e) => setKeySelect(e.target.value)}>
              <option value="">בחר מפתח...</option>
              {SECTION_KEYS.map((o) => (
                <option key={o.value} value={o.value}>{o.labelHe} ({o.value})</option>
              ))}
              <option value={CMS_CUSTOM_VALUE}>{CMS_CUSTOM_LABEL_HE}</option>
            </select>
            {keySelect === CMS_CUSTOM_VALUE && (
              <Input className="bg-slate-800 text-white mt-2 border-slate-600" value={keyCustom} onChange={(e) => setKeyCustom(e.target.value)} placeholder="homepage_hero" />
            )}
          </div>
          <div>
            <Label className="text-slate-400">סוג סקשן</Label>
            <select className="bg-slate-800 text-white rounded px-3 py-2 w-full mt-1 border border-slate-600" value={typeSelect} onChange={(e) => setTypeSelect(e.target.value)}>
              {SECTION_TYPES.map((o) => (
                <option key={o.value} value={o.value}>{o.labelHe} ({o.value})</option>
              ))}
              <option value={CMS_CUSTOM_VALUE}>{CMS_CUSTOM_LABEL_HE}</option>
            </select>
            {typeSelect === CMS_CUSTOM_VALUE && (
              <Input className="bg-slate-800 text-white mt-2 border-slate-600" value={typeCustom} onChange={(e) => setTypeCustom(e.target.value)} placeholder="hero" />
            )}
          </div>
          <div>
            <Label className="text-slate-400">קישור תמונה (אופציונלי)</Label>
            <div className="flex gap-2 mt-1">
              <Input className="bg-slate-800 text-white border-slate-600 flex-1" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://... או /uploads/..." />
              <Button type="button" size="sm" variant="outline" className="border-slate-600 text-slate-300 shrink-0" onClick={() => setSectionPickerOpen(true)}>בחר מהספרייה</Button>
            </div>
          </div>
          <div><Label className="text-slate-400">כותרת</Label><Input className="bg-slate-800 text-white mt-1" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
          <div><Label className="text-slate-400">תת־כותרת</Label><Input className="bg-slate-800 text-white mt-1" value={subtitle} onChange={(e) => setSubtitle(e.target.value)} /></div>
          <div><Label className="text-slate-400">תוכן (body)</Label><Input className="bg-slate-800 text-white mt-1" value={body} onChange={(e) => setBody(e.target.value)} /></div>
          <label className="flex items-center gap-2 text-slate-400"><input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />פעיל</label>
        </div>
        <DialogFooter><Button variant="ghost" onClick={onClose}>ביטול</Button><Button className="bg-amber-600 hover:bg-amber-700" onClick={submit} disabled={create.isPending || update.isPending}>{create.isPending || update.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "שמירה"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
    <MediaPickerModal open={sectionPickerOpen} onClose={() => setSectionPickerOpen(false)} onSelect={(url) => { setImageUrl(url); setSectionPickerOpen(false); }} />
    </>
  );
}

function DeleteBannerDialog({ id, onClose, onSuccess }: { id: number | null; onClose: () => void; onSuccess: () => void }) {
  const del = trpc.admin.deleteSiteBanner.useMutation({ onSuccess: () => { toast.success("באנר נמחק"); onSuccess(); onClose(); }, onError: (e) => toast.error(e.message) });
  return (
    <AlertDialog open={id != null} onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent className="bg-slate-900 border-slate-700"><AlertDialogHeader><AlertDialogTitle className="text-white">מחיקת באנר</AlertDialogTitle><AlertDialogDescription>האם למחוק? לא ניתן לשחזר.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>ביטול</AlertDialogCancel><AlertDialogAction className="bg-red-600" onClick={() => id != null && del.mutate({ id })} disabled={del.isPending}>מחק</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
    </AlertDialog>
  );
}
function DeleteAnnouncementDialog({ id, onClose, onSuccess }: { id: number | null; onClose: () => void; onSuccess: () => void }) {
  const del = trpc.admin.deleteSiteAnnouncement.useMutation({ onSuccess: () => { toast.success("הודעה נמחקה"); onSuccess(); onClose(); }, onError: (e) => toast.error(e.message) });
  return (
    <AlertDialog open={id != null} onOpenChange={(o) => !o && onClose()}><AlertDialogContent className="bg-slate-900 border-slate-700"><AlertDialogHeader><AlertDialogTitle className="text-white">מחיקת הודעה</AlertDialogTitle><AlertDialogDescription>האם למחוק?</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>ביטול</AlertDialogCancel><AlertDialogAction className="bg-red-600" onClick={() => id != null && del.mutate({ id })} disabled={del.isPending}>מחק</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  );
}
function DeletePageDialog({ id, onClose, onSuccess }: { id: number | null; onClose: () => void; onSuccess: () => void }) {
  const del = trpc.admin.deleteContentPage.useMutation({ onSuccess: () => { toast.success("דף נמחק"); onSuccess(); onClose(); }, onError: (e) => toast.error(e.message) });
  return (
    <AlertDialog open={id != null} onOpenChange={(o) => !o && onClose()}><AlertDialogContent className="bg-slate-900 border-slate-700"><AlertDialogHeader><AlertDialogTitle className="text-white">מחיקת דף</AlertDialogTitle><AlertDialogDescription>האם למחוק? סקשנים מקושרים יימחקו.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>ביטול</AlertDialogCancel><AlertDialogAction className="bg-red-600" onClick={() => id != null && del.mutate({ id })} disabled={del.isPending}>מחק</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  );
}
function DeleteSectionDialog({ id, onClose, onSuccess }: { id: number | null; onClose: () => void; onSuccess: () => void }) {
  const del = trpc.admin.deleteContentSection.useMutation({ onSuccess: () => { toast.success("סקשן נמחק"); onSuccess(); onClose(); }, onError: (e) => toast.error(e.message) });
  return (
    <AlertDialog open={id != null} onOpenChange={(o) => !o && onClose()}><AlertDialogContent className="bg-slate-900 border-slate-700"><AlertDialogHeader><AlertDialogTitle className="text-white">מחיקת סקשן</AlertDialogTitle><AlertDialogDescription>האם למחוק?</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>ביטול</AlertDialogCancel><AlertDialogAction className="bg-red-600" onClick={() => id != null && del.mutate({ id })} disabled={del.isPending}>מחק</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  );
}
