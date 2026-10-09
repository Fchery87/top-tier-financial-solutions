/** Asks the server where a freshly signed-in user should land. Browser only. */
export async function resolvePostSignInLanding(next: string | null): Promise<string> {
  const response = await fetch(`/api/auth/landing${next ? `?next=${encodeURIComponent(next)}` : ''}`);
  const data: unknown = await response.json().catch(() => null);
  if (typeof data === 'object' && data !== null && 'landing' in data && typeof data.landing === 'string') {
    return data.landing;
  }
  return '/';
}
