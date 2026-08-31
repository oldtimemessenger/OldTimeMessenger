import type { AuthenticatedUser } from '@workspace/api-client-react';

export function getStoredUser(): AuthenticatedUser | null {
  try {
    const raw = localStorage.getItem('old-time-user');
    const user = raw ? JSON.parse(raw) as Partial<AuthenticatedUser> : null;
    return user?.authToken ? user as AuthenticatedUser : null;
  } catch {
    return null;
  }
}

export function getStoredAuthToken(): string | null {
  return getStoredUser()?.authToken ?? null;
}

export function displayTime(timestamp?: number | null) {
  if (!timestamp) return '—';
  const date = new Date(timestamp < 100000000000 ? timestamp * 1000 : timestamp);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export function displayDay(timestamp?: number | null) {
  if (!timestamp) return 'Today';
  const date = new Date(timestamp < 100000000000 ? timestamp * 1000 : timestamp);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) return 'Today';
  return date.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
}