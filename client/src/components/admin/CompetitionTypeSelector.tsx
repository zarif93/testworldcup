import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface CompetitionTypeOption {
  id: number;
  code: string;
  name?: string | null;
  description?: string | null;
  category?: string | null;
}

interface CompetitionTypeSelectorProps {
  types: CompetitionTypeOption[] | undefined;
  isLoading: boolean;
  selectedId: number | null;
  onSelect: (type: CompetitionTypeOption) => void;
}

const CATEGORY_LABELS: Record<string, string> = {
  sports: "ספורט",
  lottery: "הגרלה",
  cards: "קלפים",
  custom: "מותאם",
};

export function CompetitionTypeSelector({
  types,
  isLoading,
  selectedId,
  onSelect,
}: CompetitionTypeSelectorProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
      </div>
    );
  }

  if (!types?.length) {
    return (
      <p className="text-slate-500 py-6 text-center">
        לא נמצאו סוגי תחרות. ודא שהמערכת אותחלה עם סוגי תחרות (Phase 2A).
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {types.map((t) => {
        const isSelected = selectedId === t.id;
        const categoryLabel = t.category ? CATEGORY_LABELS[t.category] ?? t.category : null;
        return (
          <Button
            key={t.id}
            type="button"
            variant="outline"
            className={`h-auto py-5 px-4 flex flex-col gap-2 items-stretch text-right border-2 transition ${
              isSelected
                ? "border-amber-500 bg-amber-500/10 text-amber-100"
                : "border-slate-600 hover:border-amber-500/50 hover:bg-slate-700/50 text-white"
            }`}
            onClick={() => onSelect(t)}
          >
            <span className="font-semibold text-base">{t.name ?? t.code}</span>
            {t.description && (
              <span className="text-sm text-slate-400 font-normal line-clamp-2">{t.description}</span>
            )}
            {categoryLabel && (
              <span className="text-xs text-slate-500 font-normal">{categoryLabel}</span>
            )}
          </Button>
        );
      })}
    </div>
  );
}
