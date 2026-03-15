/**
 * Phase 16: Step 8 — CMS integration: select banner, intro content section, legal page.
 * Stored in tournament rulesJson for display/routing.
 */

import { Label } from "@/components/ui/label";

export interface CmsStepState {
  bannerKey: string;
  introSectionId: string;
  legalPageSlug: string;
}

interface CompetitionWizardCmsStepProps {
  value: CmsStepState;
  onChange: (v: CmsStepState) => void;
  banners: { id: number; key: string; title?: string | null }[];
  sections: { id: number; key: string; title?: string | null; pageId?: number | null }[];
  pages: { id: number; slug: string; title: string }[];
  isLoading?: boolean;
}

export function CompetitionWizardCmsStep({
  value,
  onChange,
  banners,
  sections,
  pages,
  isLoading,
}: CompetitionWizardCmsStepProps) {
  if (isLoading) {
    return <p className="text-slate-500">טוען אפשרויות...</p>;
  }
  return (
    <div className="space-y-4">
      <p className="text-slate-400 text-sm">
        קישור לבאנר, סקשן intro ודף משפטי (אופציונלי). נשמר בהגדרות התחרות.
      </p>
      <div className="space-y-2">
        <Label className="text-slate-300">באנר (מפתח)</Label>
        <select
          className="w-full rounded-lg px-3 py-2 bg-slate-800 text-white border border-slate-600"
          value={value.bannerKey}
          onChange={(e) => onChange({ ...value, bannerKey: e.target.value })}
        >
          <option value="">ללא</option>
          {banners.map((b) => (
            <option key={b.id} value={b.key}>{b.key}{b.title ? ` — ${b.title}` : ""}</option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label className="text-slate-300">סקשן intro (מזהה)</Label>
        <select
          className="w-full rounded-lg px-3 py-2 bg-slate-800 text-white border border-slate-600"
          value={value.introSectionId}
          onChange={(e) => onChange({ ...value, introSectionId: e.target.value })}
        >
          <option value="">ללא</option>
          {sections.map((s) => (
            <option key={s.id} value={String(s.id)}>{s.key}{s.title ? ` — ${s.title}` : ""}</option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label className="text-slate-300">דף משפטי (slug)</Label>
        <select
          className="w-full rounded-lg px-3 py-2 bg-slate-800 text-white border border-slate-600"
          value={value.legalPageSlug}
          onChange={(e) => onChange({ ...value, legalPageSlug: e.target.value })}
        >
          <option value="">ללא</option>
          {pages.map((p) => (
            <option key={p.id} value={p.slug}>{p.slug} — {p.title}</option>
          ))}
        </select>
      </div>
    </div>
  );
}

export const DEFAULT_CMS_STEP: CmsStepState = {
  bannerKey: "",
  introSectionId: "",
  legalPageSlug: "",
};
