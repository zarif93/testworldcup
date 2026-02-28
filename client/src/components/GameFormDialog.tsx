import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Loader2, X } from "lucide-react";

interface Match {
  matchId: string;
  homeTeam: string;
  awayTeam: string;
  prediction: "home" | "draw" | "away" | "";
  score?: string;
}

const DEFAULT_MATCHES: Match[] = [
  { matchId: "1", homeTeam: "Team A", awayTeam: "Team B", prediction: "" },
  { matchId: "2", homeTeam: "Team C", awayTeam: "Team D", prediction: "" },
  { matchId: "3", homeTeam: "Team E", awayTeam: "Team F", prediction: "" },
];

interface GameFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: () => void;
  username: string;
}

export function GameFormDialog({
  isOpen,
  onClose,
  onSubmit,
  username,
}: GameFormDialogProps) {
  const [matches, setMatches] = useState<Match[]>(DEFAULT_MATCHES);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submitMutation = trpc.gameSubmission.submit.useMutation();

  const handlePredictionChange = (index: number, prediction: string) => {
    const newMatches = [...matches];
    newMatches[index].prediction = prediction as "home" | "draw" | "away" | "";
    setMatches(newMatches);
  };

  const handleAddMatch = () => {
    const newMatch: Match = {
      matchId: String(matches.length + 1),
      homeTeam: "",
      awayTeam: "",
      prediction: "",
    };
    setMatches([...matches, newMatch]);
  };

  const handleRemoveMatch = (index: number) => {
    setMatches(matches.filter((_, i) => i !== index));
  };

  const handleTeamChange = (
    index: number,
    field: "homeTeam" | "awayTeam",
    value: string
  ) => {
    const newMatches = [...matches];
    newMatches[index][field] = value;
    setMatches(newMatches);
  };

  const handleSubmit = async () => {
    if (matches.length === 0) {
      toast.error("Please add at least one match");
      return;
    }

    const allPredictionsSelected = matches.every((m) => m.prediction);
    if (!allPredictionsSelected) {
      toast.error("Please select a prediction for all matches");
      return;
    }

    setIsSubmitting(true);

    try {
      await submitMutation.mutateAsync({
        matchResults: matches.map((m) => ({
          matchId: m.matchId,
          homeTeam: m.homeTeam || "Team A",
          awayTeam: m.awayTeam || "Team B",
          prediction: m.prediction as "home" | "draw" | "away",
          score: m.score,
        })),
      });

      toast.success("Form submitted successfully!");
      setMatches(DEFAULT_MATCHES);
      onSubmit();
      onClose();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to submit form"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Submit Game Form</DialogTitle>
          <DialogDescription>
            Make your predictions for the upcoming matches
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-slate-100 p-3 rounded-lg">
            <p className="text-sm text-slate-600">
              <strong>Submitted by:</strong> {username}
            </p>
          </div>

          <div className="space-y-3">
            {matches.map((match, index) => (
              <Card key={index}>
                <CardContent className="pt-4">
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <Input
                        placeholder="Home Team"
                        value={match.homeTeam}
                        onChange={(e) =>
                          handleTeamChange(index, "homeTeam", e.target.value)
                        }
                        disabled={isSubmitting}
                      />
                      <span className="flex items-center text-slate-600 px-2">
                        vs
                      </span>
                      <Input
                        placeholder="Away Team"
                        value={match.awayTeam}
                        onChange={(e) =>
                          handleTeamChange(index, "awayTeam", e.target.value)
                        }
                        disabled={isSubmitting}
                      />
                    </div>

                    <div className="flex gap-2 items-end">
                      <div className="flex-1">
                        <label className="text-sm font-medium text-slate-700 block mb-1">
                          Prediction
                        </label>
                        <Select
                          value={match.prediction}
                          onValueChange={(value) =>
                            handlePredictionChange(index, value)
                          }
                          disabled={isSubmitting}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select prediction" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="home">Home Win</SelectItem>
                            <SelectItem value="draw">Draw</SelectItem>
                            <SelectItem value="away">Away Win</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {matches.length > 1 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveMatch(index)}
                          disabled={isSubmitting}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Button
            variant="outline"
            onClick={handleAddMatch}
            disabled={isSubmitting}
            className="w-full"
          >
            + Add Match
          </Button>

          <div className="flex gap-2 justify-end pt-4">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                "Submit Form"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
