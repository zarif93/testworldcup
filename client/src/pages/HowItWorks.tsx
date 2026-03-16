import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  HelpCircle,
  UserPlus,
  Coins,
  Trophy,
  FileEdit,
  Lock,
  BarChart3,
  Gift,
  Eye,
  Lightbulb,
  Sparkles,
} from "lucide-react";

const steps = [
  {
    icon: UserPlus,
    title: "שלב 1 – הרשמה למערכת",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10 border-emerald-500/30",
    content: "כדי להשתתף בתחרויות יש ליצור משתמש באתר. בתהליך ההרשמה תידרשו להזין:",
    list: ["שם משתמש", "מספר פלאפון", "סיסמה"],
    footer: "לאחר ההרשמה תוכלו להתחבר למערכת ולהתחיל לשחק.",
  },
  {
    icon: Coins,
    title: "שלב 2 – קבלת נקודות",
    color: "text-amber-400",
    bg: "bg-amber-500/10 border-amber-500/30",
    content: "המערכת פועלת באמצעות נקודות. נקודות משמשות להשתתפות בתחרויות.",
    footer: "הנקודות מופיעות תמיד בראש האתר כך שתוכלו לראות את היתרה שלכם בכל רגע.",
  },
  {
    icon: Trophy,
    title: "שלב 3 – בחירת תחרות",
    color: "text-sky-400",
    bg: "bg-sky-500/10 border-sky-500/30",
    content: "באתר קיימות תחרויות מסוגים שונים:",
    list: ["תחרויות ספורט", "תחרויות מונדיאל", "תחרויות צ'אנס", "תחרויות לוטו", "תחרויות מיוחדות"],
    extra: "לכל תחרות מוצגים: סכום ההשתתפות, זמן סגירת התחרות, פרטי התחרות, סכום הפרסים הכולל.",
    footer: "בחרו את התחרות שמתאימה לכם.",
  },
  {
    icon: FileEdit,
    title: "שלב 4 – שליחת טופס ניחושים",
    color: "text-violet-400",
    bg: "bg-violet-500/10 border-violet-500/30",
    content: "לאחר בחירת התחרות תוכלו למלא טופס ניחושים. לדוגמה:",
    list: [
      "בתחרויות ספורט – תנחשו את תוצאות המשחקים.",
      "בתחרויות לוטו או צ'אנס – תבחרו מספרים לפי חוקי התחרות.",
    ],
    footer: "לאחר שליחת הטופס המערכת מאשרת את ההשתתפות ומכניסה אתכם לדירוג התחרות. ניתן לשלוח מספר טפסים לאותה תחרות.",
    footerExtra: "מה קורה אחרי אישור? אתם מופיעים בדירוג; כשהתחרות נסגרת ומחושבות התוצאות – הזוכים מקבלים את הפרס לחשבון הנקודות.",
  },
  {
    icon: Lock,
    title: "שלב 5 – סגירת התחרות",
    color: "text-rose-400",
    bg: "bg-rose-500/10 border-rose-500/30",
    content: "כאשר זמן התחרות מסתיים: התחרות ננעלת ולא ניתן לשלוח יותר טפסים.",
    footer: "בשלב זה כל המשתתפים בתחרות נקבעים סופית.",
  },
  {
    icon: BarChart3,
    title: "שלב 6 – עדכון תוצאות",
    color: "text-cyan-400",
    bg: "bg-cyan-500/10 border-cyan-500/30",
    content: "לאחר שהתוצאות הרשמיות מתפרסמות: המערכת מעדכנת את תוצאות המשחקים או ההגרלה.",
    footer: "לאחר מכן מתבצע חישוב אוטומטי של הניקוד עבור כל המשתתפים.",
  },
  {
    icon: Gift,
    title: "שלב 7 – חלוקת פרסים",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10 border-emerald-500/30",
    content: "לאחר חישוב התוצאות: המערכת מחלקת את הפרסים לזוכים. אם יש מספר זוכים באותה רמה – הפרס מתחלק ביניהם בצורה שווה.",
    footer: "הזכייה נכנסת אוטומטית לחשבון הנקודות של המשתמש.",
  },
];

