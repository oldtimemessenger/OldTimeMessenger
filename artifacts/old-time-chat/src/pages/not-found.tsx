import { ArrowLeft, Compass } from 'lucide-react';
import { Link } from 'wouter';

export default function NotFound() {
  return <div className="flex min-h-[100dvh] items-center justify-center bg-background px-5"><div className="w-full max-w-md text-center animate-page-in"><div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-secondary text-primary"><Compass size={28} /></div><p className="mt-7 font-mono-app text-[10px] uppercase tracking-[.18em] text-muted-foreground">wrong turn</p><h1 className="mt-2 text-5xl font-bold tracking-[-.07em]">Nothing here.</h1><p className="mx-auto mt-3 max-w-xs text-sm leading-6 text-muted-foreground">That page does not exist, but your conversations are waiting.</p><Link href="/chats" className="mx-auto mt-7 flex w-fit items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-bold text-primary-foreground" data-testid="link-back-to-chats"><ArrowLeft size={16} /> Back to chats</Link></div></div>;
}