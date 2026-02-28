/**
 * צבעים ולחצנים לפי טורניר: 50 תכלת, 100 סגול, 200 ירוק, 500 כחול, 1000 צהוב, 2000 אדום
 */
export function getTournamentStyles(amount: number) {
  switch (amount) {
    case 50:
      return {
        button: "bg-cyan-600 hover:bg-cyan-700 border-cyan-500 text-white hover:scale-105 active:scale-100 transition-transform shadow-md hover:shadow-lg",
        border: "border-cyan-500/50",
        tab: "data-[state=active]:bg-cyan-600 data-[state=active]:text-white",
        icon: "text-cyan-400",
      };
    case 100:
      return {
        button: "bg-violet-600 hover:bg-violet-700 border-violet-500 text-white hover:scale-105 active:scale-100 transition-transform shadow-md hover:shadow-lg",
        border: "border-violet-500/50",
        tab: "data-[state=active]:bg-violet-600 data-[state=active]:text-white",
        icon: "text-violet-400",
      };
    case 200:
      return {
        button: "bg-emerald-600 hover:bg-emerald-700 border-emerald-500 text-white hover:scale-105 active:scale-100 transition-transform shadow-md hover:shadow-lg",
        border: "border-emerald-500/50",
        tab: "data-[state=active]:bg-emerald-600 data-[state=active]:text-white",
        icon: "text-emerald-400",
      };
    case 500:
      return {
        button: "bg-blue-600 hover:bg-blue-700 border-blue-500 text-white hover:scale-105 active:scale-100 transition-transform shadow-md hover:shadow-lg",
        border: "border-blue-500/50",
        tab: "data-[state=active]:bg-blue-600 data-[state=active]:text-white",
        icon: "text-blue-400",
      };
    case 1000:
      return {
        button: "bg-amber-500 hover:bg-amber-600 border-amber-400 text-slate-900 hover:scale-105 active:scale-100 transition-transform shadow-md hover:shadow-lg",
        border: "border-amber-500/50",
        tab: "data-[state=active]:bg-amber-500 data-[state=active]:text-slate-900",
        icon: "text-amber-400",
      };
    case 2000:
      return {
        button: "bg-red-600 hover:bg-red-700 border-red-500 text-white hover:scale-105 active:scale-100 transition-transform shadow-md hover:shadow-lg",
        border: "border-red-500/50",
        tab: "data-[state=active]:bg-red-600 data-[state=active]:text-white",
        icon: "text-red-400",
      };
    default:
      return {
        button: "bg-slate-600 hover:bg-slate-700 border-slate-500 text-white hover:scale-105 active:scale-100 transition-transform shadow-md hover:shadow-lg",
        border: "border-slate-500/50",
        tab: "data-[state=active]:bg-slate-600 data-[state=active]:text-white",
        icon: "text-slate-400",
      };
  }
}
