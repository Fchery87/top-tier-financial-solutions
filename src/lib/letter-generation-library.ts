import { fetchCandidates } from '@/lib/letter-library-repo';
import { selectLibraryRow, type Selection, type SelectionRequest } from '@/lib/letter-library-selector';
import { logServerEvent } from '@/lib/server-logger';

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
    logServerEvent({ level: 'error', event: 'server.lib.letter.generation.library.error', error: error });
    return EMPTY_SELECTION;
  }
}
