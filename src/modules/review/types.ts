/** One week's reflection, keyed by its Monday. */
export interface Review {
  worked?: string;
  didnt?: string;
  intention?: string;
  /** Did last week's intention happen? */
  keptLast?: boolean;
  sealedAt?: string;
}

export interface ReviewData {
  reviews: Record<string, Review>;
}

export const DEFAULT_REVIEW: ReviewData = { reviews: {} };
