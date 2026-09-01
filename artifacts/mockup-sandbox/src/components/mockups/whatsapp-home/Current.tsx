import './_group.css';
import { Edit3, MoreVertical, Search, UserRound } from 'lucide-react';

const chats = [
  { name: 'Theo Vale', message: 'You still up for a walk sometime?', time: '9:41 PM', unread: 1, color: '#2e86de', online: false },
  { name: 'Mara Ellis', message: 'That sounds perfect. See you soon.', time: 'Yesterday', unread: 0, color: '#10ac84', online: true },
  { name: 'Weekend crew', message: 'Nina: I found the place.', time: 'Yesterday', unread: 4, color: '#8e44ad', online: false },
  { name: 'Jon Bell', message: 'Photo', time: 'Monday', unread: 0, color: '#f7b731', online: false },
];

function Avatar({ name, color, online }: { name: string; color: string; online?: boolean }) {
  const initials = name.split(' ').map((part) => part[0]).join('').slice(0, 2);
  return <span style={{ backgroundColor: color }} className="relative grid h-[50px] w-[50px] shrink-0 place-items-center rounded-full text-sm font-semibold text-white">
    {initials}
    {online && <span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-[3px] border-white bg-[#4dc24b]" />}
  </span>;
}

export function Current() {
  return <div className="min-h-screen bg-[hsl(var(--background))] p-0 sm:p-4">
    <div className="mx-auto flex min-h-screen max-w-[430px] flex-col overflow-hidden bg-[hsl(var(--card))] shadow-xl sm:min-h-[812px] sm:rounded-[18px]">
      <header className="border-b border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 pb-3 pt-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3"><img src="/__mockup/images/telegram-icon.png" alt="" className="h-10 w-10 rounded-full" /><span className="text-xl font-bold tracking-[-.04em]">Telegram<span className="text-[hsl(var(--primary))]">.</span></span></div>
          <div className="flex items-center gap-1 text-[hsl(var(--primary))]"><button className="grid h-10 w-10 place-items-center rounded-full hover:bg-[hsl(var(--muted))]" aria-label="New message"><Edit3 size={20} /></button><button className="grid h-10 w-10 place-items-center rounded-full hover:bg-[hsl(var(--muted))]" aria-label="Open profile"><UserRound size={19} /></button><button className="grid h-10 w-10 place-items-center rounded-full hover:bg-[hsl(var(--muted))]" aria-label="More options"><MoreVertical size={19} /></button></div>
        </div>
        <h1 className="mt-5 text-[28px] font-bold tracking-[-.06em]">Chats</h1>
        <label className="mt-3 flex items-center gap-2 rounded-xl bg-[hsl(var(--muted))] px-4 py-2.5 text-[hsl(var(--muted-foreground))]"><Search size={17} /><input className="w-full bg-transparent text-sm outline-none" placeholder="Search" aria-label="Search chats" /></label>
      </header>
      <main className="min-h-0 flex-1 overflow-y-auto bg-[hsl(var(--card))]">
        <div className="flex items-center justify-between border-b border-[hsl(var(--border))] px-4 py-3 text-[13px] font-semibold text-[hsl(var(--muted-foreground))]"><span>Recent chats</span><span className="rounded-full bg-[hsl(var(--primary))]/10 px-2 py-0.5 text-[10px] text-[hsl(var(--primary))]">4 active</span></div>
        {chats.map((chat) => <button key={chat.name} className="flex w-full items-center gap-3 border-b border-[hsl(var(--border))] px-4 py-3 text-left hover:bg-[hsl(var(--muted))]">
          <Avatar name={chat.name} color={chat.color} online={chat.online} />
          <span className="min-w-0 flex-1"><span className="flex items-baseline justify-between gap-3"><span className="truncate text-sm font-semibold">{chat.name}</span><span className="shrink-0 text-[10px] text-[hsl(var(--muted-foreground))]">{chat.time}</span></span><span className="mt-1 block truncate text-xs text-[hsl(var(--muted-foreground))]">{chat.message}</span></span>
          {chat.unread > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-[hsl(var(--primary))] px-1.5 text-[10px] font-bold text-white">{chat.unread}</span>}
        </button>)}
      </main>
      <button className="absolute bottom-24 right-[calc(50%-190px)] grid h-14 w-14 place-items-center rounded-full bg-[hsl(var(--primary))] text-white shadow-lg" aria-label="New message"><Edit3 size={22} /></button>
    </div>
  </div>;
}