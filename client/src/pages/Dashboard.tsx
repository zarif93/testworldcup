import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { Loader2, LogOut, LayoutGrid } from "lucide-react";
import { GameFormDialog } from "@/components/GameFormDialog";
import { useLocation } from "wouter";

export default function Dashboard() {
  const { user, logout } = useAuth();
  const [, setLocation] = useLocation();
  const [isFormOpen, setIsFormOpen] = useState(false);

  const { data: submissions, isLoading, refetch } = trpc.gameSubmission.getAll.useQuery();

  const handleFormSubmit = () => {
    setIsFormOpen(false);
    refetch();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">World Cup 2026</h1>
            <p className="text-sm text-slate-600">Game Predictions Dashboard</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-medium text-slate-900">{user?.name || user?.username}</p>
              <p className="text-xs text-slate-600 capitalize">{user?.role}</p>
            </div>
            <div className="flex gap-2">
              {user?.role === "admin" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setLocation("/admin")}
                >
                  <LayoutGrid className="w-4 h-4 mr-2" />
                  Admin Panel
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={logout}
              >
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Submit Button */}
        <div className="mb-8">
          <Button
            onClick={() => setIsFormOpen(true)}
            size="lg"
            className="bg-blue-600 hover:bg-blue-700"
          >
            + Submit Game Form
          </Button>
        </div>

        {/* Submissions List */}
        <div className="space-y-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900 mb-4">
              All Submissions ({submissions?.length || 0})
            </h2>
          </div>

          {!submissions || submissions.length === 0 ? (
            <Card>
              <CardContent className="pt-8 text-center">
                <p className="text-slate-600">No submissions yet</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {submissions.map((submission) => (
                <Card key={submission.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">{submission.username}</CardTitle>
                        <CardDescription>
                          Submitted {new Date(submission.createdAt).toLocaleDateString()}
                        </CardDescription>
                      </div>
                      <div className="flex gap-2">
                        <Badge
                          variant={submission.status === "approved" ? "default" : "secondary"}
                          className={
                            submission.status === "approved"
                              ? "bg-green-600 hover:bg-green-700"
                              : submission.status === "rejected"
                              ? "bg-red-600 hover:bg-red-700"
                              : "bg-orange-500 hover:bg-orange-600"
                          }
                        >
                          {submission.status === "approved"
                            ? "✓ Approved"
                            : submission.status === "rejected"
                            ? "✗ Rejected"
                            : "⏳ Pending"}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <p className="text-sm text-slate-600">
                        <strong>Matches:</strong> {Array.isArray(submission.matchResults) ? submission.matchResults.length : 0}
                      </p>
                      {Array.isArray(submission.matchResults) && submission.matchResults.length > 0 && (
                        <div className="mt-3 space-y-1">
                          {submission.matchResults.slice(0, 3).map((match: any, idx: number) => (
                            <p key={idx} className="text-sm text-slate-600">
                              {match.homeTeam} vs {match.awayTeam} → {match.prediction}
                            </p>
                          ))}
                          {submission.matchResults.length > 3 && (
                            <p className="text-sm text-slate-500 italic">
                              +{submission.matchResults.length - 3} more matches
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Game Form Dialog */}
      <GameFormDialog
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSubmit={handleFormSubmit}
        username={user?.username || user?.name || ""}
      />
    </div>
  );
}
