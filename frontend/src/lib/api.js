export const API_URL = (
  import.meta.env?.VITE_API_URL || 'http://localhost:5000/api'
).replace(/\/$/, '');

export async function api(
  path,
  { method = 'GET', body, token, signal } = {},
) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) abort();
  signal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(abort, 20000);

  try {
    const response = await fetch(`${API_URL}${path}`, {
      method,
      signal: controller.signal,
      headers: {
        ...(body !== undefined
          ? { 'Content-Type': 'application/json' }
          : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      const detail = result.errors
        ?.map(
          (error) =>
            `${error.field || error.path || 'Field'}: ${error.message || error.msg}`,
        )
        .join(' · ');
      const error = new Error(
        detail || result.message || `Request failed (${response.status}).`,
      );
      error.expired =
        Boolean(token) &&
        (response.status === 401 ||
          (response.status === 403 &&
            /token|inactive/i.test(result.message || '')));
      throw error;
    }

    return result;
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error(
        'Request timed out or was cancelled. Refresh the list before retrying a save.',
      );
    }
    if (error instanceof TypeError) {
      throw new Error(
        'Cannot connect to the backend. Check the API URL and confirm that the server is running.',
      );
    }
    throw error;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  }
}

export function validEmail(value) {
  const [local, domain, extra] = value.split('@');
  return value.length <= 150 && local && local.length <= 64 && domain && extra === undefined &&
    !/\s/.test(value) && !local.startsWith('.') && !local.endsWith('.') && !local.includes('..') &&
    /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+$/i.test(local) && domain.includes('.') &&
    domain.split('.').every(part => part.length <= 63 && /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i.test(part));
}
