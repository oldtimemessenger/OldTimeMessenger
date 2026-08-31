import { Edit3, LogOut, MoreVertical, Search, UserRound, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'wouter';
import { getGetInboxQueryKey, getListUsersQueryKey, useCreateChat, useGetInbox, useListUsers, useLogout } from '@workspace/api-client-react';
import type { InboxItem, User } from '@workspace/api-client-react';
import { Avatar, ChatListItem, ChatShell, EmptyState, ErrorState, SearchField, SkeletonRows, type NavTab } from '@/components/chat-ui';
import { displayTime, getStoredUser } from '@/lib/session';
import { useQueryClient } from '@tanstack/react-query';

export default function ChatsPage() {
  const [location, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const viewer = getStoredUser();
  const [search, setSearch] = useState('');
  const [startingId, setStartingId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<NavTab>('chats');
  const [composeOpen, setComposeOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const inboxQuery = useGetInbox(viewer?.id ?? 0, { query: { refetchInterval: 5000, queryKey: getGetInboxQueryKey(viewer?.id ?? 0) } });
  const usersQuery = useListUsers({ viewerId: viewer?.id ?? 0 }, { query: { refetchInterval: 5000, queryKey: getListUsersQueryKey({ viewerId: viewer?.id ?? 0 }) } });
  const createChat = useCreateChat();
  const logout = useLogout();
  const inbox = inboxQuery.data ?? [];
  const users = usersQuery.data ?? [];
  const inboxByContact = useMemo(() => new Map(inbox.map((item) => [item.contact.id, item])), [inbox]);
  const normalizedSearch = search.trim().toLowerCase();
  const filteredInbox = useMemo(() => inbox.filter((item) => `${item.contact.name} ${item.contact.phone}`.toLowerCase().includes(normalizedSearch)), [inbox, normalizedSearch]);
  const filteredUsers = useMemo(() => users.filter((user) => `${user.name} ${user.phone}`.toLowerCase().includes(normalizedSearch)), [users, normalizedSearch]);

  useEffect(() => {
    if (!viewer && location !== '/') setLocation('/');
  }, [location, setLocation, Boolean(viewer)]);

  if (!viewer) return null;

  const startChat = (person: User) => {
    const existing = inboxByContact.get(person.id);
    if (existing) { setComposeOpen(false); setLocation(`/chats/${existing.chat.id}`); return; }
    setStartingId(person.id);
    createChat.mutate({ data: { userIds: [viewer.id, person.id] } }, {
      onSuccess: (chat) => {
        queryClient.invalidateQueries({ queryKey: getGetInboxQueryKey(viewer.id) });
        setComposeOpen(false);
        setLocation(`/chats/${chat.id}`);
      },
      onSettled: () => setStartingId(null),
    });
  };

  const signOut = () => {
    logout.mutate(undefined, {
      onSettled: () => {
        localStorage.removeItem('old-time-user');
        queryClient.clear();
        setLocation('/');
      },
    });
  };

  if (activeTab !== 'chats') {
    return <ChatShell userName={viewer.name} activeTab={activeTab} onTabChange={setActiveTab}>
      <div className="flex min-h-[100dvh] items-center justify-center bg-background px-5 text-center">
        <div className="max-w-sm"><span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-primary/10 text-primary"><UserRound size={25} /></span><h1 className="mt-5 text-2xl font-bold">{activeTab === 'updates' ? 'Contacts' : activeTab === 'communities' ? 'Saved Messages' : 'Settings'}</h1><p className="mt-2 text-sm leading-6 text-muted-foreground">This Old Time section is being prepared for a future release.</p>{activeTab === 'calls' && <button onClick={signOut} className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-destructive"><LogOut size={16} />Sign out</button>}</div>
      </div>
    </ChatShell>;
  }

  return <ChatShell userName={viewer.name} activeTab="chats" onTabChange={setActiveTab}>
    <div className="flex min-h-[100dvh] flex-col bg-background">
      <header className="flex h-[72px] items-center justify-between border-b border-border bg-card px-4 sm:px-6">
        <div className="flex items-center gap-3"><h1 className="text-[28px] font-bold tracking-[-.05em]">Chats</h1>{inbox.length > 0 && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">{inbox.length}</span>}</div>
        <div className="flex items-center gap-1">
          <button onClick={() => setComposeOpen(true)} className="grid h-10 w-10 place-items-center rounded-full text-primary hover:bg-muted" aria-label="New message" data-testid="button-new-chat"><Edit3 size={21} /></button>
          <button onClick={() => setProfileOpen(true)} className="grid h-10 w-10 place-items-center rounded-full text-primary hover:bg-muted" aria-label="Open profile" data-testid="button-open-profile"><UserRound size={20} /></button>
          <button onClick={() => window.alert('Chat options opened.')} className="grid h-10 w-10 place-items-center rounded-full text-primary hover:bg-muted" aria-label="More chat options" data-testid="button-more-chats"><MoreVertical size={20} /></button>
        </div>
      </header>
      <div className="mx-auto w-full max-w-[820px] flex-1">
        <div className="border-b border-border bg-card px-4 py-3 sm:px-6"><SearchField value={search} onChange={setSearch} /></div>
        <section className="animate-page-in">
          {inboxQuery.isLoading ? <SkeletonRows count={5} /> : inboxQuery.isError ? <div className="pt-5"><ErrorState message="Chats are taking a moment." onRetry={() => inboxQuery.refetch()} /></div> : filteredInbox.length === 0 ? <div className="pt-5"><EmptyState search={Boolean(search)} /></div> : <div>{filteredInbox.map((item: InboxItem, index) => <div key={item.chat.id} style={{ animationDelay: `${index * 35}ms` }} className="animate-page-in"><ChatListItem name={item.contact.name} preview={item.lastMessage?.content ?? 'No messages yet'} time={displayTime(item.lastMessage?.timestamp)} unread={item.unreadCount} online={item.contact.online} chatId={item.chat.id} /></div>)}</div>}
        </section>
      </div>
      <button onClick={() => setComposeOpen(true)} className="fixed bottom-6 right-6 z-20 grid h-14 w-14 place-items-center rounded-full bg-primary text-primary-foreground shadow-[0_6px_18px_hsl(var(--primary)/.35)] hover:-translate-y-0.5" aria-label="New message" data-testid="button-floating-new-chat"><Edit3 size={23} /></button>
    </div>

    {composeOpen && <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/25 p-3 backdrop-blur-[2px] sm:items-center" onClick={() => setComposeOpen(false)}>
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-card shadow-[var(--shadow-md)]" onClick={(event) => event.stopPropagation()} data-testid="dialog-new-chat">
        <div className="flex items-center justify-between border-b border-border px-5 py-4"><div><h2 className="text-xl font-bold">New Message</h2><p className="mt-0.5 text-xs text-muted-foreground">Search people by name or phone</p></div><button onClick={() => setComposeOpen(false)} className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground hover:bg-muted" aria-label="Close new chat" data-testid="button-close-new-chat"><X size={20} /></button></div>
        <div className="p-4"><label className="flex items-center gap-2 rounded-xl bg-muted px-4 py-3 text-muted-foreground"><Search size={17} /><input autoFocus value={search} onChange={(event) => setSearch(event.target.value)} className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground" placeholder="Search" aria-label="Search people" /></label></div>
        <div className="max-h-[52vh] overflow-y-auto pb-2">{usersQuery.isLoading ? <SkeletonRows count={3} /> : filteredUsers.length === 0 ? <p className="px-5 py-8 text-center text-sm text-muted-foreground">{search ? 'No users found.' : 'No contacts available yet.'}</p> : filteredUsers.map((person) => <button key={person.id} onClick={() => startChat(person)} disabled={startingId !== null} className="flex w-full items-center gap-3 border-t border-border px-5 py-3 text-left hover:bg-muted disabled:opacity-60" data-testid={`button-dialog-contact-${person.id}`}><Avatar name={person.name} online={person.online} /><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{person.name}</span><span className="text-xs text-muted-foreground">{person.phone}</span></span></button>)}</div>
      </div>
    </div>}

    {profileOpen && <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/25 p-3 backdrop-blur-[2px] sm:items-center" onClick={() => setProfileOpen(false)}>
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-card shadow-[var(--shadow-md)]" onClick={(event) => event.stopPropagation()} data-testid="dialog-profile">
        <div className="relative flex flex-col items-center bg-gradient-to-br from-[#63bffb] to-[#3b8fd6] px-5 pb-6 pt-8 text-white"><button onClick={() => setProfileOpen(false)} className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full text-white hover:bg-white/15" aria-label="Close profile"><X size={20} /></button><Avatar name={viewer.name} size="lg" /><h2 className="mt-3 text-xl font-bold">{viewer.name}</h2><p className="mt-1 text-sm text-white/80">{viewer.phone}</p></div>
        <div className="p-5"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Account</p><div className="mt-3 flex items-center gap-3 rounded-xl bg-muted p-3"><span className="grid h-9 w-9 place-items-center rounded-full bg-card text-primary"><UserRound size={18} /></span><div><p className="text-sm font-semibold">Available</p><p className="text-xs text-muted-foreground">Your profile is visible to contacts</p></div></div><button onClick={signOut} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-destructive hover:bg-destructive/10" data-testid="button-sign-out"><LogOut size={16} />Log out</button></div>
      </div>
    </div>}
  </ChatShell>;
}