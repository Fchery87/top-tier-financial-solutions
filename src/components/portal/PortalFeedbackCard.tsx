'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Trophy, Loader2 } from 'lucide-react';
import type { PortalFeedbackEntry } from '@/components/portal/types';

interface PortalFeedbackCardProps {
  feedbackEntry: PortalFeedbackEntry | null;
  feedbackRating: number | null;
  feedbackComment: string;
  submittingFeedback: boolean;
  onRatingChange: (rating: number) => void;
  onCommentChange: (comment: string) => void;
  onSubmit: () => void;
}

export default function PortalFeedbackCard({
  feedbackEntry, feedbackRating, feedbackComment, submittingFeedback,
  onRatingChange, onCommentChange, onSubmit,
}: PortalFeedbackCardProps) {
  if (feedbackEntry) {
    return (
      <Card className="bg-card/80 backdrop-blur-sm border-border/50">
        <CardHeader>
          <CardTitle className="font-sans text-xl flex items-center gap-2">
            <Trophy className="w-5 h-5 text-secondary" />
            Thank you for your feedback
          </CardTitle>
          <CardDescription>
            You rated your experience {feedbackEntry.rating ?? '-'} / 5.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="bg-card/80 backdrop-blur-sm border-border/50">
      <CardHeader>
        <CardTitle className="font-sans text-xl flex items-center gap-2">
          <Trophy className="w-5 h-5 text-secondary" />
          How is your experience so far?
        </CardTitle>
        <CardDescription>A quick 1–5 rating helps us improve your client portal.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2">
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => onRatingChange(value)}
              className={`w-9 h-9 rounded-full text-sm font-medium border transition-colors ${
                feedbackRating === value
                  ? 'bg-secondary text-secondary-foreground border-secondary'
                  : 'bg-background text-foreground border-border hover:border-secondary/60'
              }`}
            >
              {value}
            </button>
          ))}
        </div>
        <Input
          value={feedbackComment}
          onChange={(e) => onCommentChange(e.target.value)}
          placeholder="Optional: tell us what's working or what's confusing"
          className="text-sm"
        />
        <Button
          type="button"
          className="w-full"
          onClick={onSubmit}
          disabled={submittingFeedback || !feedbackRating}
        >
          {submittingFeedback ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Sending...</>
          ) : 'Send feedback'}
        </Button>
      </CardContent>
    </Card>
  );
}
