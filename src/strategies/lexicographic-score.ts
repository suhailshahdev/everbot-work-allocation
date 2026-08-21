export function isLexicographicallyLower(
  candidate: readonly number[],
  incumbent: readonly number[],
): boolean {
  for (let index = 0; index < candidate.length; index += 1) {
    const candidateValue = candidate[index];
    const incumbentValue = incumbent[index];

    if (candidateValue === undefined || incumbentValue === undefined) {
      continue;
    }

    if (candidateValue !== incumbentValue) {
      return candidateValue < incumbentValue;
    }
  }

  return false;
}
