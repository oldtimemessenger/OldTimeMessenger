import { apiBaseUrl } from '@/lib/api-base-url';

export const NETWORK_UNAVAILABLE_MESSAGE =
  'Unable to reach Old Time. Check your connection and try again.';

function isAbortError(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === 'object' &&
      'name' in error &&
      (error as { name?: unknown }).name === 'AbortError',
  );
}

function networkError(): Error {
  return new Error(NETWORK_UNAVAILABLE_MESSAGE);
}

function apiError(response: Response, data: unknown): Error {
  if (data && typeof data === 'object' && typeof (data as { error?: unknown }).error === 'string') {
    return new Error((data as { error: string }).error);
  }

  return new Error(`HTTP ${response.status} ${response.statusText}`.trim());
}

/**
 * Makes authenticated requests to mobile-only API endpoints. Transport
 * failures are safe to display, while server responses retain their API error.
 */
export async function mobileApiRequest<T>(
  token: string | null,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const baseUrl = apiBaseUrl();
  if (!baseUrl) {
    throw new Error(NETWORK_UNAVAILABLE_MESSAGE);
  }

  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers: {
        Accept: 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
        ...init?.headers,
      },
    });
  } catch (error) {
    if (isAbortError(error)) throw error;
    throw networkError();
  }

  if (response.status === 204) {
    return null as T;
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch (error) {
    if (isAbortError(error)) throw error;
    if (!response.ok) {
      throw apiError(response, null);
    }
    throw new Error('Old Time returned an invalid response. Please try again.');
  }

  if (!response.ok) {
    throw apiError(response, data);
  }

  return data as T;
}