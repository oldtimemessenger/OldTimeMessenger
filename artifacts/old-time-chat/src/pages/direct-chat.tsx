import { ArrowLeft, Clock3, ImagePlus, MoreVertical, Paperclip, Phone, Smile } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, useLocation, useParams } from 'wouter';
import { getGetDirectChatQueryKey, getGetInboxQueryKey, getListMessagesQueryKey, useCreateMessage, useGetDirectChat, useGetInbox, useListMessages, useMarkChatRead } from '@workspace/api-client-react';
import type { Message } from '@workspace/api-client-react';
import { AttachmentMenu, Avatar, ChatActionMenu, ChatShell, ErrorState, IconButton, ReadMark, SendButton, SkeletonRows } from '@/components/chat-ui';
import { displayDay, displayTime, getStoredUser } from '@/lib/session';
import { useQueryClient } from '@tanstack/react-query';

export default function DirectChatPage() {
  const [, setLocation] = useLocation();
  const params = useParams<{ chatId: string }>();
  const queryClient = useQueryClient();
  const viewer = getStoredUser();
  const chatId = Number(params.chatId) || 0;
  const [draft, setDraft] = useState('');
  const [localMessages, setLocalMessages] = useState<Message[]>([]);
  const [attachmentOpen, setAttachmentOpen] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [muted, setMuted] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [archived, setArchived] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inboxQuery = useGetInbox(viewer?.id ?? 0, { query: { refetchInterval: 5000, queryKey: getGetInboxQueryKey(viewer?.id ?? 0) } });
  const inboxItem = useMemo(() => (inboxQuery.data ?? []).find((item) => item.chat.id === chatId), [inboxQuery.data, chatId]);
  const contact = inboxItem?.contact;
  const directChat = useGetDirectChat(viewer?.id ?? 0, contact?.id ?? 0, { query: { enabled: Boolean(contact), refetchInterval: 5000, queryKey: getGetDirectChatQueryKey(viewer?.id ?? 0, contact?.id ?? 0) } });
  const messagesQuery = useListMessages(chatId, { viewerId: viewer?.id ?? 0 }, { query: { enabled: Boolean(viewer && chatId), refetchInterval: 3000, queryKey: getListMessagesQueryKey(chatId, { viewerId: viewer?.id ?? 0 }) } });
  const markRead = useMarkChatRead();
  const createMessage = useCreateMessage();
  const messages = messagesQuery.data ?? [];
  const chatName = contact?.name ?? directChat.data?.chat?.name;
  const allMessages = useMemo(() => [...messages, ...localMessages.filter((local) => !messages.some((item) => item.id === local.id))], [messages, localMessages]);

  useEffect(() => {
    if (!viewer) { setLocation('/'); return; }
    if (chatId && viewer.id) markRead.mutate({ chatId, data: { viewerId: viewer.id } }, { onSuccess: () => queryClient.setQueryData(getGetInboxQueryKey(viewer.id), (old: typeof inboxQuery.data) => old?.map((item) => item.chat.id === chatId ? { ...item, unreadCount: 0 } : item)) });
  }, [chatId, viewer?.id]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [allMessages.length]);

  if (!viewer) return null;
  const submitMessage = (event: FormEvent) => {
    event.preventDefault();
    const content = draft.trim();
    if (!content || createMessage.isPending) return;
    setDraft('');
    createMessage.mutate({ chatId, data: { senderId: viewer.id, content } }, { onSuccess: (message) => { setLocalMessages((current) => [...current.filter((item) => item.id !== message.id), message]); queryClient.setQueryData(getListMessagesQueryKey(chatId, { viewerId: viewer.id }), (old: Message[] | undefined) => [...(old ?? []), message]); queryClient.setQueryData(getGetInboxQueryKey(viewer.id), (old: typeof inboxQuery.data) => old?.map((item) => item.chat.id === chatId ? { ...item, lastMessage: message } : item)); }, onError: () => setDraft(content) });
  };
  const toggleAction = (key: 'muted' | 'pinned' | 'archived') => { if (key === 'muted') setMuted((value) => !value); if (key === 'pinned') setPinned((value) => !value); if (key === 'archived') setArchived((value) => !value); setActionsOpen(false); };
  const grouped = allMessages.reduce<{ day: string; messages: Message[] }[]>((groups, message) => { const day = displayDay(message.timestamp); const group = groups.find((entry) => entry.day === day); if (group) group.messages.push(message); else groups.push({ day, messages: [message] }); return groups; }, []);

  return <ChatShell userName={viewer.name} currentChatId={chatId} onTabChange={(tab) => { if (tab !== 'chats') window.alert(`${tab[0].toUpperCase()}${tab.slice(1)} are available from your home screen.`); }}>
    <div className="flex h-[100dvh] flex-col bg-[#e6ebee]">
      <header className="relative flex h-[68px] shrink-0 items-center justify-between border-b border-border bg-card px-3 sm:px-5">
        <div className="flex min-w-0 items-center gap-2.5"><Link href="/chats" className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-primary hover:bg-muted" data-testid="link-back-chats"><ArrowLeft size={21} /></Link>{chatName ? <Avatar name={chatName} online={contact?.online} /> : <div className="h-[50px] w-[50px] animate-pulse rounded-full bg-muted" />}<div className="min-w-0"><h1 className="truncate text-base font-bold" data-testid="text-chat-name">{chatName ?? 'Opening conversation...'}</h1><p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground" data-testid="status-chat-presence"><span className={`h-1.5 w-1.5 rounded-full ${contact?.online ? 'bg-[#4dc24b]' : 'bg-muted-foreground/40'}`} />{contact?.online ? 'online' : 'last seen recently'}</p></div></div>
        <div className="relative flex items-center gap-0.5"><IconButton label="start-audio-call" onClick={() => window.alert(`Calling ${chatName ?? 'your contact'}.`)}><Phone size={18} /></IconButton><IconButton label="conversation-options" onClick={() => setActionsOpen((value) => !value)}><MoreVertical size={20} /></IconButton>{actionsOpen && <ChatActionMenu muted={muted} pinned={pinned} archived={archived} onToggle={toggleAction} />}</div>
      </header>
      {archived && <div className="flex items-center justify-center gap-2 bg-[#eeffde] px-4 py-2 text-xs font-semibold text-foreground"><span>Archived chat</span><button onClick={() => setArchived(false)} className="underline" data-testid="button-unarchive-banner">Restore</button></div>}
      <div className="min-h-0 flex-1 overflow-y-auto bg-[#e6ebee] px-3 py-5 sm:px-8"><div className="mx-auto max-w-2xl">{messagesQuery.isLoading ? <SkeletonRows count={5} /> : messagesQuery.isError ? <ErrorState message="Messages are taking a moment." onRetry={() => messagesQuery.refetch()} /> : allMessages.length === 0 ? <div className="flex min-h-[360px] flex-col items-center justify-center text-center" data-testid="status-empty-messages"><span className="mb-4 grid h-16 w-16 place-items-center rounded-full bg-white text-primary shadow-sm"><Paperclip size={25} /></span><h2 className="text-xl font-bold">No messages yet</h2><p className="mt-2 max-w-xs text-sm leading-6 text-muted-foreground">Send a message to start the conversation.</p></div> : <div className="space-y-5">{grouped.map((group) => <section key={group.day}><div className="mb-3 text-center"><span className="rounded-full bg-white/80 px-3 py-1 text-[10px] font-semibold text-muted-foreground shadow-sm">{group.day}</span></div><div className="space-y-1.5">{group.messages.map((message, index) => { const mine = message.senderId === viewer.id; return <div key={`${message.id}-${index}`} className={`flex animate-message-in ${mine ? 'justify-end' : 'justify-start'}`}><div className={`flex max-w-[86%] flex-col ${mine ? 'items-end' : 'items-start'}`}><div className={`relative rounded-2xl px-3.5 py-2 text-[15px] leading-6 shadow-sm ${mine ? 'rounded-tr-sm bg-[#eeffde] text-[#1b1b1b]' : 'rounded-tl-sm border border-border bg-white text-[#1b1b1b]'}`} data-testid={`text-message-${message.id}`}>{message.content}<span className="ml-2 inline-flex translate-y-0.5 items-center gap-1 text-[10px] text-muted-foreground"><span>{displayTime(message.timestamp)}</span>{mine && <ReadMark read={message.read} />}</span></div></div></div>; })}</div></section>)}</div>}<div ref={bottomRef} /></div></div>
      <div className="shrink-0 border-t border-border bg-card px-3 py-2.5 sm:px-8"><form onSubmit={submitMessage} className="mx-auto flex max-w-2xl items-end gap-2" data-testid="form-send-message"><div className="relative flex min-w-0 flex-1 items-end rounded-2xl border border-border bg-background px-1.5"><div className="relative"><button type="button" onClick={() => setAttachmentOpen((value) => !value)} className="grid h-11 w-9 place-items-center text-muted-foreground hover:text-primary" aria-label="Add attachment" data-testid="button-add-attachment"><Paperclip size={19} /></button>{attachmentOpen && <AttachmentMenu onClose={() => setAttachmentOpen(false)} />}</div><textarea value={draft} onChange={(event) => setDraft(event.target.value.slice(0, 2000))} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} rows={1} placeholder="Message" className="max-h-32 min-h-11 flex-1 resize-none bg-transparent px-2 py-3 text-sm leading-5 outline-none placeholder:text-muted-foreground/65" aria-label="Message" data-testid="input-message" /><button type="button" onClick={() => window.alert('Sticker picker opened.')} className="grid h-11 w-9 place-items-center text-muted-foreground hover:text-primary" aria-label="Add sticker" data-testid="button-add-sticker"><Smile size={18} /></button><button type="button" onClick={() => window.alert('Photo picker opened.')} className="grid h-11 w-9 place-items-center text-muted-foreground hover:text-primary" aria-label="Add photo" data-testid="button-add-photo"><ImagePlus size={18} /></button></div><SendButton disabled={!draft.trim()} pending={createMessage.isPending} /></form><div className="mx-auto mt-1 flex max-w-2xl items-center gap-1.5 px-2 text-[9px] uppercase tracking-wider text-muted-foreground/60"><Clock3 size={11} /> enter to send</div></div>
    </div>
  </ChatShell>;
}