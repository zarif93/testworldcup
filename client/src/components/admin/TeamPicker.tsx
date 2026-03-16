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

function getDisplayLabel(v: TeamPickerValue | null): string {
  if (!v?.teamName?.trim()) return "";
  if (v.categoryName?.trim()) return `${v.teamName.trim()} — ${v.categoryName.trim()}`;
  return v.teamName.trim();
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

  // When opening with existing value, show its display label
  useEffect(() => {
    if (isOpen && inputText === "" && value?.teamName) {
      setInputText(getDisplayLabel(value));
    }
  }, [isOpen]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        if (value?.teamName) {
          setInputText(getDisplayLabel(value));
        } else {
          setInputText("");
        }
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [value]);

  const handleSelect = (hit: { id: number; name: string; categoryName: string }) => {
    onChange({ teamId: hit.id, teamName: hit.name, categoryName: hit.categoryName });
    setInputText(getDisplayLabel({ teamId: hit.id, teamName: hit.name, categoryName: hit.categoryName }));
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
      if (trimmed) {
        onChange({ teamName: trimmed });
        setInputText(trimmed);
      } else if (value?.teamName) {
        setInputText(getDisplayLabel(value));
      }
      setIsOpen(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || filteredHits.length === 0) {
      if (e.key === "Enter" && inputText.trim()) {
        onChange({ teamName: inputText.trim() });
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
        onChange({ teamName: inputText.trim() });
        setIsOpen(false);
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
      setInputText(value?.teamName ? getDisplayLabel(value) : "");
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
        className="bg-slate-800 text-white w-full min-w-[140px]"
        value={inputText}
        onChange={(e) => {
          setInputText(e.target.value);
          setIsOpen(true);
          setFocusedIndex(-1);
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
