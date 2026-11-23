export const QUIZ_DURATION_SECONDS = 300; // 5 minutes

export type QuizTimerState = 'idle' | 'running' | 'finished';
export type QuizFinishReason = 'completed' | 'manual' | 'timeout' | null;

/**
 * Formats seconds as MM:SS with zero-padding for tabular countdown displays.
 */
export function formatCountdown(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(Number.isFinite(totalSeconds) ? totalSeconds : 0));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function getTimerUrgency(secondsLeft: number, state: QuizTimerState): 'normal' | 'warning' | 'critical' | 'finished' {
  if (state === 'finished' || secondsLeft <= 0) return 'finished';
  if (secondsLeft <= 15) return 'critical';
  if (secondsLeft <= 60) return 'warning';
  return 'normal';
}
