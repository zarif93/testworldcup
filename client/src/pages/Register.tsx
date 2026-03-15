import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Loader2, UserPlus, MessageCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

/** wa.me expects digits only (no + or spaces). */
function normalizeWhatsAppNumber(raw: string): string {
  const digits = (raw || "").replace(/\D/g, "");
  return digits || "972538099212";
}

/** Build WhatsApp URL with pre-filled text. Safe for all platforms. */
function buildWhatsAppUrl(phone: string, message: string): string {
  const num = normalizeWhatsAppNumber(phone);
  const text = encodeURIComponent(message);
  return `https://wa.me/${num}?text=${text}`;
}

export default function Register() {
  const [, setLocation] = useLocation();
  const { loginSuccess } = useAuth();
  const [username, setUsername] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [usernameTaken, setUsernameTaken] = useState(false);
  /** Only when same-tab redirect to WhatsApp did not occur (e.g. iOS block): minimal fallback. */
  const [minimalFallback, setMinimalFallback] = useState<{ whatsappUrl: string; messageText: string; returnPath: string | null } | null>(null);
  const [showMinimalFallback, setShowMinimalFallback] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const ref = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("ref") : null;
    if (ref?.trim()) setReferralCode(ref.trim());
  }, []);

  /** If we set minimalFallback and redirected but are still here after delay, show minimal UI. */
  useEffect(() => {
    if (!minimalFallback) return;
    const t = setTimeout(() => setShowMinimalFallback(true), 1500);
    return () => clearTimeout(t);
  }, [minimalFallback]);

  const registerMutation = trpc.auth.register.useMutation();
  const utils = trpc.useUtils();
  const { data: siteSettings } = trpc.settings.getPublic.useQuery();
  const whatsappNumber = siteSettings?.["contact.whatsapp"]?.trim() || "972538099212";

  const handleUsernameBlur = async () => {
    const u = username.trim();
    if (u.length < 3) {
      setUsernameTaken(false);
      return;
    }
    try {
      const { available } = await utils.auth.checkUsername.fetch({ username: u });
      setUsernameTaken(!available);
    } catch {
      setUsernameTaken(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast.error("הסיסמאות לא תואמות");
      return;
    }

    if (password.length < 6) {
      toast.error("הסיסמה חייבת לכלול לפחות 6 תווים");
      return;
    }

    if (!name.trim()) {
      toast.error("שם מלא חובה");
      return;
    }

    if (usernameTaken) {
      toast.error("שם המשתמש כבר תפוס – בחר שם משתמש אחר");
      return;
    }

    setIsLoading(true);

    try {
      const result = await registerMutation.mutateAsync({
        username,
        phone,
        password,
        name: name.trim(),
        referralCode: referralCode.trim() || undefined,
      });

      loginSuccess(result.user as { id: number; username?: string; name?: string; phone?: string; role: "user" | "admin" | "agent" });
      toast.success("נרשמת בהצלחה!");

      const messageText = [
        "שלום, נרשמתי ל-WinMondial.",
        "",
        "פרטים:",
        `שם מלא: ${name.trim()}`,
        `שם משתמש: ${username.trim()}`,
        `טלפון: ${phone.trim()}`,
        referralCode.trim() ? `קוד הפניה: ${referralCode.trim()}` : "קוד הפניה: לא הוזן",
      ].join("\n");
      const whatsappUrl = buildWhatsAppUrl(whatsappNumber, messageText);

      const returnPath = sessionStorage.getItem("worldcup_return_path");
      if (returnPath) sessionStorage.removeItem("worldcup_return_path");

      setMinimalFallback({ whatsappUrl, messageText, returnPath });
      window.location.href = whatsappUrl;
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "שגיאה בהרשמה"
      );
    } finally {
      setIsLoading(false);
    }
  };

  const inputClass = "rounded-xl bg-slate-700/50 border-slate-600 text-white";

  if (showMinimalFallback && minimalFallback) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md card-sport bg-slate-800/80 border-slate-600/50">
          <CardHeader className="space-y-2 text-right">
            <CardTitle className="text-xl text-white flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-emerald-400" />
              נרשמת בהצלחה
            </CardTitle>
            <CardDescription className="text-slate-400 text-sm">
              לא ניתן היה לפתוח את וואטסאפ אוטומטית. לחץ להלן לשליחת הפרטים.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              type="button"
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3.5 rounded-xl min-h-[48px] touch-target flex items-center justify-center gap-2"
              onClick={() => { window.location.href = minimalFallback.whatsappUrl; }}
            >
              <MessageCircle className="w-5 h-5 shrink-0" />
              פתח וואטסאפ
            </Button>
            <div className="flex items-center justify-center gap-2">
              <button
                type="button"
                className="text-slate-400 hover:text-slate-300 text-sm underline"
                onClick={() => {
                  setCopied(true);
                  navigator.clipboard.writeText(minimalFallback.messageText).then(
                    () => toast.success("הועתק"),
                    () => toast.error("העתקה נכשלה")
                  );
                  setTimeout(() => setCopied(false), 2000);
                }}
              >
                {copied ? "הועתק" : "העתק טקסט"}
              </button>
              <span className="text-slate-500">|</span>
              <button
                type="button"
                className="text-slate-400 hover:text-slate-300 text-sm underline"
                onClick={() => setLocation(minimalFallback.returnPath || "/")}
              >
                המשך לדף הבית
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md card-sport bg-slate-800/80 border-slate-600/50">
        <CardHeader className="space-y-2 text-right">
          <CardTitle className="text-2xl text-white flex items-center gap-2">
            <UserPlus className="w-6 h-6 text-emerald-400" />
            הרשמה
          </CardTitle>
          <CardDescription className="text-slate-400">
            צור חשבון כדי להשתתף בתחרויות WinMondial
          </CardDescription>
          <p className="text-slate-500 text-xs mt-1">
            משתמשים אמיתיים • תקנון ברור • אחרי ההרשמה תוכלו לבחור תחרות ולהשתתף
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2 text-right">
              <label htmlFor="name" className="text-sm font-medium text-slate-300">
                שם מלא
              </label>
              <Input
                id="name"
                type="text"
                placeholder="השם שלך"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isLoading}
                required
                className={inputClass}
              />
            </div>

            <div className="space-y-2 text-right">
              <label htmlFor="username" className="text-sm font-medium text-slate-300">
                שם משתמש
              </label>
              <Input
                id="username"
                type="text"
                placeholder="בחר שם משתמש"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  setUsernameTaken(false);
                }}
                onBlur={handleUsernameBlur}
                disabled={isLoading}
                required
                className={inputClass}
                aria-invalid={usernameTaken}
              />
              {usernameTaken && (
                <p className="text-red-400 text-sm">שם המשתמש כבר תפוס – לא ניתן לפתוח חשבון עם שם זה. בחר שם משתמש אחר.</p>
              )}
            </div>

            <div className="space-y-2 text-right">
              <label htmlFor="phone" className="text-sm font-medium text-slate-300">
                מספר טלפון
              </label>
              <Input
                id="phone"
                type="tel"
                placeholder="050-1234567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={isLoading}
                required
                className={inputClass}
              />
            </div>

            <div className="space-y-2 text-right">
              <label htmlFor="password" className="text-sm font-medium text-slate-300">
                סיסמה
              </label>
              <Input
                id="password"
                type="password"
                placeholder="בחר סיסמה (לפחות 6 תווים)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                required
                className={inputClass}
              />
            </div>

            <div className="space-y-2 text-right">
              <label htmlFor="confirmPassword" className="text-sm font-medium text-slate-300">
                אימות סיסמה
              </label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="הכנס שוב את הסיסמה"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={isLoading}
                required
                className={inputClass}
              />
            </div>

            <div className="space-y-2 text-right">
              <label htmlFor="referralCode" className="text-sm font-medium text-slate-300">
                קוד הפניה (אופציונלי)
              </label>
              <Input
                id="referralCode"
                type="text"
                placeholder="קיבלת מקוד סוכן? הזן כאן"
                value={referralCode}
                onChange={(e) => setReferralCode(e.target.value)}
                disabled={isLoading}
                className={inputClass}
              />
            </div>

            <Button
              type="submit"
              className="w-full bg-emerald-600 hover:bg-emerald-700 rounded-xl btn-sport"
              disabled={isLoading || usernameTaken}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                  נרשם...
                </>
              ) : (
                "הרשמה"
              )}
            </Button>

            <div className="text-center text-sm text-slate-400">
              <span>כבר יש לך חשבון? </span>
              <button
                type="button"
                onClick={() => setLocation("/login")}
                className="text-emerald-400 hover:underline font-medium"
              >
                התחברות
              </button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
