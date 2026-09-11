export type VerificationState = {
  verificationPaidAt?: number | null;
  verificationApprovedAt?: number | null;
};

/**
 * The client only receives this derived value. Payment and approval timestamps
 * are written by trusted server flows, never from profile update input.
 */
export function hasVerificationBadge(state: VerificationState): boolean {
  return (
    (state.verificationPaidAt != null && state.verificationPaidAt > 0)
    || (state.verificationApprovedAt != null && state.verificationApprovedAt > 0)
  );
}