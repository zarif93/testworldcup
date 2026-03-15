/**
 * Phase 16: Step 7 — Dates: open, close, settlement. Type-specific (draw date/time for lotto/chance).
 */

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type LegacyCompetitionType = "football" | "football_custom" | "lotto" | "chance" | "custom";

export interface DatesStepState {
  openDate: string;
  openTime: string;
  closeDate: string;
  closeTime: string;
  drawCode: string;
  drawDate: string;
  drawTime: string;
  settlementDate: string;
  settlementTime: string;
}

const CHANCE_DRAW_TIMES = ["09:00", "11:00", "13:00", "15:00", "17:00", "19:00", "21:00"] as const;
const LOTTO_DRAW_TIMES = ["20:00", "22:30", "23:00", "23:30", "00:00"] as const;

interface CompetitionWizardDatesStepProps {
  value: DatesStepState;
  onChange: (v: DatesStepState) => void;
  legacyType: LegacyCompetitionType | null;
  errors?: Partial<Record<string, string>>;
}

export function CompetitionWizardDatesStep({ value, onChange, legacyType, errors }: CompetitionWizardDatesStepProps) {
  const isFootball = legacyType === "football" || legacyType === "football_custom";
  const isLotto = legacyType === "lotto";
  const isChance = legacyType === "chance";

  return (
    <div className="space-y-4">
      <p className="text-slate-400 text-sm">
        מועדי פתיחה וסגירה לקבלת הגשות, ומועד סיום תוצאות/התנחלות.
      </p>
      {isFootball && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-slate-300">תאריך פתיחה *</Label>
              <Input
                type="date"
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
                className="bg-slate-800 text-white border-slate-600"
                value={value.openTime}
                onChange={(e) => onChange({ ...value, openTime: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">תאריך סגירה *</Label>
              <Input
                type="date"
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
      )}
      <div className="space-y-2">
        <Label className="text-slate-300">מועד סיום תוצאות / התנחלות (אופציונלי)</Label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            type="date"
            className="bg-slate-800 text-white border-slate-600"
            value={value.settlementDate}
            onChange={(e) => onChange({ ...value, settlementDate: e.target.value })}
          />
          <Input
            type="time"
            className="bg-slate-800 text-white border-slate-600"
            value={value.settlementTime}
            onChange={(e) => onChange({ ...value, settlementTime: e.target.value })}
          />
        </div>
      </div>
    </div>
  );
}

export const DEFAULT_DATES_STEP: DatesStepState = {
  openDate: "",
  openTime: "",
  closeDate: "",
  closeTime: "",
  drawCode: "",
  drawDate: "",
  drawTime: "",
  settlementDate: "",
  settlementTime: "",
};
