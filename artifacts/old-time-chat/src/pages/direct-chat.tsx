import { ArrowLeft, Clock3, ImagePlus, MoreVertical, Paperclip, Phone, Smile } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, useLocation, useParams } from 'wouter';
import { getGetDirectChatQueryKey, getGetInboxQueryKey, getListMessagesQueryKey, useCreateMessage, useGetDirectChat, useGetInbox, useListMessages, useMarkChatRead, useRequestUploadUrl } from '@workspace/api-client-react';
import type { Attachment, Message } from '@workspace/api-client-react';
import { AttachmentMenu, Avatar, ChatActionMenu, ChatShell, EmojiPicker, ErrorState, IconButton, ReadMark, SendButton, SkeletonRows } from '@/components/chat-ui';
import { displayDay, displayTime, getStoredUser } from '@/lib/session';
import { useQueryClient } from '@tanstack/react-query';

function MessageAttachment({ attachment }: { attachment: Attachment }) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    void fetch(`/api/storage${attachment.objectPath}`, {
      headers: { Authorization: `Bearer ${getStoredUser()?.authToken ?? ''}` },
      signal: controller.signal,
    }).then((response) => {
      if (!response.ok) throw new Error('Attachment unavailable');
      return response.blob();
    }).then((blob) => {
      if (active) setUrl(URL.createObjectURL(blob));
    }).catch(() => {
      if (active) setFailed(true);
    });
    return () => {
      active = false;
      controller.abort();
    };
  }, [attachment.objectPath]);

  if (failed) return <p className="mb-1 text-xs text-muted-foreground">Attachment unavailable</p>;
  if (!url) return <div className="mb-1 h-16 w-40 animate-pulse rounded-lg bg-black/10" aria-label="Loading attachment" />;
  if (attachment.type === 'image') return <img src={url} alt={attachment.name} className="mb-1 max-h-72 max-w-full rounded-lg object-cover" />;
  if (attachment.type === 'video') return <video src={url} controls className="mb-1 max-h-72 max-w-full rounded-lg" />;
  return <a href={url} download={attachment.name} className="mb-1 flex items-center gap-2 rounded-lg bg-black/5 px-3 py-2 text-sm font-semibold underline" data-testid={`link-attachment-${attachment.name}`}>{attachment.name}</a>;
}

