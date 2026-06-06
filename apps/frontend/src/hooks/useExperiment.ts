import { useAbStore } from '../store/abStore';

interface ExperimentResult {
  variant: string | null;
  isControl: boolean;
  track: (event: string, metadata?: Record<string, unknown>) => void;
}

/**
 * Returns the current user's variant for a named experiment.
 *
 * variant      — the assigned variant key, or null if user is not in the experiment
 * isControl    — true when variant equals controlVariant (default: 'control') or is null
 * track(event) — fire an event for this experiment (e.g. 'conversion', 'click')
 */
export function useExperiment(name: string, controlVariant = 'control'): ExperimentResult {
  const assignments = useAbStore(s => s.assignments);
  const track       = useAbStore(s => s.track);
  const variant     = assignments[name] ?? null;
  return {
    variant,
    isControl: variant === null || variant === controlVariant,
    track: (event, metadata) => { void track(name, event, metadata); },
  };
}
