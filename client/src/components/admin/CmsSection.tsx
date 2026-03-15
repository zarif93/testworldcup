/**
 * CMS admin UI – pages (primary), banners, announcements, sections.
 * Admin-friendly Hebrew labels; draft/published; preview; validation.
 */

import { useState, useEffect } from "react";
import { Loader2, Plus, Pencil, Trash2, Image, Megaphone, FileText, Layout, ExternalLink, Eye, Send, XCircle, Monitor, Smartphone } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  BANNER_PLACEMENTS,
  BANNER_KEYS,
  getBannerPlacementLabel,
  PAGE_SLUGS,
  SECTION_PLACEMENTS,
  SECTION_KEYS,
  SECTION_TYPE_OPTIONS,
  SECTION_TYPES,
  getSectionPlacementLabel,
  getSectionTypeLabel,
  ANNOUNCEMENT_VARIANTS,
  CMS_CUSTOM_VALUE,
  CMS_CUSTOM_LABEL_HE,
} from "@/config/cmsPredefinedOptions";
import { MediaPickerModal } from "@/components/admin/MediaPickerModal";
import { toast } from "sonner";

/** Normalize slug for URL: lowercase, hyphens, no spaces */
function normalizeSlug(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9\-]/g, "");
}

const SLUG_REGEX = /^[a-z0-9\-]+$/;

type CmsTab = "pages" | "banners" | "announcements" | "sections";

