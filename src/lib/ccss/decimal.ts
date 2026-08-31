const POW10: bigint[] = Array.from({ length: 13 }, (_, index) => 10n ** BigInt(index));

function roundDivide(numerator: bigint, denominator: bigint) {
  if (denominator <= 0n) throw new Error("The decimal denominator must be positive.");
  const sign = numerator < 0n ? -1n : 1n;
  const absolute = numerator < 0n ? -numerator : numerator;
  const quotient = absolute / denominator;
  const remainder = absolute % denominator;
  return sign * (quotient + (remainder * 2n >= denominator ? 1n : 0n));
}

export function parseScaled(value: string, scale: number) {
  if (!Number.isInteger(scale) || scale < 0 || scale >= POW10.length) throw new Error("Unsupported decimal scale.");
  const normalized = value.trim();
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(normalized);
  if (!match) throw new Error(`Invalid exact decimal value: ${value}`);
  const sign = match[1] === "-" ? -1n : 1n;
  const whole = BigInt(match[2]);
  const fraction = match[3] ?? "";
  const denominator = POW10[fraction.length];
  const raw = whole * denominator + BigInt(fraction || "0");
  return sign * roundDivide(raw * POW10[scale], denominator);
}

export function cents(value: string) {
  return parseScaled(value, 2);
}

export function centsToString(value: bigint) {
  const sign = value < 0n ? "-" : "";
  const absolute = value < 0n ? -value : value;
  return `${sign}${absolute / 100n}.${String(absolute % 100n).padStart(2, "0")}`;
}

export function centsToNumber(value: bigint) {
  const converted = Number(value);
  if (!Number.isSafeInteger(converted)) throw new Error("Money value exceeds the safe display range.");
  return converted;
}

export function multiplyByPercent(amountCents: bigint, percentage: string) {
  const rate = parseScaled(percentage, 6);
  return roundDivide(amountCents * rate, 100n * POW10[6]);
}

export function multiplyByPercentAndFactor(amountCents: bigint, percentage: string, factor: string) {
  const rate = parseScaled(percentage, 6);
  const factorValue = parseScaled(factor, 4);
  return roundDivide(amountCents * rate * factorValue, 100n * POW10[6] * POW10[4]);
}

export function divideMoney(amountCents: bigint, divisor: number) {
  if (!Number.isInteger(divisor) || divisor <= 0) throw new Error("Money divisor must be a positive integer.");
  return roundDivide(amountCents, BigInt(divisor));
}

export function clampMoney(value: bigint, minimum: bigint, maximum: bigint) {
  if (minimum > maximum) throw new Error("Invalid contribution-base range.");
  return value < minimum ? minimum : value > maximum ? maximum : value;
}
