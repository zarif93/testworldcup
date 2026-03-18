/**
 * Phase 12: Global site settings – contact, CTA, social, footer, legal, brand.
 * Guarded by settings.manage; section visible only when user has permission.
 */

import { useState, useEffect } from "react";
import { Loader2, Save, Settings } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { BackgroundImagesSection } from "./BackgroundImagesSection";

const SETTINGS_GROUPS: { group: string; label: string; keys: { key: string; label: string; placeholder?: string }[] }[] = [
  {
    group: "contact",
    label: "פרטי קשר",
    keys: [
      { key: "contact.whatsapp", label: "מספר וואטסאפ (ללא +)", placeholder: "972538099212" },
      { key: "contact.phone", label: "טלפון", placeholder: "" },
      { key: "contact.email", label: "אימייל", placeholder: "" },
      { key: "contact.address", label: "כתובת", placeholder: "" },
    ],
  },
  {
    group: "cta",
    label: "כפתורי CTA ראשיים",
    keys: [
      { key: "cta.primary_text", label: "טקסט כפתור ראשי", placeholder: "בחר טורניר" },
      { key: "cta.primary_url", label: "קישור כפתור ראשי", placeholder: "/tournaments" },
      { key: "cta.secondary_text", label: "טקסט כפתור משני", placeholder: "" },
      { key: "cta.secondary_url", label: "קישור כפתור משני", placeholder: "" },
    ],
  },
  {
    group: "social",
    label: "רשתות חברתיות",
    keys: [
      { key: "social.instagram", label: "Instagram URL", placeholder: "https://..." },
      { key: "social.facebook", label: "Facebook URL", placeholder: "https://..." },
      { key: "social.telegram", label: "Telegram URL", placeholder: "https://..." },
    ],
  },
  {
    group: "footer",
    label: "פוטר",
    keys: [
      { key: "footer.company_name", label: "שם החברה", placeholder: "WinMondial" },
      { key: "footer.copyright_text", label: "טקסט זכויות יוצרים", placeholder: "" },
    ],
  },
  {
    group: "legal",
    label: "משפטי / דפים",
    keys: [
      { key: "legal.terms_page_slug", label: "Slug דף תקנון", placeholder: "terms" },
      { key: "legal.privacy_page_slug", label: "Slug דף פרטיות", placeholder: "privacy" },
    ],
  },
  {
    group: "brand",
    label: "מיתוג",
    keys: [
      { key: "brand.site_name", label: "שם האתר", placeholder: "WinMondial" },
      { key: "brand.tagline", label: "סלוגן", placeholder: "תחרות ניחושי המונדיאל הגדולה" },
    ],
  },
];

const DEFAULTS: Record<string, string> = {
  "contact.whatsapp": "972538099212",
  "contact.phone": "",
  "contact.email": "",
  "contact.address": "",
  "cta.primary_text": "בחר טורניר",
  "cta.primary_url": "/tournaments",
  "cta.secondary_text": "",
  "cta.secondary_url": "",
  "social.instagram": "",
  "social.facebook": "",
  "social.telegram": "",
  "footer.company_name": "WinMondial",
  "footer.copyright_text": "",
  "legal.terms_page_slug": "",
  "legal.privacy_page_slug": "",
  "brand.site_name": "WinMondial",
  "brand.tagline": "תחרות ניחושי המונדיאל הגדולה",
};

export function SettingsSection() {
  const { data: raw, isLoading } = trpc.admin.getSiteSettings.useQuery();
  const [values, setValues] = useState<Record<string, string>>({});
  const batchMut = trpc.admin.setSiteSettingsBatch.useMutation({
    onSuccess: () => {
      toast.success("ההגדרות נשמרו");
    },
    onError: (e) => toast.error(e.message),
  });

  useEffect(() => {
    if (raw) {
      const merged: Record<string, string> = {};
      for (const g of SETTINGS_GROUPS) for (const { key } of g.keys) merged[key] = raw[key] ?? DEFAULTS[key] ?? "";
      setValues(merged);
    } else if (!isLoading) {
      setValues(DEFAULTS);
    }
  }, [raw, isLoading]);

  const handleChange = (key: string, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    batchMut.mutate(values);
  };

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 flex justify-center py-12">
        <Loader2 className="w-10 h-10 animate-spin text-amber-500" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-8">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Settings className="w-6 h-6 text-amber-400" />
          הגדרות אתר גלובליות
        </h2>
        <Button className="bg-amber-600 hover:bg-amber-700" onClick={handleSave} disabled={batchMut.isPending}>
          {batchMut.isPending ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : <Save className="w-4 h-4 ml-2" />}
          שמירה
        </Button>
      </div>

      {SETTINGS_GROUPS.map(({ group, label, keys }) => (
        <Card key={group} className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <h3 className="text-lg font-bold text-white">{label}</h3>
          </CardHeader>
          <CardContent className="space-y-4">
            {keys.map(({ key, label: fieldLabel, placeholder }) => (
              <div key={key}>
                <Label className="text-slate-400 text-sm">{fieldLabel}</Label>
                <Input
                  className="bg-slate-800 text-white border-slate-600 mt-1"
                  value={values[key] ?? ""}
                  onChange={(e) => handleChange(key, e.target.value)}
                  placeholder={placeholder}
                />
              </div>
            ))}
          </CardContent>
        </Card>
      ))}

      <BackgroundImagesSection />
    </div>
  );
}
