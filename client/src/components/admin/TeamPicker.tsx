/**
 * Team picker / autocomplete for football_custom match rows.
 * Supports: search library (with category label) and manual text entry.
 * Used only in admin sports (תחרויות ספורט) flows.
 */

import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const TEAM_LIBRARY_SCOPE = "football_custom" as const;
const SEARCH_DEBOUNCE_MS = 200;

export type TeamPickerValue = {
  teamId?: number;
  teamName: string;
  categoryName?: string;
};

/** Input shows canonical team name only so live onChange matches parent state (no "שם — קטגוריה" in the field). */
function valueToInputText(v: TeamPickerValue | null): string {
  return v?.teamName ?? "";
}

type Props = {
  value: TeamPickerValue | null;
  onChange: (v: TeamPickerValue) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  /** Optional: exclude this team id from results (e.g. same row away team) */
  excludeTeamId?: number | null;
};

export function TeamPicker({ value, onChange, placeholder = "חיפוש או הזנה ידנית", className, disabled, excludeTeamId }: Props) {
  const [inputText, setInputText] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const searchQuery = inputText.trim();
  const debouncedSearch = useDebounce(searchQuery, SEARCH_DEBOUNCE_MS);

  const { data: hits = [], isLoading: searchLoading } = trpc.admin.searchTeamLibraryTeams.useQuery(
    { scope: TEAM_LIBRARY_SCOPE, search: debouncedSearch },
    { enabled: isOpen && debouncedSearch.length >= 1 }
  );

  const filteredHits = excludeTeamId != null ? hits.filter((h) => h.id !== excludeTeamId) : hits;

  // Keep local input in sync when parent value changes (new row, reset, library pick from handler).
  // Depend on primitives only — parent passes a new object each render.
  useEffect(() => {
    setInputText(valueToInputText(value));
  }, [value?.teamName, value?.teamId, value?.categoryName]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setInputText(valueToInputText(value));
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [value?.teamName, value?.teamId, value?.categoryName]);

  const handleSelect = (hit: { id: number; name: string; categoryName: string }) => {
    onChange({ teamId: hit.id, teamName: hit.name, categoryName: hit.categoryName });
    setInputText(hit.name);
    setIsOpen(false);
    setFocusedIndex(-1);
  };

  const handleBlur = () => {
    if (!containerRef.current?.contains(document.activeElement)) {
      if (filteredHits.length > 0 && focusedIndex >= 0 && filteredHits[focusedIndex]) {
        const hit = filteredHits[focusedIndex];
        handleSelect(hit);
        return;
      }
      const trimmed = inputText.trim();
      const prevTrim = (value?.teamName ?? "").trim();
      if (!trimmed) {
        onChange({ teamName: "", teamId: undefined, categoryName: undefined });
        setInputText("");
      } else if (trimmed === prevTrim && value?.teamId != null) {
        onChange({ teamName: trimmed, teamId: value.teamId, categoryName: value.categoryName });
        setInputText(trimmed);
      } else {
        onChange({ teamName: trimmed, teamId: undefined, categoryName: undefined });
        setInputText(trimmed);
      }
      setIsOpen(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || filteredHits.length === 0) {
      if (e.key === "Enter" && inputText.trim()) {
        onChange({ teamName: inputText.trim(), teamId: undefined, categoryName: undefined });
        setIsOpen(false);
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusedIndex((i) => (i < filteredHits.length - 1 ? i + 1 : i));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusedIndex((i) => (i > 0 ? i - 1 : -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (focusedIndex >= 0 && filteredHits[focusedIndex]) {
        handleSelect(filteredHits[focusedIndex]);
      } else if (inputText.trim()) {
        onChange({ teamName: inputText.trim(), teamId: undefined, categoryName: undefined });
        setIsOpen(false);
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
      setInputText(valueToInputText(value));
      setFocusedIndex(-1);
    }
  };

  useEffect(() => {
    if (focusedIndex >= 0 && listRef.current) {
      const el = listRef.current.children[focusedIndex] as HTMLElement;
      el?.scrollIntoView({ block: "nearest" });
    }
  }, [focusedIndex]);

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <Input
        placeholder={placeholder}
        title={value?.categoryName?.trim() ? `קטגוריה בספרייה: ${value.categoryName.trim()}` : undefined}
        className="bg-slate-800 text-white w-full min-w-[140px]"
        value={inputText}
        onChange={(e) => {
          const t = e.target.value;
          setInputText(t);
          setIsOpen(true);
          setFocusedIndex(-1);
          // Commit on every keystroke so form validation matches the visible field (blur may never fire, e.g. disabled submit).
          onChange({ teamName: t, teamId: undefined, categoryName: undefined });
        }}
        onFocus={() => setIsOpen(true)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        dir="rtl"
        aria-autocomplete="list"
        aria-expanded={isOpen && filteredHits.length > 0}
      />
      {isOpen && searchQuery.length >= 1 && (
        <ul
          ref={listRef}
          className="absolute z-50 mt-1 max-h-48 w-full overflow-auto rounded-md border border-slate-600 bg-slate-800 py-1 shadow-lg"
          role="listbox"
        >
          {searchLoading ? (
            <li className="flex items-center gap-2 px-3 py-2 text-slate-400 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              טוען...
            </li>
          ) : filteredHits.length === 0 ? (
            <li className="px-3 py-2 text-slate-500 text-sm">
              {searchQuery.length < 2 ? "הקלד לפחות 2 תווים" : "אין תוצאות — ניתן להזין שם ידנית"}
            </li>
          ) : (
            filteredHits.map((hit, i) => (
              <li
                key={hit.id}
                role="option"
                aria-selected={focusedIndex === i}
                className={cn(
                  "cursor-pointer px-3 py-2 text-sm text-right",
                  focusedIndex === i ? "bg-amber-600/80 text-white" : "text-slate-200 hover:bg-slate-700"
                )}
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleSelect(hit);
                }}
              >
                <span className="font-medium">{hit.name}</span>
                {hit.categoryName && <span className="text-slate-400 mr-1"> — {hit.categoryName}</span>}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

function useDebounce<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState<T>(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}
