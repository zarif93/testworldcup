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
    list: ["תחרויות כדורגל", "תחרויות מונדיאל", "תחרויות צ'אנס", "תחרויות לוטו", "תחרויות מיוחדות"],
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
      "בתחרויות כדורגל – תנחשו את תוצאות המשחקים.",
      "בתחרויות לוטו או צ'אנס – תבחרו מספרים לפי חוקי התחרות.",
    ],
    footer: "לאחר שליחת הטופס המערכת מאשרת את ההשתתפות ומכניסה אתכם לתחרות. ניתן לשלוח מספר טפסים לאותה תחרות.",
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
    <div className="min-h-screen py-8">
      <div className="container mx-auto px-4 max-w-3xl">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-2 flex items-center gap-2 animate-fade-in">
              <HelpCircle className="w-9 h-9 text-emerald-400" />
              איך זה עובד?
            </h1>
            <p className="text-slate-400 text-lg">
              ברוכים הבאים למערכת התחרויות והניחושים.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => setLocation("/tournaments")}
            className="border-slate-600 rounded-xl hover:bg-slate-700/50"
          >
            לטורנירים
          </Button>
        </div>

        <Card className="card-sport bg-slate-800/60 border-slate-600/50 mb-8">
          <CardContent className="pt-6">
            <p className="text-slate-300 leading-relaxed">
              באתר תוכלו להשתתף בתחרויות שונות, לנחש תוצאות ולהתחרות מול שחקנים נוספים.
              כל המערכת פועלת בצורה אוטומטית ושקופה.
            </p>
          </CardContent>
        </Card>

        <div className="space-y-6">
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
                    <h2 className="text-xl font-bold text-white">{step.title}</h2>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-slate-300 leading-relaxed">{step.content}</p>
                  {step.list && (
                    <ul className="list-disc list-inside space-y-1 text-slate-300 pr-2">
                      {step.list.map((item, i) => (
                        <li key={i}>{item}</li>
                      ))}
                    </ul>
                  )}
                  {step.extra && (
                    <p className="text-slate-400 text-sm">{step.extra}</p>
                  )}
                  <p className="text-slate-400 text-sm pt-1 border-t border-slate-700/50">
                    {step.footer}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card className="card-sport bg-gradient-to-br from-slate-800/80 to-slate-900/80 border-slate-600/50 mt-8">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400">
                <Eye className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-bold text-white">שקיפות המערכת</h2>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-slate-300 leading-relaxed">
              המערכת פועלת בצורה שקופה לחלוטין. כל הנתונים נשמרים ומוצגים בצורה מסודרת:
            </p>
            <ul className="list-disc list-inside space-y-1 text-slate-300 pr-2">
              <li>תוצאות התחרויות</li>
              <li>טפסים שנשלחו</li>
              <li>דירוג שחקנים</li>
              <li>זכיות</li>
            </ul>
            <p className="text-slate-400 text-sm pt-2">
              כך שכל שחקן יכול לראות בדיוק איך התחרות התנהלה.
            </p>
          </CardContent>
        </Card>

        <Card className="card-sport bg-amber-500/10 border-amber-500/30 mt-6">
          <CardContent className="pt-6 flex items-start gap-3">
            <Lightbulb className="w-8 h-8 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-bold text-amber-200 mb-1">טיפ לשחקנים</h3>
              <p className="text-slate-300 leading-relaxed">
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
          <div className="flex flex-wrap justify-center gap-3 mt-4">
            <Button
              onClick={() => setLocation("/tournaments")}
              className="rounded-xl bg-emerald-600 hover:bg-emerald-700"
            >
              מעבר לטורנירים
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
