import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ImagePlus } from "lucide-react";

export interface BasicDetailsState {
  name: string;
  description: string;
  amount: string;
  startDate: string;
  endDate: string;
  maxParticipants: string;
  /** Phase 16: VISIBLE | HIDDEN */
  visibility: string;
  /** Phase 16: banner image URL from media picker */
  bannerUrl: string;
  /** Optional custom identifier (e.g. for lotto draw code uniqueness) */
  customIdentifier: string;
}

interface CompetitionWizardBasicStepProps {
  value: BasicDetailsState;
  onChange: (v: BasicDetailsState) => void;
  errors?: Partial<Record<keyof BasicDetailsState, string>>;
  /** Phase 16: when true, show visibility + banner (media picker) */
  showVisibilityAndBanner?: boolean;
  onOpenMediaPicker?: () => void;
}

export function CompetitionWizardBasicStep({ value, onChange, errors, showVisibilityAndBanner, onOpenMediaPicker }: CompetitionWizardBasicStepProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label className="text-slate-300">שם התחרות *</Label>
        <Input
          className="bg-slate-800 text-white border-slate-600"
          placeholder="למשל: לוטו 50"
          value={value.name}
          onChange={(e) => onChange({ ...value, name: e.target.value })}
        />
        {errors?.name && <p className="text-red-400 text-sm">{errors.name}</p>}
      </div>
      <div className="space-y-2">
        <Label className="text-slate-300">תיאור (אופציונלי)</Label>
        <Input
          className="bg-slate-800 text-white border-slate-600"
          placeholder="תיאור קצר"
          value={value.description}
          onChange={(e) => onChange({ ...value, description: e.target.value })}
        />
      </div>
      <div className="space-y-2">
        <Label className="text-slate-300">עלות כניסה (נקודות) *</Label>
        <Input
          type="number"
          min={0}
          className="bg-slate-800 text-white border-slate-600 w-32"
          value={value.amount}
          onChange={(e) => onChange({ ...value, amount: e.target.value })}
          title="0 = כניסה חינם (פרירול)"
        />
        {errors?.amount && <p className="text-red-400 text-sm">{errors.amount}</p>}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-slate-300">תאריך התחלה (אופציונלי)</Label>
          <Input
            type="date"
            className="bg-slate-800 text-white border-slate-600"
            value={value.startDate}
            onChange={(e) => onChange({ ...value, startDate: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label className="text-slate-300">תאריך סיום (אופציונלי)</Label>
          <Input
            type="date"
            className="bg-slate-800 text-white border-slate-600"
            value={value.endDate}
            onChange={(e) => onChange({ ...value, endDate: e.target.value })}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label className="text-slate-300">מקסימום משתתפים (אופציונלי, ריק = ללא הגבלה)</Label>
        <Input
          type="number"
          min={1}
          className="bg-slate-800 text-white border-slate-600 w-32"
          value={value.maxParticipants}
          onChange={(e) => onChange({ ...value, maxParticipants: e.target.value })}
        />
      </div>
      <div className="space-y-2">
        <Label className="text-slate-300">מזהה ייחודי (אופציונלי)</Label>
        <Input
          className="bg-slate-800 text-white border-slate-600"
          placeholder="ריק = אפשר כמה תחרויות עם אותו סכום"
          value={value.customIdentifier}
          onChange={(e) => onChange({ ...value, customIdentifier: e.target.value })}
        />
      </div>
      {showVisibilityAndBanner && (
        <>
          <div className="space-y-2">
            <Label className="text-slate-300">נראות</Label>
            <select
              className="w-full rounded-lg px-3 py-2 bg-slate-800 text-white border border-slate-600"
              value={value.visibility}
              onChange={(e) => onChange({ ...value, visibility: e.target.value })}
            >
              <option value="VISIBLE">גלוי (מוצג בדף הראשי)</option>
              <option value="HIDDEN">מוסתר</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label className="text-slate-300">באנר תחרות (אופציונלי)</Label>
            <div className="flex gap-2 items-center">
              {value.bannerUrl ? (
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <img src={value.bannerUrl} alt="" className="h-12 rounded object-cover w-24 shrink-0" />
                  <span className="text-slate-400 truncate text-sm">{value.bannerUrl}</span>
                  <Button type="button" variant="outline" size="sm" onClick={() => onChange({ ...value, bannerUrl: "" })} className="shrink-0 text-slate-400">
                    הסר
                  </Button>
                </div>
              ) : (
                <Button type="button" variant="outline" size="sm" onClick={onOpenMediaPicker} className="text-slate-400 border-slate-600">
                  <ImagePlus className="w-4 h-4 ml-1" />
                  בחר תמונה
                </Button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export const DEFAULT_BASIC_DETAILS: BasicDetailsState = {
  name: "",
  description: "",
  amount: "",
  startDate: "",
  endDate: "",
  maxParticipants: "",
  visibility: "VISIBLE",
  bannerUrl: "",
  customIdentifier: "",
};