export default function HowItWorks() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen py-4 sm:py-8 overflow-x-hidden max-w-full">
      <div className="container mx-auto px-4 max-w-[750px]">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-6 flex items-center gap-2 animate-fade-in">
              <HelpCircle className="w-9 h-9 text-emerald-400" />
              איך זה עובד?
            </h1>
            <p className="text-slate-400 text-[18px] leading-[1.8] mb-5">
              ברוכים הבאים ל-WinMondial – מערכת התחרויות והניחושים.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => setLocation("/tournaments")}
            className="border-slate-600 rounded-xl hover:bg-slate-700/50"
          >
            לתחרויות
          </Button>
        </div>

        <Card className="card-sport bg-slate-800/60 border-slate-600/50 mb-10">
          <CardContent className="pt-6">
            <p className="text-slate-300 text-[18px] leading-[1.8] mb-6">
              באתר תוכלו להשתתף בתחרויות שונות, לנחש תוצאות ולהתחרות מול שחקנים נוספים.
            </p>
            <p className="text-slate-300 text-[18px] leading-[1.8] mb-0">
              כל המערכת פועלת בצורה אוטומטית ושקופה.
            </p>
          </CardContent>
        </Card>

        <Card className="card-sport bg-amber-500/10 border-amber-500/30 mb-10">
          <CardHeader className="pb-2">
            <h2 className="text-xl font-bold text-white flex items-center gap-2 mb-6">בקצרה – 3 שלבים</h2>
          </CardHeader>
          <CardContent className="space-y-6 text-slate-300 text-[18px] leading-[1.8]">
            <p><strong className="text-amber-200">1. בחר תחרות</strong> מהרשימה ולחץ עליה.</p>
            <p><strong className="text-amber-200">2. מלא טופס ושלוח</strong> – הניחושים או הבחירות לפי סוג התחרות.</p>
            <p><strong className="text-amber-200">3. אחרי אישור</strong> – ההשתתפות נספרת ואתם נכנסים לדירוג. הזוכים מקבלים פרסים לחשבון.</p>
          </CardContent>
        </Card>

        <div className="space-y-10 [&>.card-sport:not(:first-child)]:pt-10 [&>.card-sport:not(:first-child)]:border-t [&>.card-sport:not(:first-child)]:border-white/10">
          {steps.map((step, idx) => {
            const Icon = step.icon;
            return (
              <Card
                key={idx}
                className={`card-sport border ${step.bg} overflow-hidden transition-all hover:shadow-lg`}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-xl bg-slate-800/80 ${step.color}`}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <h2 className="text-xl font-bold text-white mb-6">{step.title}</h2>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <p className="text-slate-300 text-[18px] leading-[1.8] mb-6">{step.content}</p>
                  {step.list && (
                    <ul className="list-disc list-inside space-y-3 text-slate-300 pr-5 text-[18px] leading-[1.8]">
                      {step.list.map((item, i) => (
                        <li key={i}>{item}</li>
                      ))}
                    </ul>
                  )}
                  {step.extra && (
                    <p className="text-slate-400 text-[18px] leading-[1.8] mb-6">{step.extra}</p>
                  )}
                  <div className="pt-6 border-t border-white/10 space-y-6">
                    <p className="text-slate-400 text-[18px] leading-[1.8] mb-0">
                      {step.footer}
                    </p>
                    {"footerExtra" in step && step.footerExtra && (
                      <p className="text-slate-400 text-[18px] leading-[1.8] mb-0">
                        {step.footerExtra}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card className="card-sport bg-gradient-to-br from-slate-800/80 to-slate-900/80 border-slate-600/50 mt-10 pt-10 border-t border-white/10">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400">
                <Eye className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-bold text-white mb-6">למה לסמוך על האתר? – שקיפות ואמינות</h2>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-slate-300 text-[18px] leading-[1.8] mb-6">
              משתתפים אמיתיים, תחרות אמיתית, כללים ברורים. המערכת פועלת בצורה שקופה:
            </p>
            <ul className="list-disc list-inside space-y-3 text-slate-300 pr-5 text-[18px] leading-[1.8] mb-6">
              <li>תוצאות התחרויות והדירוג מתעדכנים לפי הכללים</li>
              <li>טפסים שנשלחו ואושרו – גלויים לכם</li>
              <li>חלוקת פרסים לזוכים – אוטומטית ושקופה</li>
            </ul>
            <p className="text-slate-400 text-[18px] leading-[1.8] mb-0">
              בדף השקיפות תוכלו לראות סיכום כספי ותחרויות. תקנון ופרטיות זמינים בתחתית האתר.
            </p>
          </CardContent>
        </Card>

        <Card className="card-sport bg-amber-500/10 border-amber-500/30 mt-10 pt-10 border-t border-white/10">
          <CardContent className="pt-6 flex items-start gap-3">
            <Lightbulb className="w-8 h-8 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-xl font-bold text-amber-200 mb-4">טיפ לשחקנים</h3>
              <p className="text-slate-300 text-[18px] leading-[1.8] mb-0">
                ככל שתשלחו יותר טפסים ותשתתפו ביותר תחרויות, כך יגדלו הסיכויים שלכם לזכות בפרסים.
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="mt-10 text-center">
          <p className="text-2xl font-bold text-white flex items-center justify-center gap-2">
            <Sparkles className="w-8 h-8 text-amber-400" />
            בהצלחה בתחרויות!
          </p>
          <div className="flex flex-col sm:flex-row sm:flex-wrap justify-center gap-3 mt-4">
            <Button
              onClick={() => setLocation("/tournaments")}
              className="rounded-xl bg-emerald-600 hover:bg-emerald-700"
            >
              מעבר לתחרויות
            </Button>
            <Button
              variant="outline"
              onClick={() => setLocation("/")}
              className="rounded-xl border-slate-600"
            >
              חזרה לדף הבית
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
