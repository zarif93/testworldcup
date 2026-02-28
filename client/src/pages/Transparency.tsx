import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { Coins, Info, ChevronDown, ChevronUp, Loader2 } from "lucide-react";

const FEE_EXPLANATION =
  "12.5% מסכום הכניסה נלקח לטובת האתר, יתר הסכום מהווה את קופת הפרסים של הטורניר.";

function formatNis(n: number) {
  return `₪${n.toLocaleString("he-IL")}`;
}

export default function Transparency() {
  const [, setLocation] = useLocation();
  const { user, loading: authLoading } = useAuth();
  const [expandedTournament, setExpandedTournament] = useState<number | null>(null);
  const { data, isLoading } = trpc.transparency.getSummary.useQuery(undefined, {
    refetchInterval: 15_000,
  });

  useEffect(() => {
    if (!authLoading && user?.role !== "admin") setLocation("/");
  }, [authLoading, user, setLocation]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-amber-500" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-slate-400">לא ניתן לטעון נתוני שקיפות</p>
      </div>
    );
  }

  const { byTournament, totalAmount, totalFee, totalPrizePool, totalParticipants } = data;

  return (
    <div className="min-h-screen py-8">
      <div className="container mx-auto px-4 max-w-4xl">
        <h1 className="text-3xl md:text-4xl font-bold text-white mb-2 flex items-center gap-2 animate-fade-in">
          <Coins className="w-9 h-9 text-amber-400" />
          שקיפות כספית
        </h1>
        <p className="text-slate-400 mb-8">
          כל הסכומים מתעדכנים לפי טפסים מאושרים. הצגה בלבד – לא ניתן לערוך.
        </p>

        {/* סיכום כולל */}
        <Card className="card-sport bg-gradient-to-br from-emerald-950/50 to-slate-900 border-emerald-700/50 mb-8 overflow-hidden">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <span className="text-slate-300 font-medium">סה״כ קופה באתר</span>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="text-slate-400 hover:text-amber-400 transition-colors p-1 rounded"
                      aria-label="הסבר"
                    >
                      <Info className="w-4 h-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="left" className="max-w-xs bg-slate-800 text-white border-slate-600">
                    {FEE_EXPLANATION}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-6">
              <div>
                <p className="text-slate-500 text-sm">סך תשלומים</p>
                <p className="text-2xl font-bold text-white">{formatNis(totalAmount)}</p>
              </div>
              <div>
                <p className="text-slate-500 text-sm">עמלה (12.5%)</p>
                <p className="text-xl font-bold text-amber-400">{formatNis(totalFee)}</p>
              </div>
              <div>
                <p className="text-slate-500 text-sm">סה״כ פרסים</p>
                <p className="text-2xl font-bold text-emerald-400">{formatNis(totalPrizePool)}</p>
              </div>
              <div>
                <p className="text-slate-500 text-sm">טפסים מאושרים בקופה</p>
                <p className="text-xl font-bold text-white">{totalParticipants}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* טבלה לכל טורניר */}
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-white">לפי טורניר</h2>
          {byTournament.map((row) => {
            const isExpanded = expandedTournament === row.tournamentId;
            return (
              <Card
                key={row.tournamentId}
                className="card-sport bg-slate-800/60 border-slate-600/50 overflow-hidden transition-all"
              >
                <CardContent className="p-0">
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedTournament(isExpanded ? null : row.tournamentId)
                    }
                    className="w-full flex items-center justify-between p-4 text-right hover:bg-slate-700/30 transition-colors rounded-lg"
                  >
                    <span className="text-slate-400">
                      {isExpanded ? (
                        <ChevronUp className="w-5 h-5" />
                      ) : (
                        <ChevronDown className="w-5 h-5" />
                      )}
                    </span>
                    <div className="flex flex-wrap items-center gap-6">
                      <span className="text-white font-bold">{row.name}</span>
                      <span className="text-slate-400">
                        {row.participants} משתתפים
                      </span>
                      <span className="text-white">{formatNis(row.totalAmount)}</span>
                      <span className="text-amber-400">{formatNis(row.fee)} עמלה</span>
                      <span className="text-emerald-400 font-bold">
                        {formatNis(row.prizePool)} פרסים
                      </span>
                    </div>
                  </button>
                  {isExpanded && (
                    <div className="border-t border-slate-700 px-4 py-3 bg-slate-800/30">
                      <table className="w-full text-sm text-slate-300">
                        <tbody>
                          <tr>
                            <td className="py-1">סכום ליחידה</td>
                            <td className="py-1 font-medium text-white">
                              {formatNis(row.amountPerEntry)}
                            </td>
                          </tr>
                          <tr>
                            <td className="py-1">מספר משלמים</td>
                            <td className="py-1 font-medium text-white">
                              {row.participants}
                            </td>
                          </tr>
                          <tr>
                            <td className="py-1">סכום כולל</td>
                            <td className="py-1 font-medium text-white">
                              {formatNis(row.totalAmount)}
                            </td>
                          </tr>
                          <tr>
                            <td className="py-1">
                              עמלה 12.5%
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Info className="w-3 h-3 inline-block mr-1 text-slate-500" />
                                  </TooltipTrigger>
                                  <TooltipContent className="max-w-xs bg-slate-800 text-white border-slate-600">
                                    {FEE_EXPLANATION}
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </td>
                            <td className="py-1 font-medium text-amber-400">
                              {formatNis(row.fee)}
                            </td>
                          </tr>
                          <tr>
                            <td className="py-1">קופת פרסים</td>
                            <td className="py-1 font-bold text-emerald-400">
                              {formatNis(row.prizePool)}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {byTournament.length === 0 && (
          <p className="text-slate-500 text-center py-12">אין עדיין תשלומים מאושרים</p>
        )}
      </div>
    </div>
  );
}