export function CmsSection() {
  const [tab, setTab] = useState<CmsTab>("pages");
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
  const [deletePageTitle, setDeletePageTitle] = useState<string>("");
  const [deleteSectionId, setDeleteSectionId] = useState<number | null>(null);

  const utils = trpc.useUtils();
  const { data: banners, isLoading: bannersLoading } = trpc.admin.listSiteBanners.useQuery(undefined, { enabled: tab === "banners" });
  const { data: announcements, isLoading: announcementsLoading } = trpc.admin.listSiteAnnouncements.useQuery(undefined, { enabled: tab === "announcements" });
  const { data: pages, isLoading: pagesLoading } = trpc.admin.listContentPages.useQuery(undefined, { enabled: tab === "pages" || tab === "sections" });
  const { data: sections, isLoading: sectionsLoading } = trpc.admin.listContentSections.useQuery({ pageId: null }, { enabled: tab === "sections" });

  const tabs: { id: CmsTab; label: string; icon: React.ReactNode }[] = [
    { id: "pages", label: "דפי תוכן", icon: <FileText className="w-4 h-4" /> },
    { id: "banners", label: "באנרים", icon: <Image className="w-4 h-4" /> },
    { id: "announcements", label: "הודעות", icon: <Megaphone className="w-4 h-4" /> },
    { id: "sections", label: "בלוקים", icon: <Layout className="w-4 h-4" /> },
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
            <div>
              <h3 className="text-lg font-bold text-white">ניהול באנרים</h3>
              <p className="text-slate-400 text-sm mt-0.5">צור וערוך קמפיינים ופרסומים לפי מיקום באתר</p>
            </div>
            <Button size="sm" className="bg-amber-600 hover:bg-amber-700" onClick={() => { setEditingBannerId(null); setBannerFormOpen(true); }}>
              <Plus className="w-4 h-4 ml-1" /> באנר חדש
            </Button>
          </CardHeader>
          <CardContent>
            {bannersLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="w-8 h-8 animate-spin text-amber-500" /></div>
            ) : !banners?.length ? (
              <div className="rounded-lg border border-slate-600 bg-slate-900/30 p-8 text-center">
                <Image className="w-12 h-12 mx-auto text-slate-500 mb-3" />
                <p className="text-slate-400 font-medium">אין באנרים עדיין</p>
                <p className="text-slate-500 text-sm mt-1">הוסף באנר ראשון ובחר היכן להציג אותו באתר</p>
                <Button size="sm" className="mt-4 bg-amber-600 hover:bg-amber-700" onClick={() => { setEditingBannerId(null); setBannerFormOpen(true); }}>
                  <Plus className="w-4 h-4 ml-1" /> הוסף באנר
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right">
                  <thead>
                    <tr className="border-b border-slate-700 text-slate-400 text-sm">
                      <th className="py-2 px-2 font-medium">כותרת</th>
                      <th className="py-2 px-2 font-medium">מיקום</th>
                      <th className="py-2 px-2 font-medium">סטטוס</th>
                      <th className="py-2 px-2 font-medium">תאריכים</th>
                      <th className="py-2 px-2 font-medium">סדר</th>
                      <th className="py-2 px-2 w-24">פעולות</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(banners ?? []).map((b) => {
                      const bAny = b as { id: number; key: string; title?: string | null; subtitle?: string | null; isActive: boolean; sortOrder: number; startsAt?: Date | string | null; endsAt?: Date | string | null };
                      const startStr = bAny.startsAt ? new Date(bAny.startsAt).toLocaleDateString("he-IL", { day: "numeric", month: "short", year: "numeric" }) : "—";
                      const endStr = bAny.endsAt ? new Date(bAny.endsAt).toLocaleDateString("he-IL", { day: "numeric", month: "short", year: "numeric" }) : "—";
                      return (
                        <tr key={b.id} className="border-b border-slate-700/70 hover:bg-slate-800/50">
                          <td className="py-3 px-2">
                            <span className="font-medium text-white">{bAny.title || "ללא כותרת"}</span>
                          </td>
                          <td className="py-3 px-2 text-slate-300">{getBannerPlacementLabel(bAny.key)}</td>
                          <td className="py-3 px-2">
                            <span className={bAny.isActive ? "text-emerald-400" : "text-slate-500"}>{bAny.isActive ? "פעיל" : "לא פעיל"}</span>
                          </td>
                          <td className="py-3 px-2 text-slate-400 text-sm">{startStr} – {endStr}</td>
                          <td className="py-3 px-2 text-slate-400">{bAny.sortOrder}</td>
                          <td className="py-3 px-2">
                            <div className="flex gap-1 justify-end">
                              <Button size="sm" variant="ghost" className="text-slate-400" onClick={() => { setEditingBannerId(b.id); setBannerFormOpen(true); }}><Pencil className="w-4 h-4" /></Button>
                              <Button size="sm" variant="ghost" className="text-red-400" onClick={() => setDeleteBannerId(b.id)}><Trash2 className="w-4 h-4" /></Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
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
          <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
            <h3 className="text-lg font-bold text-white">דפי תוכן</h3>
            <Button size="sm" className="bg-amber-600 hover:bg-amber-700" onClick={() => { setEditingPageId(null); setPageFormOpen(true); }}>
              <Plus className="w-4 h-4 ml-1" /> דף חדש
            </Button>
          </CardHeader>
          <CardContent>
            {pagesLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-amber-500" /></div>
            ) : !pages?.length ? (
              <div className="text-center py-12 px-4">
                <FileText className="w-12 h-12 text-slate-500 mx-auto mb-3" />
                <p className="text-slate-400 mb-1">עדיין אין דפי תוכן</p>
                <p className="text-slate-500 text-sm mb-4">צור דף ראשון כדי להציג תוכן באתר (אודות, תקנון, פרטיות ועוד).</p>
                <Button className="bg-amber-600 hover:bg-amber-700" onClick={() => { setEditingPageId(null); setPageFormOpen(true); }}>
                  <Plus className="w-4 h-4 ml-1" /> צור דף ראשון
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {(pages ?? []).map((p) => {
                  const updatedAt = (p as { updatedAt?: Date | string | null }).updatedAt;
                  const updatedStr = updatedAt ? (typeof updatedAt === "string" ? new Date(updatedAt) : updatedAt).toLocaleDateString("he-IL", { day: "numeric", month: "short", year: "numeric" }) : "—";
                  const isPublished = (p as { status?: string }).status === "published";
                  return (
                    <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 p-4 rounded-lg bg-slate-900/50 border border-slate-700">
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-white truncate">{(p as { title?: string }).title ?? p.slug}</div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-sm">
                          <span className="text-slate-500">כתובת: /page/{p.slug}</span>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${isPublished ? "bg-emerald-500/20 text-emerald-400" : "bg-slate-600 text-slate-400"}`}>
                            {isPublished ? "פורסם באתר" : "נשמר כטיוטה"}
                          </span>
                          <span className="text-slate-500 text-xs">עודכן: {updatedStr}</span>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1 shrink-0">
                        <Button size="sm" variant="ghost" className="text-slate-300" onClick={() => { setEditingPageId(p.id); setPageFormOpen(true); }}>
                          <Pencil className="w-4 h-4 ml-1" /> עריכה
                        </Button>
                        {isPublished && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-slate-300"
                            onClick={() => window.open(`${typeof window !== "undefined" ? window.location.origin : ""}/page/${encodeURIComponent(p.slug)}`, "_blank")}
                          >
                            <Eye className="w-4 h-4 ml-1" /> צפייה
                          </Button>
                        )}
                        <PublishUnpublishButton pageId={p.id} currentStatus={isPublished ? "published" : "draft"} onSuccess={() => utils.admin.listContentPages.invalidate()} />
                        <Button size="sm" variant="ghost" className="text-red-400 hover:text-red-300" onClick={() => { setDeletePageId(p.id); setDeletePageTitle((p as { title?: string }).title ?? p.slug); }}>
                          <Trash2 className="w-4 h-4 ml-1" /> מחק
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {tab === "sections" && (
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-white">בלוקים גלובליים</h3>
              <p className="text-slate-400 text-sm mt-0.5">הוסף וערוך בלוקי תוכן שמוצגים בדף הבית ובדפים אחרים</p>
            </div>
            <Button size="sm" className="bg-amber-600 hover:bg-amber-700" onClick={() => { setEditingSectionId(null); setSectionFormOpen(true); }}>
              <Plus className="w-4 h-4 ml-1" /> הוסף בלוק
            </Button>
          </CardHeader>
          <CardContent>
            {sectionsLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="w-8 h-8 animate-spin text-amber-500" /></div>
            ) : !sections?.length ? (
              <div className="rounded-lg border border-slate-600 bg-slate-900/30 p-8 text-center">
                <Layout className="w-12 h-12 mx-auto text-slate-500 mb-3" />
                <p className="text-slate-400 font-medium">אין בלוקים עדיין</p>
                <p className="text-slate-500 text-sm mt-1">הוסף בלוק ראשון ובחר היכן להציג אותו באתר</p>
                <Button size="sm" className="mt-4 bg-amber-600 hover:bg-amber-700" onClick={() => { setEditingSectionId(null); setSectionFormOpen(true); }}>
                  <Plus className="w-4 h-4 ml-1" /> הוסף בלוק
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right">
                  <thead>
                    <tr className="border-b border-slate-700 text-slate-400 text-sm">
                      <th className="py-2 px-2 font-medium">כותרת</th>
                      <th className="py-2 px-2 font-medium">מיקום</th>
                      <th className="py-2 px-2 font-medium">סוג</th>
                      <th className="py-2 px-2 font-medium">סטטוס</th>
                      <th className="py-2 px-2 font-medium">תאריכים</th>
                      <th className="py-2 px-2 font-medium">סדר</th>
                      <th className="py-2 px-2 w-24">פעולות</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(sections ?? []).map((s) => {
                      const sAny = s as { id: number; key: string; type: string; title?: string | null; isActive: boolean; sortOrder: number; metadataJson?: { startsAt?: string; endsAt?: string } | null };
                      const meta = sAny.metadataJson;
                      const startStr = meta?.startsAt ? new Date(meta.startsAt).toLocaleDateString("he-IL", { day: "numeric", month: "short", year: "numeric" }) : "—";
                      const endStr = meta?.endsAt ? new Date(meta.endsAt).toLocaleDateString("he-IL", { day: "numeric", month: "short", year: "numeric" }) : "—";
                      return (
                        <tr key={s.id} className="border-b border-slate-700/70 hover:bg-slate-800/50">
                          <td className="py-3 px-2"><span className="font-medium text-white">{sAny.title || "ללא כותרת"}</span></td>
                          <td className="py-3 px-2 text-slate-300">{getSectionPlacementLabel(sAny.key)}</td>
                          <td className="py-3 px-2 text-slate-300">{getSectionTypeLabel(sAny.type)}</td>
                          <td className="py-3 px-2"><span className={sAny.isActive ? "text-emerald-400" : "text-slate-500"}>{sAny.isActive ? "פעיל" : "לא פעיל"}</span></td>
                          <td className="py-3 px-2 text-slate-400 text-sm">{startStr} – {endStr}</td>
                          <td className="py-3 px-2 text-slate-400">{sAny.sortOrder}</td>
                          <td className="py-3 px-2">
                            <div className="flex gap-1 justify-end">
                              <Button size="sm" variant="ghost" className="text-slate-400" onClick={() => { setEditingSectionId(s.id); setSectionFormOpen(true); }}><Pencil className="w-4 h-4" /></Button>
                              <Button size="sm" variant="ghost" className="text-red-400" onClick={() => setDeleteSectionId(s.id)}><Trash2 className="w-4 h-4" /></Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Banner form modal – campaign-oriented: placement, content, media, action, settings, scheduling, preview */}
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
      <DeletePageDialog id={deletePageId} title={deletePageTitle} onClose={() => { setDeletePageId(null); setDeletePageTitle(""); }} onSuccess={() => { utils.admin.listContentPages.invalidate(); setDeletePageId(null); setDeletePageTitle(""); }} />
      <DeleteSectionDialog id={deleteSectionId} onClose={() => setDeleteSectionId(null)} onSuccess={() => { utils.admin.listContentSections.invalidate(); setDeleteSectionId(null); }} />
    </div>
  );
}

function PublishUnpublishButton({ pageId, currentStatus, onSuccess }: { pageId: number; currentStatus: "draft" | "published"; onSuccess: () => void }) {
  const update = trpc.admin.updateContentPage.useMutation({ onSuccess: () => { toast.success(currentStatus === "published" ? "הדף הוסר מפרסום" : "הדף פורסם"); onSuccess(); }, onError: (e) => toast.error(e.message) });
  const isPublished = currentStatus === "published";
  return (
    <Button
      size="sm"
      variant="ghost"
      className={isPublished ? "text-amber-400" : "text-emerald-400"}
      onClick={() => update.mutate({ id: pageId, status: isPublished ? "draft" : "published" })}
      disabled={update.isPending}
    >
      {update.isPending ? <Loader2 className="w-4 h-4 animate-spin ml-1" /> : isPublished ? <XCircle className="w-4 h-4 ml-1" /> : <Send className="w-4 h-4 ml-1" />}
      {isPublished ? "הסר מפרסום" : "פרסם"}
    </Button>
  );
}

function formatDateForInput(d: Date | string | null | undefined): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toISOString().slice(0, 10);
}

function BannerFormModal({ open, onClose, editingId }: { open: boolean; onClose: () => void; editingId: number | null }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<"image" | "mobile" | null>(null);
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">("desktop");
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
  const [sortOrder, setSortOrder] = useState(0);
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const key = keySelect === CMS_CUSTOM_VALUE ? keyCustom : keySelect;
  useEffect(() => {
    if (banner) {
      const b = banner as { key: string; title?: string | null; subtitle?: string | null; imageUrl?: string | null; mobileImageUrl?: string | null; buttonText?: string | null; buttonUrl?: string | null; isActive: boolean; sortOrder?: number; startsAt?: Date | string | null; endsAt?: Date | string | null };
      const inList = BANNER_PLACEMENTS.some((o) => o.value === b.key);
      setKeySelect(inList ? b.key : CMS_CUSTOM_VALUE);
      setKeyCustom(inList ? "" : b.key);
      setTitle(b.title ?? ""); setSubtitle(b.subtitle ?? ""); setImageUrl(b.imageUrl ?? ""); setMobileImageUrl(b.mobileImageUrl ?? ""); setButtonText(b.buttonText ?? ""); setButtonUrl(b.buttonUrl ?? ""); setIsActive(b.isActive);
      setSortOrder(typeof b.sortOrder === "number" ? b.sortOrder : 0);
      setStartsAt(formatDateForInput(b.startsAt)); setEndsAt(formatDateForInput(b.endsAt));
    } else if (!editingId && open) {
      setKeySelect(""); setKeyCustom(""); setTitle(""); setSubtitle(""); setImageUrl(""); setMobileImageUrl(""); setButtonText(""); setButtonUrl(""); setIsActive(true); setSortOrder(0); setStartsAt(""); setEndsAt("");
    }
  }, [banner, editingId, open]);
  const submit = () => {
    if (!key.trim()) { toast.error("נא לבחור מיקום לבאנר"); return; }
    const startsAtDate = startsAt ? new Date(startsAt + "T00:00:00") : null;
    const endsAtDate = endsAt ? new Date(endsAt + "T23:59:59") : null;
    const payload = {
      key: key.trim(),
      title: title.trim() || null,
      subtitle: subtitle.trim() || null,
      imageUrl: imageUrl.trim() || null,
      mobileImageUrl: mobileImageUrl.trim() || null,
      buttonText: buttonText.trim() || null,
      buttonUrl: buttonUrl.trim() || null,
      isActive,
      sortOrder,
      startsAt: startsAtDate,
      endsAt: endsAtDate,
    };
    if (editingId) update.mutate({ id: editingId, ...payload });
    else create.mutate(payload);
  };
  const openPicker = (target: "image" | "mobile") => { setPickerTarget(target); setPickerOpen(true); };
  const handlePickerSelect = (url: string) => { if (pickerTarget === "image") setImageUrl(url); else if (pickerTarget === "mobile") setMobileImageUrl(url); setPickerTarget(null); };
  const previewImage = previewMode === "mobile" && mobileImageUrl ? mobileImageUrl : imageUrl;
  return (
    <>
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-white">{editingId ? "עריכת באנר" : "באנר חדש – קמפיין"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-5 py-2">
          {/* מיקום – placement with descriptions */}
          <div className="rounded-lg bg-slate-800/50 border border-slate-600 p-3">
            <Label className="text-slate-300 font-medium">מיקום באתר</Label>
            <p className="text-slate-500 text-xs mt-0.5 mb-2">היכן הבאנר יוצג למבקרים</p>
            <select className="bg-slate-800 text-white rounded px-3 py-2 w-full border border-slate-600" value={keySelect} onChange={(e) => setKeySelect(e.target.value)}>
              <option value="">בחר מיקום...</option>
              {BANNER_PLACEMENTS.map((o) => (
                <option key={o.value} value={o.value}>{o.labelHe}</option>
              ))}
              <option value={CMS_CUSTOM_VALUE}>{CMS_CUSTOM_LABEL_HE}</option>
            </select>
            {keySelect && keySelect !== CMS_CUSTOM_VALUE && (
              <p className="text-slate-500 text-xs mt-2">{BANNER_PLACEMENTS.find((p) => p.value === keySelect)?.descriptionHe}</p>
            )}
            {keySelect === CMS_CUSTOM_VALUE && (
              <Input className="bg-slate-800 text-white mt-2 border-slate-600" value={keyCustom} onChange={(e) => setKeyCustom(e.target.value)} placeholder="מפתח מותאם (למשל homepage_hero)" />
            )}
          </div>

          {/* תוכן */}
          <div className="rounded-lg bg-slate-800/50 border border-slate-600 p-3">
            <h4 className="text-slate-300 font-medium mb-2">תוכן</h4>
            <div className="grid gap-2">
              <div><Label className="text-slate-400 text-sm">כותרת</Label><Input className="bg-slate-800 text-white mt-1 border-slate-600" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="כותרת הבאנר" /></div>
              <div><Label className="text-slate-400 text-sm">תת כותרת</Label><Input className="bg-slate-800 text-white mt-1 border-slate-600" value={subtitle} onChange={(e) => setSubtitle(e.target.value)} placeholder="אופציונלי" /></div>
            </div>
          </div>

          {/* מדיה */}
          <div className="rounded-lg bg-slate-800/50 border border-slate-600 p-3">
            <h4 className="text-slate-300 font-medium mb-2">מדיה</h4>
            <div className="grid gap-2">
              <div>
                <Label className="text-slate-400 text-sm">תמונת רקע (דסקטופ)</Label>
                <div className="flex gap-2 mt-1">
                  <Input className="bg-slate-800 text-white border-slate-600 flex-1" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="קישור או בחר מהספרייה" />
                  <Button type="button" size="sm" variant="outline" className="border-slate-600 text-slate-300 shrink-0" onClick={() => openPicker("image")}>בחר תמונה</Button>
                </div>
              </div>
              <div>
                <Label className="text-slate-400 text-sm">תמונה מובייל (אופציונלי)</Label>
                <div className="flex gap-2 mt-1">
                  <Input className="bg-slate-800 text-white border-slate-600 flex-1" value={mobileImageUrl} onChange={(e) => setMobileImageUrl(e.target.value)} placeholder="אם ריק – תשתמש בתמונת הדסקטופ" />
                  <Button type="button" size="sm" variant="outline" className="border-slate-600 text-slate-300 shrink-0" onClick={() => openPicker("mobile")}>בחר תמונה</Button>
                </div>
              </div>
            </div>
          </div>

          {/* פעולה */}
          <div className="rounded-lg bg-slate-800/50 border border-slate-600 p-3">
            <h4 className="text-slate-300 font-medium mb-2">פעולה (כפתור)</h4>
            <div className="grid gap-2">
              <div><Label className="text-slate-400 text-sm">טקסט כפתור</Label><Input className="bg-slate-800 text-white mt-1 border-slate-600" value={buttonText} onChange={(e) => setButtonText(e.target.value)} placeholder="למשל: הרשם עכשיו" /></div>
              <div><Label className="text-slate-400 text-sm">קישור כפתור</Label><Input className="bg-slate-800 text-white mt-1 border-slate-600" value={buttonUrl} onChange={(e) => setButtonUrl(e.target.value)} placeholder="/tournaments או כתובת מלאה" /></div>
            </div>
          </div>

          {/* הגדרות + תזמון */}
          <div className="rounded-lg bg-slate-800/50 border border-slate-600 p-3">
            <h4 className="text-slate-300 font-medium mb-2">הגדרות ותזמון</h4>
            <div className="grid gap-3">
              <label className="flex items-center gap-2 text-slate-400">
                <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="rounded border-slate-600" />
                פעיל – הבאנר יוצג באתר (בהתאם לתאריכים אם הוגדרו)
              </label>
              <div className="grid grid-cols-2 gap-2">
                <div><Label className="text-slate-400 text-sm">סדר תצוגה</Label><Input type="number" className="bg-slate-800 text-white mt-1 border-slate-600" value={sortOrder} onChange={(e) => setSortOrder(parseInt(e.target.value, 10) || 0)} min={0} /></div>
                <div />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label className="text-slate-400 text-sm">תאריך התחלה</Label><Input type="date" className="bg-slate-800 text-white mt-1 border-slate-600" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} /></div>
                <div><Label className="text-slate-400 text-sm">תאריך סיום</Label><Input type="date" className="bg-slate-800 text-white mt-1 border-slate-600" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} /></div>
              </div>
              <p className="text-slate-500 text-xs">הבאנר יופעל אוטומטית מתאריך ההתחלה וייכבה בתאריך הסיום. השאר ריק לתצוגה קבועה.</p>
            </div>
          </div>

          {/* תצוגה מקדימה */}
          <div className="rounded-lg bg-slate-800/50 border border-slate-600 p-3">
            <h4 className="text-slate-300 font-medium mb-2">תצוגה מקדימה</h4>
            <div className="flex gap-2 mb-3">
              <Button type="button" size="sm" variant={previewMode === "desktop" ? "default" : "outline"} className={previewMode === "desktop" ? "bg-amber-600 hover:bg-amber-700" : "border-slate-600"} onClick={() => setPreviewMode("desktop")}><Monitor className="w-4 h-4 ml-1" /> דסקטופ</Button>
              <Button type="button" size="sm" variant={previewMode === "mobile" ? "default" : "outline"} className={previewMode === "mobile" ? "bg-amber-600 hover:bg-amber-700" : "border-slate-600"} onClick={() => setPreviewMode("mobile")}><Smartphone className="w-4 h-4 ml-1" /> מובייל</Button>
            </div>
            <div className={`relative rounded-lg overflow-hidden border border-slate-600 bg-slate-900 ${previewMode === "desktop" ? "aspect-[2.5/1] min-h-[120px]" : "aspect-[9/16] max-w-[200px] mx-auto min-h-[200px]"}`}>
              {previewImage ? (
                <img src={previewImage} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-500 text-sm">אין תמונה – הוסף תמונת רקע</div>
              )}
              <div className="absolute inset-0 flex flex-col justify-end p-3 bg-gradient-to-t from-black/80 to-transparent pointer-events-none rounded-lg">
                {title && <span className="text-white font-bold text-lg">{title}</span>}
                {subtitle && <span className="text-slate-200 text-sm">{subtitle}</span>}
                {buttonText && <span className="mt-2 inline-flex w-fit rounded bg-amber-500 px-3 py-1 text-sm text-white">{buttonText}</span>}
              </div>
            </div>
          </div>
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
  const [pickerOpen, setPickerOpen] = useState(false);
  const { data: page } = trpc.admin.getContentPageById.useQuery({ id: editingId! }, { enabled: open && editingId != null });
  const create = trpc.admin.createContentPage.useMutation({ onSuccess: () => { toast.success("הדף נוצר"); onClose(); }, onError: (e) => toast.error(e.message) });
  const update = trpc.admin.updateContentPage.useMutation({ onSuccess: () => { toast.success("הדף נשמר"); onClose(); }, onError: (e) => toast.error(e.message) });
  const [slugSelect, setSlugSelect] = useState("");
  const [slugCustom, setSlugCustom] = useState("");
  const [title, setTitle] = useState("");
  const [shortDescription, setShortDescription] = useState("");
  const [body, setBody] = useState("");
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");
  const [status, setStatus] = useState<"draft" | "published">("draft");
  const slugRaw = slugSelect === CMS_CUSTOM_VALUE ? slugCustom : slugSelect;
  const slug = normalizeSlug(slugRaw);
  useEffect(() => {
    if (page) {
      const p = page as { slug: string; title: string; shortDescription?: string | null; body?: string | null; coverImageUrl?: string | null; seoTitle?: string | null; seoDescription?: string | null; status: string };
      const inList = PAGE_SLUGS.some((o) => o.value === p.slug);
      setSlugSelect(inList ? p.slug : CMS_CUSTOM_VALUE);
      setSlugCustom(inList ? "" : p.slug);
      setTitle(p.title);
      setShortDescription(p.shortDescription ?? "");
      setBody(p.body ?? "");
      setCoverImageUrl(p.coverImageUrl ?? "");
      setSeoTitle(p.seoTitle ?? "");
      setSeoDescription(p.seoDescription ?? "");
      setStatus(p.status as "draft" | "published");
    } else if (!editingId && open) {
      setSlugSelect(""); setSlugCustom(""); setTitle(""); setShortDescription(""); setBody(""); setCoverImageUrl(""); setSeoTitle(""); setSeoDescription(""); setStatus("draft");
    }
  }, [page, editingId, open]);
  const submit = () => {
    if (!title.trim()) { toast.error("כותרת הדף חובה"); return; }
    const finalSlug = slug || normalizeSlug(title);
    if (!finalSlug) { toast.error("כתובת הדף חובה (אותיות אנגלית קטנות, מספרים ומקף)"); return; }
    if (!SLUG_REGEX.test(finalSlug)) { toast.error("כתובת הדף: רק אותיות אנגלית קטנות, מספרים ומקף"); return; }
    const payload = {
      slug: finalSlug,
      title: title.trim(),
      shortDescription: shortDescription.trim() || null,
      body: body.trim() || null,
      coverImageUrl: coverImageUrl.trim() || null,
      seoTitle: seoTitle.trim() || null,
      seoDescription: seoDescription.trim() || null,
      status,
    };
    if (editingId) update.mutate({ id: editingId, ...payload });
    else create.mutate(payload);
  };
  return (
    <>
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="text-white">{editingId ? "עריכת דף" : "דף חדש"}</DialogTitle></DialogHeader>
        <div className="grid gap-4 py-2">
          {!editingId && (
            <div className="rounded-lg bg-slate-800/50 border border-slate-600 p-3">
              <Label className="text-slate-400 text-sm">דפים מומלצים</Label>
              <p className="text-slate-500 text-xs mt-1 mb-2">בחירה תמלא כותרת וכתובת</p>
              <div className="flex flex-wrap gap-1">
                {PAGE_SLUGS.map((o) => (
                  <Button key={o.value} type="button" size="sm" variant="outline" className="border-slate-600 text-slate-300 text-xs" onClick={() => { setSlugSelect(o.value); setSlugCustom(""); setTitle(o.labelHe); }}>
                    {o.labelHe}
                  </Button>
                ))}
              </div>
            </div>
          )}
          <div>
            <Label className="text-slate-300">כותרת הדף *</Label>
            <Input className="bg-slate-800 text-white mt-1 border-slate-600" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="למשל: אודותינו" />
          </div>
          <div>
            <Label className="text-slate-300">כתובת הדף (URL)</Label>
            <Input className="bg-slate-800 text-white mt-1 border-slate-600 font-mono text-sm" value={slugSelect === CMS_CUSTOM_VALUE ? slugCustom : slugSelect} onChange={(e) => { setSlugSelect(CMS_CUSTOM_VALUE); setSlugCustom(e.target.value); }} placeholder="about" />
            <p className="text-slate-500 text-xs mt-1">רק אותיות אנגלית קטנות, מספרים ומקף. הדף יופיע בכתובת: /page/{slug || "..."}</p>
          </div>
          <div>
            <Label className="text-slate-300">תיאור קצר (אופציונלי)</Label>
            <Input className="bg-slate-800 text-white mt-1 border-slate-600" value={shortDescription} onChange={(e) => setShortDescription(e.target.value)} placeholder="משמש בתצוגת תקציר" />
          </div>
          <div>
            <Label className="text-slate-300">תוכן ראשי (אופציונלי)</Label>
            <Textarea className="bg-slate-800 text-white mt-1 border-slate-600 min-h-[120px]" value={body} onChange={(e) => setBody(e.target.value)} placeholder="טקסט חופשי. ניתן להוסיף גם בלוקים בדף אחרי השמירה." />
          </div>
          <div>
            <Label className="text-slate-300">תמונת כיסוי (אופציונלי)</Label>
            <div className="flex gap-2 mt-1">
              <Input className="bg-slate-800 text-white border-slate-600 flex-1" value={coverImageUrl} onChange={(e) => setCoverImageUrl(e.target.value)} placeholder="קישור או בחר מהספרייה" />
              <Button type="button" size="sm" variant="outline" className="border-slate-600 text-slate-300 shrink-0" onClick={() => setPickerOpen(true)}>בחר תמונה</Button>
            </div>
          </div>
          <div className="border-t border-slate-700 pt-3">
            <Label className="text-slate-400 text-sm">SEO (למנועי חיפוש)</Label>
            <div className="grid gap-2 mt-2">
              <div><Label className="text-slate-500 text-xs">כותרת SEO</Label><Input className="bg-slate-800 text-white mt-0.5 border-slate-600 text-sm" value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)} placeholder="אופציונלי" /></div>
              <div><Label className="text-slate-500 text-xs">תיאור SEO</Label><Input className="bg-slate-800 text-white mt-0.5 border-slate-600 text-sm" value={seoDescription} onChange={(e) => setSeoDescription(e.target.value)} placeholder="אופציונלי" /></div>
            </div>
          </div>
          <div>
            <Label className="text-slate-300">סטטוס</Label>
            <select className="bg-slate-800 text-white rounded px-3 py-2 w-full mt-1 border border-slate-600" value={status} onChange={(e) => setStatus(e.target.value as "draft" | "published")}>
              <option value="draft">נשמר כטיוטה – לא יוצג באתר</option>
              <option value="published">פורסם באתר – הדף גלוי למבקרים</option>
            </select>
          </div>
        </div>
        <DialogFooter><Button variant="ghost" onClick={onClose}>ביטול</Button><Button className="bg-amber-600 hover:bg-amber-700" onClick={submit} disabled={create.isPending || update.isPending}>{create.isPending || update.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "שמירה"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
    <MediaPickerModal open={pickerOpen} onClose={() => setPickerOpen(false)} onSelect={(url) => { setCoverImageUrl(url); setPickerOpen(false); }} />
    </>
  );
}

function formatSectionDateForInput(d: string | null | undefined): string {
  if (!d) return "";
  try { return new Date(d).toISOString().slice(0, 10); } catch { return ""; }
}

function SectionFormModal({ open, onClose, editingId, pageId }: { open: boolean; onClose: () => void; editingId: number | null; pageId: number | null }) {
  const [sectionPickerOpen, setSectionPickerOpen] = useState(false);
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">("desktop");
  const { data: section } = trpc.admin.getContentSectionById.useQuery({ id: editingId! }, { enabled: open && editingId != null });
  const create = trpc.admin.createContentSection.useMutation({ onSuccess: () => { toast.success("בלוק נוצר"); onClose(); }, onError: (e) => toast.error(e.message) });
  const update = trpc.admin.updateContentSection.useMutation({ onSuccess: () => { toast.success("בלוק עודכן"); onClose(); }, onError: (e) => toast.error(e.message) });
  const [keySelect, setKeySelect] = useState("");
  const [keyCustom, setKeyCustom] = useState("");
  const [typeSelect, setTypeSelect] = useState("hero");
  const [typeCustom, setTypeCustom] = useState("");
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [body, setBody] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [sortOrder, setSortOrder] = useState(0);
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const key = keySelect === CMS_CUSTOM_VALUE ? keyCustom : keySelect;
  const type = typeSelect === CMS_CUSTOM_VALUE ? typeCustom : typeSelect;
  useEffect(() => {
    if (section) {
      const s = section as { key: string; type: string; title?: string | null; subtitle?: string | null; body?: string | null; imageUrl?: string | null; isActive: boolean; sortOrder?: number; metadataJson?: { startsAt?: string; endsAt?: string } | null };
      const keyInList = SECTION_PLACEMENTS.some((o) => o.value === s.key);
      const typeInList = SECTION_TYPE_OPTIONS.some((o) => o.value === s.type);
      setKeySelect(keyInList ? s.key : CMS_CUSTOM_VALUE);
      setKeyCustom(keyInList ? "" : s.key);
      setTypeSelect(typeInList ? s.type : CMS_CUSTOM_VALUE);
      setTypeCustom(typeInList ? "" : s.type);
      setTitle(s.title ?? ""); setSubtitle(s.subtitle ?? ""); setBody(s.body ?? ""); setImageUrl(s.imageUrl ?? ""); setIsActive(s.isActive);
      setSortOrder(typeof s.sortOrder === "number" ? s.sortOrder : 0);
      setStartsAt(formatSectionDateForInput(s.metadataJson?.startsAt)); setEndsAt(formatSectionDateForInput(s.metadataJson?.endsAt));
    } else if (!editingId && open) {
      setKeySelect(""); setKeyCustom(""); setTypeSelect("hero"); setTypeCustom(""); setTitle(""); setSubtitle(""); setBody(""); setImageUrl(""); setIsActive(true); setSortOrder(0); setStartsAt(""); setEndsAt("");
    }
  }, [section, editingId, open]);
  const submit = () => {
    if (!key.trim() || !type.trim()) { toast.error("מיקום וסוג בלוק חובה"); return; }
    const metadataJson = (startsAt || endsAt) ? { startsAt: startsAt ? new Date(startsAt + "T00:00:00").toISOString() : null, endsAt: endsAt ? new Date(endsAt + "T23:59:59").toISOString() : null } : null;
    const payload = { pageId, key: key.trim(), type: type.trim(), title: title.trim() || null, subtitle: subtitle.trim() || null, body: body.trim() || null, imageUrl: imageUrl.trim() || null, isActive, sortOrder, metadataJson };
    if (editingId) update.mutate({ id: editingId, ...payload });
    else create.mutate(payload);
  };
  return (
    <>
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="text-white">{editingId ? "עריכת בלוק" : "בלוק חדש"}</DialogTitle></DialogHeader>
        <div className="grid gap-5 py-2">
          {/* מיקום */}
          <div className="rounded-lg bg-slate-800/50 border border-slate-600 p-3">
            <Label className="text-slate-300 font-medium">מיקום באתר</Label>
            <p className="text-slate-500 text-xs mt-0.5 mb-2">היכן הבלוק יוצג</p>
            <select className="bg-slate-800 text-white rounded px-3 py-2 w-full border border-slate-600" value={keySelect} onChange={(e) => setKeySelect(e.target.value)}>
              <option value="">בחר מיקום...</option>
              {SECTION_PLACEMENTS.map((o) => (
                <option key={o.value} value={o.value}>{o.labelHe}</option>
              ))}
              <option value={CMS_CUSTOM_VALUE}>{CMS_CUSTOM_LABEL_HE}</option>
            </select>
            {keySelect && keySelect !== CMS_CUSTOM_VALUE && (
              <p className="text-slate-500 text-xs mt-2">{SECTION_PLACEMENTS.find((p) => p.value === keySelect)?.descriptionHe}</p>
            )}
            {keySelect === CMS_CUSTOM_VALUE && (
              <Input className="bg-slate-800 text-white mt-2 border-slate-600" value={keyCustom} onChange={(e) => setKeyCustom(e.target.value)} placeholder="homepage_features" />
            )}
          </div>

          {/* תוכן */}
          <div className="rounded-lg bg-slate-800/50 border border-slate-600 p-3">
            <h4 className="text-slate-300 font-medium mb-2">תוכן</h4>
            <div className="grid gap-2">
              <div>
                <Label className="text-slate-400 text-sm">סוג בלוק</Label>
                <select className="bg-slate-800 text-white rounded px-3 py-2 w-full mt-1 border border-slate-600" value={typeSelect} onChange={(e) => setTypeSelect(e.target.value)}>
                  {SECTION_TYPE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.labelHe}</option>
                  ))}
                  <option value={CMS_CUSTOM_VALUE}>{CMS_CUSTOM_LABEL_HE}</option>
                </select>
                {typeSelect && typeSelect !== CMS_CUSTOM_VALUE && (
                  <p className="text-slate-500 text-xs mt-1">{SECTION_TYPE_OPTIONS.find((t) => t.value === typeSelect)?.descriptionHe}</p>
                )}
                {typeSelect === CMS_CUSTOM_VALUE && (
                  <Input className="bg-slate-800 text-white mt-2 border-slate-600" value={typeCustom} onChange={(e) => setTypeCustom(e.target.value)} placeholder="text" />
                )}
              </div>
              <div><Label className="text-slate-400 text-sm">כותרת</Label><Input className="bg-slate-800 text-white mt-1 border-slate-600" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="כותרת הבלוק" /></div>
              <div><Label className="text-slate-400 text-sm">תת כותרת</Label><Input className="bg-slate-800 text-white mt-1 border-slate-600" value={subtitle} onChange={(e) => setSubtitle(e.target.value)} /></div>
              <div><Label className="text-slate-400 text-sm">תוכן ראשי</Label><Textarea className="bg-slate-800 text-white mt-1 border-slate-600 min-h-[80px]" value={body} onChange={(e) => setBody(e.target.value)} placeholder="טקסט חופשי. בסוג תכונות/כרטיסים – שורה = פריט." /></div>
            </div>
          </div>

          {/* מדיה */}
          <div className="rounded-lg bg-slate-800/50 border border-slate-600 p-3">
            <h4 className="text-slate-300 font-medium mb-2">מדיה</h4>
            <div>
              <Label className="text-slate-400 text-sm">תמונה (אופציונלי)</Label>
              <div className="flex gap-2 mt-1">
                <Input className="bg-slate-800 text-white border-slate-600 flex-1" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="קישור או בחר מהספרייה" />
                <Button type="button" size="sm" variant="outline" className="border-slate-600 text-slate-300 shrink-0" onClick={() => setSectionPickerOpen(true)}>בחר תמונה</Button>
              </div>
            </div>
          </div>

          {/* הגדרות */}
          <div className="rounded-lg bg-slate-800/50 border border-slate-600 p-3">
            <h4 className="text-slate-300 font-medium mb-2">הגדרות ותזמון</h4>
            <div className="grid gap-3">
              <label className="flex items-center gap-2 text-slate-400">
                <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="rounded border-slate-600" />
                פעיל – הבלוק יוצג באתר
              </label>
              <div className="grid grid-cols-2 gap-2">
                <div><Label className="text-slate-400 text-sm">סדר תצוגה</Label><Input type="number" className="bg-slate-800 text-white mt-1 border-slate-600" value={sortOrder} onChange={(e) => setSortOrder(parseInt(e.target.value, 10) || 0)} min={0} /></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label className="text-slate-400 text-sm">תאריך התחלה</Label><Input type="date" className="bg-slate-800 text-white mt-1 border-slate-600" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} /></div>
                <div><Label className="text-slate-400 text-sm">תאריך סיום</Label><Input type="date" className="bg-slate-800 text-white mt-1 border-slate-600" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} /></div>
              </div>
              <p className="text-slate-500 text-xs">הבלוק יופעל אוטומטית בתאריך ההתחלה וייכבה בתאריך הסיום. השאר ריק לתצוגה קבועה.</p>
            </div>
          </div>

          {/* תצוגה מקדימה */}
          <div className="rounded-lg bg-slate-800/50 border border-slate-600 p-3">
            <h4 className="text-slate-300 font-medium mb-2">תצוגה מקדימה</h4>
            <div className="flex gap-2 mb-3">
              <Button type="button" size="sm" variant={previewMode === "desktop" ? "default" : "outline"} className={previewMode === "desktop" ? "bg-amber-600 hover:bg-amber-700" : "border-slate-600"} onClick={() => setPreviewMode("desktop")}><Monitor className="w-4 h-4 ml-1" /> דסקטופ</Button>
              <Button type="button" size="sm" variant={previewMode === "mobile" ? "default" : "outline"} className={previewMode === "mobile" ? "bg-amber-600 hover:bg-amber-700" : "border-slate-600"} onClick={() => setPreviewMode("mobile")}><Smartphone className="w-4 h-4 ml-1" /> מובייל</Button>
            </div>
            <div className={`rounded-lg overflow-hidden border border-slate-600 bg-slate-900 p-4 ${previewMode === "desktop" ? "" : "max-w-[280px] mx-auto"}`}>
              {imageUrl && <img src={imageUrl} alt="" className="w-full max-h-24 object-cover rounded mb-3" />}
              {title && <p className="text-white font-bold text-lg">{title}</p>}
              {subtitle && <p className="text-slate-400 text-sm mt-0.5">{subtitle}</p>}
              {body && <p className="text-slate-300 text-sm mt-2 whitespace-pre-wrap line-clamp-3">{body}</p>}
              <p className="text-slate-500 text-xs mt-2">סוג: {getSectionTypeLabel(type) || type}</p>
            </div>
          </div>
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
function DeletePageDialog({ id, title, onClose, onSuccess }: { id: number | null; title?: string; onClose: () => void; onSuccess: () => void }) {
  const del = trpc.admin.deleteContentPage.useMutation({ onSuccess: () => { toast.success("הדף נמחק"); onSuccess(); onClose(); }, onError: (e) => toast.error(e.message) });
  return (
    <AlertDialog open={id != null} onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent className="bg-slate-900 border-slate-700">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-white">מחיקת דף</AlertDialogTitle>
          <AlertDialogDescription>
            {title ? `האם למחוק את הדף «${title}»?` : "האם למחוק את הדף?"} לא ניתן לשחזר. בלוקי תוכן מקושרים יימחקו גם כן.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>ביטול</AlertDialogCancel>
          <AlertDialogAction className="bg-red-600" onClick={() => id != null && del.mutate({ id })} disabled={del.isPending}>מחק</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
function DeleteSectionDialog({ id, onClose, onSuccess }: { id: number | null; onClose: () => void; onSuccess: () => void }) {
  const del = trpc.admin.deleteContentSection.useMutation({ onSuccess: () => { toast.success("בלוק נמחק"); onSuccess(); onClose(); }, onError: (e) => toast.error(e.message) });
  return (
    <AlertDialog open={id != null} onOpenChange={(o) => !o && onClose()}><AlertDialogContent className="bg-slate-900 border-slate-700"><AlertDialogHeader><AlertDialogTitle className="text-white">מחיקת בלוק</AlertDialogTitle><AlertDialogDescription>האם למחוק את הבלוק? לא ניתן לשחזר.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>ביטול</AlertDialogCancel><AlertDialogAction className="bg-red-600" onClick={() => id != null && del.mutate({ id })} disabled={del.isPending}>מחק</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  );
}
