export function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
export function parseMoney(value: unknown, options?: { allowZero?: boolean }) {
  const parsed = Number(value);
  const allowZero = options?.allowZero !== false;

  if (!Number.isFinite(parsed) || parsed < 0 || (!allowZero && parsed === 0)) {
    return null;
  }

  if (Math.abs(parsed * 100 - Math.round(parsed * 100)) > 1e-7) {
    return null;
  }

  return roundMoney(parsed);
}