export default function DirectChatPage() {
  const [, setLocation] = useLocation();
  const params = useParams<{ chatId: string }>();
  const queryClient = useQueryClient();
  const viewer = getStoredUser();
  const chatId = Number(params.chatId) || 0;
  const [draft, setDraft] = useState('');
  const [localMessages, setLocalMessages] = useState<Message[]>([]);
  const [attachmentOpen, setAttachmentOpen] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
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
  const requestUploadUrl = useRequestUploadUrl();
  const messages = messagesQuery.data ?? [];
  const chatName = contact?.name ?? directChat.data?.chat?.name;
  const allMessages = useMemo(() => [...messages, ...localMessages.filter((local) => !messages.some((item) => item.id === local.id))], [messages, localMessages]);

  useEffect(() => {
    if (!viewer) { setLocation('/'); return; }
    if (chatId && viewer.id) markRead.mutate({ chatId, data: { viewerId: viewer.id } }, { onSuccess: () => queryClient.setQueryData(getGetInboxQueryKey(viewer.id), (old: typeof inboxQuery.data) => old?.map((item) => item.chat.id === chatId ? { ...item, unreadCount: 0 } : item)) });
  }, [chatId, viewer?.id]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [allMessages.length]);

  if (!viewer) return null;
  const refreshMessages = () => {
    void queryClient.invalidateQueries({ queryKey: getListMessagesQueryKey(chatId, { viewerId: viewer.id }) });
    void queryClient.invalidateQueries({ queryKey: getGetInboxQueryKey(viewer.id) });
  };
  const selectFile = async (file: File, kind: 'media' | 'file') => {
    if (uploadingAttachment) return;
    const contentType = file.type.toLowerCase();
    const allowedMedia = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/quicktime', 'video/webm'];
    const allowedFiles = ['application/pdf', 'text/plain', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!(kind === 'media' ? allowedMedia : allowedFiles).includes(contentType)) {
      window.alert('This attachment type is not supported.');
      return;
    }
    setUploadingAttachment(true);
    setAttachmentOpen(false);
    try {
      const size = Math.max(1, file.size);
      const upload = await requestUploadUrl.mutateAsync({ data: { name: file.name, size, contentType } });
      const uploadUrl = new URL(upload.uploadURL, window.location.origin).toString();
      const response = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': contentType, Authorization: `Bearer ${getStoredUser()?.authToken ?? ''}` },
        body: file,
      });
      if (!response.ok) throw new Error('The upload did not finish.');
      const attachment: Attachment = {
        type: kind === 'media' ? (contentType.startsWith('video/') ? 'video' : 'image') : 'file',
        objectPath: upload.objectPath,
        name: file.name,
        mimeType: contentType,
        size,
      };
      await createMessage.mutateAsync({ chatId, data: { senderId: viewer.id, attachment } });
      refreshMessages();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Attachment could not be sent.');
    } finally {
      setUploadingAttachment(false);
    }
  };
  const shareLocation = () => {
    setAttachmentOpen(false);
    if (!navigator.geolocation) {
      window.alert('Location sharing is not supported by this browser.');
      return;
    }
    setUploadingAttachment(true);
    navigator.geolocation.getCurrentPosition((position) => {
      const { latitude, longitude } = position.coords;
      const mapUrl = `https://maps.google.com/?q=${latitude},${longitude}`;
      createMessage.mutate({ chatId, data: { senderId: viewer.id, content: `📍 My location: ${mapUrl}` } }, {
        onSuccess: refreshMessages,
        onError: () => window.alert('Location could not be sent.'),
        onSettled: () => setUploadingAttachment(false),
      });
    }, () => {
      setUploadingAttachment(false);
      window.alert('Location permission was denied or unavailable.');
    }, { enableHighAccuracy: false, timeout: 10000 });
  };
  const callContact = () => {
    if (contact?.phone) window.location.href = `tel:${contact.phone}`;
  };
  const addEmoji = (emoji: string) => {
    setDraft((current) => `${current}${emoji}`.slice(0, 2000));
    setEmojiOpen(false);
  };
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
        <div className="relative flex items-center gap-0.5"><IconButton label={`Call ${chatName ?? 'your contact'}`} onClick={callContact} disabled={!contact?.phone}><Phone size={18} /></IconButton><IconButton label="conversation-options" onClick={() => setActionsOpen((value) => !value)}><MoreVertical size={20} /></IconButton>{actionsOpen && <ChatActionMenu muted={muted} pinned={pinned} archived={archived} onToggle={toggleAction} />}</div>
      </header>
      {archived && <div className="flex items-center justify-center gap-2 bg-[#eeffde] px-4 py-2 text-xs font-semibold text-foreground"><span>Archived chat</span><button onClick={() => setArchived(false)} className="underline" data-testid="button-unarchive-banner">Restore</button></div>}
      <div className="min-h-0 flex-1 overflow-y-auto bg-[#e6ebee] px-3 py-5 sm:px-8"><div className="mx-auto max-w-2xl">{messagesQuery.isLoading ? <SkeletonRows count={5} /> : messagesQuery.isError ? <ErrorState message="Messages are taking a moment." onRetry={() => messagesQuery.refetch()} /> : allMessages.length === 0 ? <div className="flex min-h-[360px] flex-col items-center justify-center text-center" data-testid="status-empty-messages"><span className="mb-4 grid h-16 w-16 place-items-center rounded-full bg-white text-primary shadow-sm"><Paperclip size={25} /></span><h2 className="text-xl font-bold">No messages yet</h2><p className="mt-2 max-w-xs text-sm leading-6 text-muted-foreground">Send a message to start the conversation.</p></div> : <div className="space-y-5">{grouped.map((group) => <section key={group.day}><div className="mb-3 text-center"><span className="rounded-full bg-white/80 px-3 py-1 text-[10px] font-semibold text-muted-foreground shadow-sm">{group.day}</span></div><div className="space-y-1.5">{group.messages.map((message, index) => { const mine = message.senderId === viewer.id; return <div key={`${message.id}-${index}`} className={`flex animate-message-in ${mine ? 'justify-end' : 'justify-start'}`}><div className={`flex max-w-[86%] flex-col ${mine ? 'items-end' : 'items-start'}`}><div className={`relative rounded-2xl px-3.5 py-2 text-[15px] leading-6 shadow-sm ${mine ? 'rounded-tr-sm bg-[#eeffde] text-[#1b1b1b]' : 'rounded-tl-sm border border-border bg-white text-[#1b1b1b]'}`} data-testid={`text-message-${message.id}`}>{message.attachment && <MessageAttachment attachment={message.attachment} />}{message.content && <span>{message.content}</span>}<span className="ml-2 inline-flex translate-y-0.5 items-center gap-1 text-[10px] text-muted-foreground"><span>{displayTime(message.timestamp)}</span>{mine && <ReadMark read={message.read} />}</span></div></div></div>; })}</div></section>)}</div>}<div ref={bottomRef} /></div></div>
      <div className="shrink-0 border-t border-border bg-card px-3 py-2.5 sm:px-8"><form onSubmit={submitMessage} className="mx-auto flex max-w-2xl items-end gap-2" data-testid="form-send-message"><div className="relative flex min-w-0 flex-1 items-end rounded-2xl border border-border bg-background px-1.5"><div className="relative"><button type="button" onClick={() => setAttachmentOpen((value) => !value)} className="grid h-11 w-9 place-items-center text-muted-foreground hover:text-primary" aria-label="Add attachment" data-testid="button-add-attachment"><Paperclip size={19} /></button>{attachmentOpen && <AttachmentMenu onClose={() => setAttachmentOpen(false)} onSelectFile={(file, kind) => void selectFile(file, kind)} onSelectLocation={shareLocation} />}</div><textarea value={draft} onChange={(event) => setDraft(event.target.value.slice(0, 2000))} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} rows={1} placeholder="Message" className="max-h-32 min-h-11 flex-1 resize-none bg-transparent px-2 py-3 text-sm leading-5 outline-none placeholder:text-muted-foreground/65" aria-label="Message" data-testid="input-message" /><div className="relative"><button type="button" onClick={() => setEmojiOpen((value) => !value)} className="grid h-11 w-9 place-items-center text-muted-foreground hover:text-primary" aria-label="Add emoji" data-testid="button-add-sticker"><Smile size={18} /></button>{emojiOpen && <EmojiPicker onSelect={addEmoji} />}</div><button type="button" onClick={() => setAttachmentOpen(true)} className="grid h-11 w-9 place-items-center text-muted-foreground hover:text-primary" aria-label="Open photo picker" data-testid="button-add-photo"><ImagePlus size={18} /></button></div><SendButton disabled={!draft.trim() || uploadingAttachment} pending={createMessage.isPending || uploadingAttachment} /></form>{uploadingAttachment && <p className="mx-auto mt-1 max-w-2xl px-2 text-[10px] font-semibold uppercase tracking-wider text-primary">Preparing attachment…</p>}<div className="mx-auto mt-1 flex max-w-2xl items-center gap-1.5 px-2 text-[9px] uppercase tracking-wider text-muted-foreground/60"><Clock3 size={11} /> enter to send</div></div>
    </div>
  </ChatShell>;
}