import { Archive, ArrowLeft, Check, CheckCheck, ChevronDown, FilePlus2, ImagePlus, Menu, MessageCircle, MoreVertical, Paperclip, Phone, Plus, Search, Send, Settings, UsersRound, VolumeX } from 'lucide-react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Link, useLocation } from 'wouter';

export const initials = (name: string) => name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase();
const avatarTones = ['bg-[#ff9f43]', 'bg-[#ee5253]', 'bg-[#54a9eb]', 'bg-[#10ac84]', 'bg-[#8e44ad]', 'bg-[#ff6b81]', 'bg-[#2e86de]', 'bg-[#f7b731]'];

function toneForName(name: string) {
  return avatarTones[name.split('').reduce((total, char) => total + char.charCodeAt(0), 0) % avatarTones.length];
}

export function Avatar({ name, online = false, size = 'md' }: { name: string; online?: boolean; size?: 'sm' | 'md' | 'lg' }) {
  const sizeClass = size === 'lg' ? 'h-[72px] w-[72px] text-2xl' : size === 'sm' ? 'h-10 w-10 text-xs' : 'h-[50px] w-[50px] text-base';
  return <div className={`relative grid shrink-0 place-items-center rounded-full ${toneForName(name)} font-semibold text-white ${sizeClass}`} data-testid={`img-avatar-${name}`}>
    {initials(name)}
    {online && <span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-[3px] border-card bg-[#4dc24b]" aria-label="online" />}
  </div>;
}

export function BrandMark({ compact = false }: { compact?: boolean }) {
  return <Link href="/chats" className={`flex items-center gap-2.5 ${compact ? '' : 'group'}`} data-testid="link-brand">
    <img src="/telegram-icon.png" alt="" className="h-10 w-10 rounded-full shadow-sm transition-transform group-hover:-rotate-6" />
    {!compact && <span className="text-xl font-bold tracking-[-.04em]">Old Time<span className="text-primary">.</span></span>}
  </Link>;
}

export function IconButton({ label, children, className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; children: ReactNode }) {
  return <button {...props} type={props.type ?? 'button'} aria-label={label} title={label} className={`grid h-10 w-10 place-items-center rounded-full text-primary hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40 ${className}`} data-testid={`button-${label.toLowerCase().replaceAll(' ', '-')}`}>{children}</button>;
}

export function SectionLabel({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return <div className="mb-2 flex items-center justify-between"><p className="text-[13px] font-semibold text-muted-foreground">{children}</p>{action}</div>;
}

export function SkeletonRows({ count = 4 }: { count?: number }) {
  return <div className="space-y-0" aria-label="Loading conversations" data-testid="status-loading-conversations">{Array.from({ length: count }).map((_, index) => <div key={index} className="flex items-center gap-3 border-b border-border bg-card px-4 py-3"><div className="h-[50px] w-[50px] animate-pulse rounded-full bg-muted" /><div className="min-w-0 flex-1 space-y-2"><div className="h-3 w-2/5 animate-pulse rounded bg-muted" /><div className="h-3 w-4/5 animate-pulse rounded bg-muted" /></div></div>)}</div>;
}

export function ErrorState({ message = 'Something went quiet.', onRetry }: { message?: string; onRetry?: () => void }) {
  return <div className="mx-4 rounded-xl border border-accent/40 bg-accent/10 p-6 text-center" data-testid="status-error"><p className="text-lg font-bold">{message}</p><p className="mt-1 text-sm text-muted-foreground">Check your connection and try again.</p>{onRetry && <button onClick={onRetry} className="mt-4 rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground" data-testid="button-retry">Try again</button>}</div>;
}

export function EmptyState({ search = false }: { search?: boolean }) {
  return <div className="mx-4 flex min-h-[260px] flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card px-6 text-center" data-testid="status-empty"><span className="mb-4 grid h-14 w-14 place-items-center rounded-full bg-primary/10 text-primary"><MessageCircle size={25} /></span><h3 className="text-xl font-bold">{search ? 'No users found' : 'No chats yet'}</h3><p className="mt-1 max-w-xs text-sm leading-6 text-muted-foreground">{search ? 'Try a different name or number.' : 'Tap the compose button to start a new conversation.'}</p></div>;
}

export function ChatListItem({ name, preview, time, unread, online, active, chatId, onClick }: { name: string; preview: string; time: string; unread?: number; online?: boolean; active?: boolean; chatId?: number; onClick?: () => void }) {
  const content = <><Avatar name={name} online={online} /><span className="min-w-0 flex-1 text-left"><span className="flex items-baseline justify-between gap-3"><span className="truncate text-base font-semibold text-foreground">{name}</span><span className="shrink-0 text-xs text-muted-foreground">{time}</span></span><span className="mt-1 block truncate text-sm text-muted-foreground">{preview}</span></span>{unread ? <span className="grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">{unread}</span> : <span className="h-2 w-2 rounded-full bg-primary opacity-0 group-hover:opacity-100" />}</>;
  const className = `group flex w-full items-center gap-3 border-b border-border bg-card px-4 py-3 text-left transition-colors ${active ? 'bg-primary/5' : 'hover:bg-muted'}`;
  if (chatId !== undefined) return <Link href={`/chats/${chatId}`} onClick={onClick} className={className} data-testid={`link-chat-${chatId}`}>{content}</Link>;
  return <button onClick={onClick} className={className} data-testid={`button-contact-${name.replaceAll(' ', '-').toLowerCase()}`}>{content}</button>;
}

export type NavTab = 'chats' | 'updates' | 'communities' | 'calls';

export function ChatShell({ userName, children, activeTab = 'chats', onTabChange }: { userName: string; children: ReactNode; currentChatId?: number; activeTab?: NavTab; onTabChange?: (tab: NavTab) => void }) {
  const [, setLocation] = useLocation();
  const tabs: { id: NavTab; label: string; icon: typeof MessageCircle }[] = [
    { id: 'chats', label: 'Chats', icon: MessageCircle },
    { id: 'updates', label: 'Contacts', icon: UsersRound },
    { id: 'communities', label: 'Saved Messages', icon: Check },
    { id: 'calls', label: 'Settings', icon: Settings },
  ];
  const selectTab = (tab: NavTab) => { if (tab === 'chats') setLocation('/chats'); onTabChange?.(tab); };
  return <div className="flex min-h-[100dvh] flex-col bg-background md:flex-row">
    <aside className="hidden w-[280px] shrink-0 flex-col border-r border-border bg-card md:flex">
      <div className="flex h-[72px] items-center border-b border-border px-5"><BrandMark /></div>
      <div className="flex flex-1 flex-col">
        <div className="flex items-center gap-3 border-b border-border px-4 py-4"><Avatar name={userName} online /><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{userName}</span><span className="text-xs text-muted-foreground">online</span></span><MoreVertical size={18} className="text-muted-foreground" /></div>
        <nav className="p-2">{tabs.map(({ id, label, icon: Icon }) => <button key={id} onClick={() => selectTab(id)} className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-sm font-semibold ${activeTab === id ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`} data-testid={`button-tab-${id}`}><Icon size={18} />{label}{id === 'chats' && <span className="ml-auto rounded-full bg-primary px-2 py-0.5 text-[10px] text-primary-foreground">1</span>}</button>)}</nav>
      </div>
    </aside>
    <main className="min-w-0 flex-1 pb-0">{children}</main>
  </div>;
}

export function MobileTopbar({ back = false }: { back?: boolean }) {
  return <div className="flex h-[60px] items-center justify-between border-b border-border bg-card px-4 md:hidden">{back ? <Link href="/chats" className="flex items-center gap-2 text-sm font-semibold text-primary" data-testid="link-back-inbox"><ArrowLeft size={19} />Chats</Link> : <BrandMark />}{back ? <IconButton label="conversation-options"><MoreVertical size={19} /></IconButton> : <IconButton label="open-menu"><Menu size={20} /></IconButton>}</div>;
}

export function SearchField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return <label className="flex items-center gap-2 rounded-xl bg-muted px-4 py-2.5 text-muted-foreground focus-within:ring-2 focus-within:ring-primary/20" data-testid="label-search"><Search size={17} /><input type="search" value={value} onChange={(event) => onChange(event.target.value)} className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/70" placeholder="Search" aria-label="Search chats and contacts" data-testid="input-search-contacts" /></label>;
}

export function SendButton({ disabled, pending }: { disabled?: boolean; pending?: boolean }) {
  return <button type="submit" disabled={disabled} className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40" aria-label="Send message" data-testid="button-send-message">{pending ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" /> : <Send size={18} fill="currentColor" />}</button>;
}

export function ReadMark({ read }: { read: boolean }) {
  return <span className={read ? 'text-primary' : 'text-muted-foreground/60'} title={read ? 'Read' : 'Sent'} data-testid={read ? 'status-message-read' : 'status-message-sent'}><CheckCheck size={14} /></span>;
}

export function ContactIcon({ group = false }: { group?: boolean }) {
  return group ? <UsersRound size={17} /> : <Plus size={17} />;
}

export function AttachmentMenu({ onClose }: { onClose: () => void }) {
  return <div className="absolute bottom-14 left-0 z-20 w-52 rounded-xl border border-border bg-card p-2 shadow-[var(--shadow-md)] animate-page-in" data-testid="menu-attachments">
    <button onClick={() => { window.alert('Photo picker opened.'); onClose(); }} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold hover:bg-muted" data-testid="button-attach-photo"><span className="grid h-8 w-8 place-items-center rounded-full bg-primary/10 text-primary"><ImagePlus size={16} /></span>Photo or video</button>
    <button onClick={() => { window.alert('File picker opened.'); onClose(); }} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold hover:bg-muted" data-testid="button-attach-file"><span className="grid h-8 w-8 place-items-center rounded-full bg-accent/15 text-accent-foreground"><FilePlus2 size={16} /></span>Document</button>
    <button onClick={() => { window.alert('Location sharing is ready.'); onClose(); }} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold hover:bg-muted" data-testid="button-attach-location"><span className="grid h-8 w-8 place-items-center rounded-full bg-secondary text-primary"><MessageCircle size={16} /></span>Location</button>
  </div>;
}

export function ChatActionMenu({ muted, pinned, archived, onToggle }: { muted: boolean; pinned: boolean; archived: boolean; onToggle: (key: 'muted' | 'pinned' | 'archived') => void }) {
  return <div className="absolute right-0 top-12 z-30 w-48 rounded-xl border border-border bg-card p-2 shadow-[var(--shadow-md)] animate-page-in" data-testid="menu-chat-actions">
    <button onClick={() => onToggle('muted')} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm hover:bg-muted" data-testid="button-toggle-mute"><VolumeX size={16} />{muted ? 'Unmute' : 'Mute notifications'}</button>
    <button onClick={() => onToggle('pinned')} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm hover:bg-muted" data-testid="button-toggle-pin"><ChevronDown size={16} className={pinned ? 'rotate-180' : ''} />{pinned ? 'Unpin chat' : 'Pin chat'}</button>
    <button onClick={() => onToggle('archived')} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm hover:bg-muted" data-testid="button-toggle-archive"><Archive size={16} />{archived ? 'Unarchive' : 'Archive chat'}</button>
  </div>;
}