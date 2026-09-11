export type CallStatus = 'ringing' | 'accepted' | 'declined' | 'ended' | 'missed';

export const ACCEPTED_CALL_MAX_MS = 12 * 60 * 60_000;

export function isCallTerminal(status: CallStatus): boolean {
  return status === 'declined' || status === 'ended' || status === 'missed';
}

export function isAcceptedCallStale(acceptedAt: number | null, now: number): boolean {
  return acceptedAt !== null && acceptedAt < now - ACCEPTED_CALL_MAX_MS;
}