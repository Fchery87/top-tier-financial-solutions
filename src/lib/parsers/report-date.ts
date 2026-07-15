export interface ParseReportDateOptions {
  allowMonthYear?: boolean;
  allowYearOnly?: boolean;
}

function normalizeDateInput(value: string | undefined | null): string | undefined {
  if (!value) return undefined;
  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized && normalized !== '-' ? normalized : undefined;
}

function buildUtcDate(year: number, month: number, day: number): Date | undefined {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return undefined;
  if (month < 1 || month > 12 || day < 1 || day > 31) return undefined;

  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return undefined;
  }

  return date;
}

export function parseMonthDayYearDate(value: string | undefined | null): Date | undefined {
  const normalized = normalizeDateInput(value);
  if (!normalized) return undefined;

  const match = normalized.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})$/);
  if (!match) return undefined;

  const [, monthRaw, dayRaw, yearRaw] = match;
  const year = yearRaw.length === 2 ? Number(`20${yearRaw}`) : Number(yearRaw);
  return buildUtcDate(year, Number(monthRaw), Number(dayRaw));
}

export function parseMonthYearDate(value: string | undefined | null): Date | undefined {
  const normalized = normalizeDateInput(value);
  if (!normalized) return undefined;

  const match = normalized.match(/^(\d{1,2})[\/-](\d{4})$/);
  if (!match) return undefined;

  const [, monthRaw, yearRaw] = match;
  return buildUtcDate(Number(yearRaw), Number(monthRaw), 1);
}

export function parseYearDate(value: string | undefined | null): Date | undefined {
  const normalized = normalizeDateInput(value);
  if (!normalized) return undefined;

  const match = normalized.match(/^(\d{4})$/);
  if (!match) return undefined;
  return buildUtcDate(Number(match[1]), 1, 1);
}

export function parseReportDate(
  value: string | undefined | null,
  options: ParseReportDateOptions = {},
): Date | undefined {
  const normalized = normalizeDateInput(value);
  if (!normalized) return undefined;

  return (
    parseMonthDayYearDate(normalized) ||
    (options.allowMonthYear ? parseMonthYearDate(normalized) : undefined) ||
    (options.allowYearOnly ? parseYearDate(normalized) : undefined)
  );
}
