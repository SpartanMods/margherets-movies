// The five scoring categories. Edit the descriptions freely; the weights
// should match the score table in your reviews.
export const RUBRIC = [
  { name: 'Story and writing', short: 'Story', points: 20, color: 'var(--ramp-3)', text: 'The script, the characters, and whether the idea holds up once you think about it.' },
  { name: 'Execution', short: 'Execution', points: 20, color: 'var(--ramp-2)', text: 'Direction, pacing and craft. How well the movie actually pulls off what it is going for.' },
  { name: 'Performances', short: 'Performances', points: 20, color: 'var(--ramp-4)', text: 'Who carries it, who disappears into a role, and who gets wasted.' },
  { name: 'Impact', short: 'Impact', points: 30, color: 'var(--ramp-5)', text: 'What it leaves you with when you get up off the couch. Weighted heaviest on purpose.' },
  { name: 'Rewatchability', short: 'Rewatch', points: 10, color: 'var(--ramp-6)', text: 'Would you put it on again, and would it hold up the second time.' },
];

export function rubricFor(categoryName) {
  const n = String(categoryName).toLowerCase();
  return RUBRIC.find((r) => n.startsWith(r.name.toLowerCase().split(' ')[0])) ?? null;
}
