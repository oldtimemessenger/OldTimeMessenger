import './_group.css';
import { ArrowLeft, CheckCheck, ImagePlus, MoreVertical, Paperclip, Phone, Send, Smile } from 'lucide-react';

const messages = [
  { text: 'Hey! Are we still on for tonight?', time: '9:38 PM', mine: false },
  { text: 'Absolutely. I found a quiet place near the park.', time: '9:39 PM', mine: true },
  { text: 'Perfect. See you soon.', time: '9:41 PM', mine: false },
];

export function WhatsAppHome() {
  return <div className="min-h-screen bg-[hsl(var(--background))] p-0 sm:p-4">
    <div className="mx-auto flex min-h-screen max-w-[430px] flex-col overflow-hidden bg-[#e6ebee] shadow-xl sm:min-h-[812px] sm:rounded-[18px]">
      <header className="flex h-[68px] shrink-0 items-center justify-between border-b border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3">
        <div className="flex items-center gap-2.5"><button className="grid h-10 w-10 place-items-center rounded-full text-[hsl(var(--primary))]" aria-label="Back to chats"><ArrowLeft size={21} /></button><div className="grid h-[50px] w-[50px] place-items-center rounded-full bg-[#10ac84] text-sm font-semibold text-white">ME<span className="absolute ml-8 mt-8 h-3.5 w-3.5 rounded-full border-[3px] border-white bg-[#4dc24b]" /></div><div><h1 className="text-base font-bold">Mara Ellis</h1><p className="text-xs text-[hsl(var(--muted-foreground))]">online</p></div></div>
        <div className="flex items-center gap-1 text-[hsl(var(--primary))]"><button className="grid h-10 w-10 place-items-center rounded-full" aria-label="Call"><Phone size={18} /></button><button className="grid h-10 w-10 place-items-center rounded-full" aria-label="More options"><MoreVertical size={20} /></button></div>
      </header>
      <main className="min-h-0 flex-1 overflow-y-auto px-3 py-5">
        <div className="mb-4 text-center"><span className="rounded-full bg-white/80 px-3 py-1 text-[10px] font-semibold text-[hsl(var(--muted-foreground))]">Today</span></div>
        <div className="space-y-2">
          {messages.map((message) => <div key={message.text} className={`flex ${message.mine ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[82%] rounded-2xl px-3.5 py-2 text-[15px] leading-6 shadow-sm ${message.mine ? 'rounded-tr-sm bg-[#eeffde] text-[#1b1b1b]' : 'rounded-tl-sm border border-[hsl(var(--border))] bg-white text-[#1b1b1b]'}`}>{message.text}<span className="ml-2 inline-flex items-center gap-1 text-[10px] text-[hsl(var(--muted-foreground))]">{message.time}{message.mine && <CheckCheck size={14} className="text-[hsl(var(--primary))]" />}</span></div></div>)}
        </div>
      </main>
      <div className="shrink-0 border-t border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2.5"><div className="flex items-end gap-2"><div className="flex min-w-0 flex-1 items-end rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-1.5"><button className="grid h-11 w-9 place-items-center text-[hsl(var(--muted-foreground))]" aria-label="Add attachment"><Paperclip size={19} /></button><span className="flex-1 px-2 py-3 text-sm text-[hsl(var(--muted-foreground))]">Message</span><button className="grid h-11 w-9 place-items-center text-[hsl(var(--muted-foreground))]" aria-label="Add sticker"><Smile size={18} /></button><button className="grid h-11 w-9 place-items-center text-[hsl(var(--muted-foreground))]" aria-label="Add photo"><ImagePlus size={18} /></button></div><button className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[hsl(var(--primary))] text-white" aria-label="Send"><Send size={18} fill="currentColor" /></button></div></div>
    </div>
  </div>;
}