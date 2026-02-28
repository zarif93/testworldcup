import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Loader2, LogIn } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export default function Login() {
  const [, setLocation] = useLocation();
  const { loginSuccess } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const loginMutation = trpc.auth.login.useMutation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const result = await loginMutation.mutateAsync({
        username,
        password,
      });

      loginSuccess(result.user as { id: number; username?: string; email?: string; name?: string; role: "user" | "admin" | "agent" });
      toast.success("התחברת בהצלחה!");
      const returnPath = sessionStorage.getItem("worldcup_return_path");
      if (returnPath) {
        sessionStorage.removeItem("worldcup_return_path");
        setLocation(returnPath);
      } else {
        setLocation("/");
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "שגיאה בהתחברות"
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md card-sport bg-slate-800/80 border-slate-600/50">
        <CardHeader className="space-y-2 text-right">
          <CardTitle className="text-2xl text-white flex items-center gap-2">
            <LogIn className="w-6 h-6 text-emerald-400" />
            התחברות
          </CardTitle>
          <CardDescription className="text-slate-400">
            התחבר לחשבון כדי לשלוח טפסים ולעקוב אחרי הדירוג
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2 text-right">
              <label htmlFor="username" className="text-sm font-medium text-slate-300">
                שם משתמש
              </label>
              <Input
                id="username"
                type="text"
                placeholder="הכנס שם משתמש"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={isLoading}
                required
                className="rounded-xl bg-slate-700/50 border-slate-600 text-white"
              />
            </div>

            <div className="space-y-2 text-right">
              <label htmlFor="password" className="text-sm font-medium text-slate-300">
                סיסמה
              </label>
              <Input
                id="password"
                type="password"
                placeholder="הכנס סיסמה"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                required
                className="rounded-xl bg-slate-700/50 border-slate-600 text-white"
              />
            </div>

            <Button
              type="submit"
              className="w-full bg-emerald-600 hover:bg-emerald-700 rounded-xl btn-sport"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                  מתחבר...
                </>
              ) : (
                "התחבר"
              )}
            </Button>

            <div className="text-center text-sm text-slate-400">
              <span>אין לך חשבון? </span>
              <button
                type="button"
                onClick={() => setLocation("/register")}
                className="text-emerald-400 hover:underline font-medium"
              >
                הרשמה
              </button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
