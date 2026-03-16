/**
 * Shared server-side validation for tournament creation payloads.
 * Used by: manual create (admin.createTournament), template-based create (createTournamentFromTemplate),
 * and createTournament in db. Ensures required fields by type, valid dates, lifecycle, and type mapping.
 */

/** Internal tournament types stored in DB. */
export const INTERNAL_TOURNAMENT_TYPES = ["football", "football_custom", "lotto", "chance", "custom"] as const;
export type InternalTournamentType = (typeof INTERNAL_TOURNAMENT_TYPES)[number];

/** Supported category/display names that map to internal types. */
export const CATEGORY_TO_INTERNAL: Record<string, InternalTournamentType> = {
  football: "football",
  basketball: "custom",
  tennis: "custom",
  baseball: "custom",
  american_football: "custom",
  "american football": "custom",
  hockey: "custom",
  motorsports: "custom",
  esports: "custom",
  lottery: "lotto",
  lotto: "lotto",
  chance: "chance",
  custom: "custom",
  football_custom: "football_custom",
};

const ALLOWED_LIFECYCLE_STATUSES = ["OPEN", "DRAFT"] as const;
const ALLOWED_LOTTO_DRAW_TIMES = ["20:00", "22:30", "23:00", "23:30", "00:00"] as const;
const ALLOWED_VISIBILITY = ["VISIBLE", "HIDDEN"] as const;

function toTs(v: string | number | Date | null | undefined): number | null {
  if (v == null) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (v instanceof Date) return Number.isFinite(v.getTime()) ? v.getTime() : null;
  try {
    const d = new Date(v as string);
    return Number.isFinite(d.getTime()) ? d.getTime() : null;
  } catch {
    return null;
  }
}

/** Commission percentage 0–100 (stored in DB as basis points 0–10000). Optional; omitted means default 12.5%. */
export type CreateTournamentPayload = {
  name?: string | null;
  amount?: number;
  type?: string | null;
  initialStatus?: string | null;
  opensAt?: string | number | Date | null;
  closesAt?: string | number | Date | null;
  drawDate?: string | null;
  drawTime?: string | null;
  drawCode?: string | null;
  maxParticipants?: number | null;
  guaranteedPrizeAmount?: number | null;
  visibility?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  /** Commission % (0–100). Decimal allowed (e.g. 12.5). Omitted = 12.5%. */
  commissionPercent?: number | null;
  /** תחרויות ספורט: מספר משחקים (1–30). חובה כשמשתמשים ב־initialStatus DRAFT. */
  numberOfGames?: number | null;
};

export type ValidateCreateTournamentResult =
  | { valid: true; normalizedType: InternalTournamentType }
  | { valid: false; message: string };

/**
 * Validate a tournament creation payload. Use before createTournament (manual and template flows).
 * Does not perform async checks (e.g. duplicate chance drawDate+drawTime); callers must do those.
 */
