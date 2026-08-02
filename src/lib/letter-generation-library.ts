import { fetchCandidates } from '@/lib/letter-library-repo';
import { selectLibraryRow, type Selection, type SelectionRequest } from '@/lib/letter-library-selector';

const EMPTY_SELECTION: Selection = {
  chosen: null,
  score: 0,
  rationale: [],
  runnersUp: [],
};

export async function selectLibraryForGeneration(request: SelectionRequest): Promise<Selection> {
  try {
    const candidates = await fetchCandidates(request);
    return selectLibraryRow(candidates, request);
  } catch (error) {
    console.error('Letter library selection failed; using the legacy generation strategy:', error);
    return EMPTY_SELECTION;
  }
}
