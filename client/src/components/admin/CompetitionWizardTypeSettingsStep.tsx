import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type LegacyCompetitionType = "football" | "football_custom" | "lotto" | "chance" | "custom";

export interface TypeSettingsState {
  openDate: string;
  openTime: string;
  closeDate: string;
  closeTime: string;
  drawCode: string;
  drawDate: string;
  drawTime: string;
  customIdentifier: string;
  prizeMode: "first" | "top3" | "custom";
  prize1: string;
  prize2: string;
  prize3: string;
}

const CHANCE_DRAW_TIMES = ["09:00", "11:00", "13:00", "15:00", "17:00", "19:00", "21:00"] as const;
const LOTTO_DRAW_TIMES = ["20:00", "22:30", "23:00", "23:30", "00:00"] as const;

interface CompetitionWizardTypeSettingsStepProps {
  legacyType: LegacyCompetitionType;
  value: TypeSettingsState;
  onChange: (v: TypeSettingsState) => void;
  errors?: Partial<Record<string, string>>;
}

export function CompetitionWizardTypeSettingsStep({
  legacyType,
  value,
  onChange,
  errors,
}: CompetitionWizardTypeSettingsStepProps) {
  const isFootball = legacyType === "football" || legacyType === "football_custom";
  const isLotto = legacyType === "lotto";
  const isChance = legacyType === "chance";

  return (
    <div className="space-y-4">
      {isFootball && (
        <>
          <p className="text-slate-400 text-sm">תאריכי פתיחה וסגירה לתשלום והגשת ניחושים</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-slate-300">תאריך פתיחה *</Label>
              <Input
                type="date"
                required
                className="bg-slate-800 text-white border-slate-600"
                value={value.openDate}
                onChange={(e) => onChange({ ...value, openDate: e.target.value })}
              />
              {errors?.openDate && <p className="text-red-400 text-sm">{errors.openDate}</p>}
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">שעת פתיחה *</Label>
              <Input
                type="time"
                required
                className="bg-slate-800 text-white border-slate-600"
                value={value.openTime}
                onChange={(e) => onChange({ ...value, openTime: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">תאריך סגירה *</Label>
              <Input
                type="date"
                required
                className="bg-slate-800 text-white border-slate-600"
                value={value.closeDate}
                onChange={(e) => onChange({ ...value, closeDate: e.target.value })}
              />
              {errors?.closeDate && <p className="text-red-400 text-sm">{errors.closeDate}</p>}
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">שעת סגירה *</Label>
              <Input
                type="time"
                required
                className="bg-slate-800 text-white border-slate-600"
                value={value.closeTime}
                onChange={(e) => onChange({ ...value, closeTime: e.target.value })}
              />
            </div>
          </div>
        </>
      )}

      {isLotto && (
        <>
          <p className="text-slate-400 text-sm">מזהה תחרות יחיד לעדכון תוצאות; תאריך ושעת סגירת הגרלה</p>
          <div className="space-y-2">
            <Label className="text-slate-300">מזהה תחרות (לעדכון תוצאות) *</Label>
            <Input
              className="bg-slate-800 text-white border-slate-600"
              placeholder="למשל lotto-1"
              value={value.drawCode}
              onChange={(e) => onChange({ ...value, drawCode: e.target.value })}
            />
            {errors?.drawCode && <p className="text-red-400 text-sm">{errors.drawCode}</p>}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-slate-300">תאריך סגירת הגרלה *</Label>
              <Input
                type="date"
                className="bg-slate-800 text-white border-slate-600"
                value={value.drawDate}
                onChange={(e) => onChange({ ...value, drawDate: e.target.value })}
              />
              {errors?.drawDate && <p className="text-red-400 text-sm">{errors.drawDate}</p>}
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">שעת סגירה *</Label>
              <select
                className="w-full rounded-lg px-3 py-2 bg-slate-800 text-white border border-slate-600"
                value={value.drawTime}
                onChange={(e) => onChange({ ...value, drawTime: e.target.value })}
              >
                <option value="">בחר</option>
                {LOTTO_DRAW_TIMES.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
              {errors?.drawTime && <p className="text-red-400 text-sm">{errors.drawTime}</p>}
            </div>
          </div>
        </>
      )}

      {isChance && (
        <>
          <p className="text-slate-400 text-sm">תאריך ושעת הגרלה (ייחודי לכל תחרות צ'אנס)</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-slate-300">תאריך הגרלה *</Label>
              <Input
                type="date"
                className="bg-slate-800 text-white border-slate-600"
                value={value.drawDate}
                onChange={(e) => onChange({ ...value, drawDate: e.target.value })}
              />
              {errors?.drawDate && <p className="text-red-400 text-sm">{errors.drawDate}</p>}
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">שעת הגרלה *</Label>
              <select
                className="w-full rounded-lg px-3 py-2 bg-slate-800 text-white border border-slate-600"
                value={value.drawTime}
                onChange={(e) => onChange({ ...value, drawTime: e.target.value })}
              >
                <option value="">בחר</option>
                {CHANCE_DRAW_TIMES.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
              {errors?.drawTime && <p className="text-red-400 text-sm">{errors.drawTime}</p>}
            </div>
          </div>
        </>
      )}

      <div className="space-y-2">
        <Label className="text-slate-300">מזהה ייחודי (אופציונלי)</Label>
        <Input
          className="bg-slate-800 text-white border-slate-600"
          placeholder="ריק = אפשר כמה תחרויות עם אותו סכום"
          value={value.customIdentifier}
          onChange={(e) => onChange({ ...value, customIdentifier: e.target.value })}
        />
      </div>
    </div>
  );
}

export const DEFAULT_TYPE_SETTINGS: TypeSettingsState = {
  openDate: "",
  openTime: "",
  closeDate: "",
  closeTime: "",
  drawCode: "",
  drawDate: "",
  drawTime: "",
  customIdentifier: "",
  prizeMode: "first",
  prize1: "100",
  prize2: "30",
  prize3: "20",
};