export function validateCreateTournamentPayload(data: CreateTournamentPayload): ValidateCreateTournamentResult {
  const name = data.name != null ? String(data.name).trim() : "";
  if (!name) {
    return { valid: false, message: "שם התחרות חובה" };
  }

  const amountNum = data.amount != null ? Number(data.amount) : 0;
  if (!Number.isInteger(amountNum) || amountNum < 0) {
    return { valid: false, message: "סכום התחרות חייב להיות מספר שלם לא שלילי (0 = כניסה חינם)" };
  }

  const rawType = (data.type ?? "football").trim().toLowerCase().replace(/\s+/g, " ");
  const normalizedType: InternalTournamentType =
    (INTERNAL_TOURNAMENT_TYPES as readonly string[]).includes(rawType)
      ? (rawType as InternalTournamentType)
      : (CATEGORY_TO_INTERNAL[rawType] ?? "custom");

  if (!INTERNAL_TOURNAMENT_TYPES.includes(normalizedType)) {
    return { valid: false, message: `סוג תחרות לא נתמך: ${data.type}. סוגים תקפים: football, football_custom, lotto, chance, custom.` };
  }

  const initialStatus = (data.initialStatus ?? "OPEN").trim();
  if (!ALLOWED_LIFECYCLE_STATUSES.includes(initialStatus as (typeof ALLOWED_LIFECYCLE_STATUSES)[number])) {
    return { valid: false, message: "סטטוס התחלתי חייב להיות OPEN או DRAFT" };
  }

  if (data.visibility != null && data.visibility !== "") {
    const vis = String(data.visibility).trim().toUpperCase();
    if (!ALLOWED_VISIBILITY.includes(vis as (typeof ALLOWED_VISIBILITY)[number])) {
      return { valid: false, message: "visibility חייב להיות VISIBLE או HIDDEN" };
    }
  }

  if (data.maxParticipants != null) {
    const max = Number(data.maxParticipants);
    if (!Number.isInteger(max) || max < 0) {
      return { valid: false, message: "maxParticipants חייב להיות מספר שלם לא שלילי" };
    }
  }

  if (data.guaranteedPrizeAmount != null && data.guaranteedPrizeAmount > 0) {
    const g = Number(data.guaranteedPrizeAmount);
    if (!Number.isInteger(g) || g < 0) {
      return { valid: false, message: "guaranteedPrizeAmount חייב להיות מספר שלם לא שלילי" };
    }
  }

  if (data.commissionPercent != null && typeof data.commissionPercent === "number") {
    const pct = Number(data.commissionPercent);
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
      return { valid: false, message: "עמלת מנהל חייבת להיות בין 0 ל־100 (אחוז)" };
    }
  }

  switch (normalizedType) {
    case "lotto": {
      if (!data.drawCode?.trim()) {
        return { valid: false, message: "בתחרות לוטו חובה להזין מזהה תחרות (drawCode)" };
      }
      if (!data.drawDate?.trim() || !data.drawTime?.trim()) {
        return { valid: false, message: "בתחרות לוטו חובה לבחור תאריך ושעת סגירת ההגרלה" };
      }
      const drawTimeTrim = data.drawTime.trim();
      if (!ALLOWED_LOTTO_DRAW_TIMES.includes(drawTimeTrim as (typeof ALLOWED_LOTTO_DRAW_TIMES)[number])) {
        return {
          valid: false,
          message: `שעת סגירת הגרלת לוטו חייבת להיות אחת מהשעות: ${ALLOWED_LOTTO_DRAW_TIMES.join(", ")}`,
        };
      }
      break;
    }
    case "chance": {
      if (!data.drawDate?.trim() || !data.drawTime?.trim()) {
        return { valid: false, message: "בתחרות צ'אנס חובה לבחור תאריך ושעת הגרלה" };
      }
      break;
    }
    case "football":
    case "football_custom": {
      const opensAt = toTs(data.opensAt);
      const closesAt = toTs(data.closesAt);
      if (opensAt == null || closesAt == null) {
        return { valid: false, message: "בתחרות מונדיאל/תחרויות ספורט חובה לבחור תאריך פתיחה, שעת פתיחה ושעת סגירה" };
      }
      if (closesAt <= opensAt) {
        return { valid: false, message: "שעת הסגירה חייבת להיות אחרי שעת הפתיחה" };
      }
      break;
    }
    case "custom":
      break;
    default:
      break;
  }

  if (data.opensAt != null && data.closesAt != null) {
    const opensAt = toTs(data.opensAt);
    const closesAt = toTs(data.closesAt);
    if (opensAt != null && closesAt != null && closesAt <= opensAt) {
      return { valid: false, message: "שעת הסגירה חייבת להיות אחרי שעת הפתיחה" };
    }
  }

  return { valid: true, normalizedType };
}

export const ALLOWED_LOTTO_DRAW_TIMES_EXPORT = ALLOWED_LOTTO_DRAW_TIMES;
