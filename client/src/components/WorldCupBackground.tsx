import { trpc } from "@/lib/trpc";

/** Single explicit default when no admin background is active. Served from public folder. */
const DEFAULT_BACKGROUND_URL = "/worldcup-bg-1.png";

/**
 * רקע קבוע לכל האתר – נטען מהתמונה הפעילה בהגדרות האתר.
 * אם אין תמונת רקע פעילה – משתמש בברירת מחדל אחת קבועה.
 * שכבת גרדיאנט כהה מעל כדי שהטקסט יישאר קריא.
 */
export function WorldCupBackground() {
  const { data: activeBg } = trpc.settings.getActiveBackground.useQuery();
  const bgImage = activeBg?.url ?? DEFAULT_BACKGROUND_URL;

  return (
    <div
      className="fixed inset-0 z-0 overflow-hidden pointer-events-none"
      aria-hidden
    >
      {/* תמונת רקע – אצטדיון, גביע, דגלים */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: `url(${bgImage})`,
        }}
      />

      {/* שכבת גרדיאנט כהה – קריאות טקסט מעל התמונה */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(2,6,23,0.88) 0%, rgba(2,6,23,0.7) 20%, rgba(2,6,23,0.55) 50%, rgba(2,6,23,0.7) 80%, rgba(2,6,23,0.88) 100%)",
        }}
      />

      {/* וינייט – מיקוד ועומק */}
      <div
        className="absolute inset-0"
        style={{
          boxShadow: "inset 0 0 30vmin rgba(0,0,0,0.35)",
        }}
      />
    </div>
  );
}
