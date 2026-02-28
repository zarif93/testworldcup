import { useState, useEffect } from "react";

const BACKGROUND_IMAGES = ["/worldcup-bg-1.png", "/worldcup-bg-2.png"] as const;

/**
 * רקע קבוע לכל האתר – תמונות מונדיאל (אצטדיון, גביע, דגלים).
 * נשאר קבוע בגלילה (position: fixed). בוחר אקראית אחת משתי התמונות.
 * שכבת גרדיאנט כהה מעל כדי שהטקסט יישאר קריא.
 */
export function WorldCupBackground() {
  const [bgImage, setBgImage] = useState<string>(BACKGROUND_IMAGES[0]);

  useEffect(() => {
    const idx = Math.floor(Math.random() * BACKGROUND_IMAGES.length);
    setBgImage(BACKGROUND_IMAGES[idx]);
  }, []);

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
