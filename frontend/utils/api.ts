export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string }

export async function apiFetch<T = unknown>(
  path: string,
  options?: RequestInit,
): Promise<ApiResult<T>> {
  let res: Response
  try {
    res = await fetch(path, {
      ...options,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(options?.headers || {}),
      },
    })
  } catch (e: unknown) {
    return { ok: false, error: 'Sieťová chyba — server nedostupný' }
  }

  if (res.status === 401 && !path.endsWith('/api/auth/me')) {
    if (window.location.pathname !== '/login') {
      window.location.href = '/login'
    }
    return { ok: false, error: 'Unauthorized' }
  }

  let body: unknown = null
  try {
    body = await res.json()
  } catch {
    return { ok: false, error: `Neplatná odpoveď servera (${res.status})` }
  }

  if (
    body &&
    typeof body === 'object' &&
    'ok' in body &&
    typeof (body as { ok: unknown }).ok === 'boolean'
  ) {
    return body as ApiResult<T>
  }
  return { ok: false, error: 'Neznáma odpoveď servera' }
}
