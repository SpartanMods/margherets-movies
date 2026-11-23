// The palace tiers. A score lands in the first tier whose `min` it meets.
// `step` (1 to 6) drives the color ramp used by tier badges and score bars.
export const TIERS = [
  { min: 90, name: 'Standing Ovation', slug: 'standing-ovation', step: 6, blurb: 'The whole house is on its feet. Go see it, then make someone else see it.' },
  { min: 80, name: 'Front Row', slug: 'front-row', step: 5, blurb: 'Worth the best seat in the house. A few nitpicks, a lot to love.' },
  { min: 70, name: 'Worth the Ticket', slug: 'worth-the-ticket', step: 4, blurb: 'A good night at the movies. You will not regret the price of admission.' },
  { min: 60, name: 'Matinee Only', slug: 'matinee-only', step: 3, blurb: 'Fine, flawed, and best caught at the cheap showing.' },
  { min: 40, name: 'Wait for Streaming', slug: 'wait-for-streaming', step: 2, blurb: 'Some things work. Not enough to leave the couch for.' },
  { min: 0, name: 'Walk Out', slug: 'walk-out', step: 1, blurb: 'The exits are clearly marked. Use them.' },
];

export function tierFor(score) {
  if (typeof score !== 'number' || Number.isNaN(score)) return null;
  return TIERS.find((t) => score >= t.min) ?? TIERS[TIERS.length - 1];
}

/** Ramp step for a single category, from its percentage (0 to 1). Same cut points as the tiers. */
export function stepForPct(pct) {
  return tierFor(Math.round(pct * 100))?.step ?? 1;
}
