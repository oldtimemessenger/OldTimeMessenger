type PresenceUser = {
  online?: boolean;
  lastSeen?: number;
  lastSeenVisible?: boolean;
};

function asDate(timestamp: number) {
  return new Date(timestamp < 100000000000 ? timestamp * 1000 : timestamp);
}

export function presenceLabel(user: PresenceUser) {
  if (user.online) return 'online';
  if (user.lastSeenVisible === false || !user.lastSeen) return 'offline';

  const date = asDate(user.lastSeen);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  if (sameDay) {
    return `last seen today at ${date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
  }

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) {
    return `last seen yesterday at ${date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
  }

  return `last seen ${date.toLocaleDateString([], { month: 'short', day: 'numeric', year: date.getFullYear() === now.getFullYear() ? undefined : 'numeric' })} at ${date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
}