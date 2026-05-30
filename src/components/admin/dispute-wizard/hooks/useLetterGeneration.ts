import * as React from 'react';
import type { GeneratedLetter } from '../types';
import type { LetterGenerationRequestPlan } from '../types/letter-generation';

interface GenerateLettersFromPlanOptions {
  onError?: (error: unknown, request: LetterGenerationRequestPlan) => void;
}

interface GenerateLettersFromPlanResult {
  letters: GeneratedLetter[];
}

export function useLetterGeneration() {
  const [generatedLetters, setGeneratedLetters] = React.useState<GeneratedLetter[]>([]);
  const [generating, setGenerating] = React.useState(false);
  const [generationProgress, setGenerationProgress] = React.useState(0);

  const generateLettersFromPlan = React.useCallback(async (
    requests: LetterGenerationRequestPlan[],
    options: GenerateLettersFromPlanOptions = {},
  ): Promise<GenerateLettersFromPlanResult> => {
    setGenerating(true);
    setGenerationProgress(0);

    const letters: GeneratedLetter[] = [];
    let completed = 0;
    const totalLetters = requests.length;

    for (const request of requests) {
      try {
        const response = await fetch('/api/admin/disputes/generate-letter', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(request.body),
        });

        if (response.ok) {
          const data = await response.json();
          letters.push({
            id: request.combined ? `letter-${request.bureau}-${request.items.map(item => item.id).join('-')}` : `letter-${request.bureau}-${request.itemId}`,
            bureau: request.bureau,
            itemId: request.itemId,
            itemIds: request.itemIds,
            itemKind: request.itemKind,
            items: request.items,
            content: data.letter_content,
            combined: request.combined,
          });
        }
      } catch (error) {
        options.onError?.(error, request);
      }

      completed++;
      setGenerationProgress(totalLetters === 0 ? 0 : Math.round((completed / totalLetters) * 100));
    }

    setGeneratedLetters(letters);
    setGenerating(false);

    return { letters };
  }, []);

  return {
    generatedLetters,
    setGeneratedLetters,
    generating,
    setGenerating,
    generationProgress,
    setGenerationProgress,
    generateLettersFromPlan,
  };
}
