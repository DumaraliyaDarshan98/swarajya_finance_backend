export function trimToNull(value?: string | null): string | null {
  if (value == null) return null;
  const normalized = value.trim();
  return normalized.length ? normalized : null;
}

export function trimToUndefined(value?: string | null): string | undefined {
  const result = trimToNull(value);
  return result ?? undefined;
}
