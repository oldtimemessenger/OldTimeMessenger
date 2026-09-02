import { ArrowRight, Calendar, Check, LockKeyhole, Phone, RefreshCw, ShieldCheck } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { useLocation } from 'wouter';
import { useHealthCheck, useRequestOtp, useVerifyOtp } from '@workspace/api-client-react';
import type { AuthenticatedUser, BirthdayRequiredResponse } from '@workspace/api-client-react';
import { getStoredUser } from '@/lib/session';

function formatPhone(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 10);
  if (digits.length < 4) return digits;
  if (digits.length < 7) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

function formatBirthday(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  if (digits.length < 3) return digits;
  if (digits.length < 5) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

function birthdayToIso(value: string): string | null {
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;
  const [, month, day, year] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (date.getUTCFullYear() !== Number(year) || date.getUTCMonth() !== Number(month) - 1 || date.getUTCDate() !== Number(day) || date.getTime() > Date.now()) return null;
  return `${year}-${month}-${day}`;
}

export default function AuthPage() {
  const [location, setLocation] = useLocation();
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [challengeId, setChallengeId] = useState('');
  const [error, setError] = useState('');
  const [birthday, setBirthday] = useState('');
  const [birthdayUser, setBirthdayUser] = useState<BirthdayRequiredResponse | null>(null);
  const [savingBirthday, setSavingBirthday] = useState(false);
  const requestOtp = useRequestOtp();
  const verifyOtp = useVerifyOtp();
  const health = useHealthCheck();

  const storedUser = getStoredUser();
  useEffect(() => {
    if (!storedUser) {
      localStorage.removeItem('old-time-user');
      return;
    }
    if (location !== '/chats') setLocation('/chats');
  }, [location, setLocation, Boolean(storedUser)]);
  const submitPhone = (event: FormEvent) => { event.preventDefault(); setError(''); requestOtp.mutate({ data: { phone } }, { onSuccess: (result) => { setChallengeId(result.challengeId); setOtp(''); }, onError: () => setError('We could not send a code. Try again in a moment.') }); };
  const submitOtp = (event: FormEvent) => { event.preventDefault(); setError(''); verifyOtp.mutate({ data: { phone, otp, challengeId } }, { onSuccess: (user: AuthenticatedUser | BirthdayRequiredResponse) => { if ('requiresBirthday' in user) { setBirthday(''); setBirthdayUser(user); return; } localStorage.setItem('old-time-user', JSON.stringify(user)); setLocation('/chats'); }, onError: (verifyError) => setError(verifyError instanceof Error ? verifyError.message : 'That code is invalid or has expired. Try again.') }); };
  const submitBirthday = async (event: FormEvent) => {
    event.preventDefault();
    if (!birthdayUser) return;
    const isoBirthday = birthdayToIso(birthday);
    if (!isoBirthday) { setError('Enter a real birthday in MM/DD/YYYY format.'); return; }
    setSavingBirthday(true);
    setError('');
    try {
      const response = await fetch('/api/auth/complete-birthday', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ challengeId: birthdayUser.challengeId, birthday: isoBirthday }) });
      if (!response.ok) throw new Error('We could not save your birthday. Try again.');
      const updated = await response.json() as AuthenticatedUser;
      localStorage.setItem('old-time-user', JSON.stringify(updated));
      setLocation('/chats');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'We could not save your birthday. Try again.');
    } finally {
      setSavingBirthday(false);
    }
  };

  return <div className="min-h-[100dvh] bg-background">
    <div className="mx-auto flex min-h-[100dvh] max-w-[520px] flex-col bg-card shadow-sm lg:max-w-[1000px] lg:flex-row">
      <section className="relative flex min-h-[330px] flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-[#63bffb] to-[#3b8fd6] px-6 py-10 text-white lg:w-[46%] lg:min-h-0">
        <div className="absolute -right-16 top-10 h-48 w-48 rounded-full border-[28px] border-white/10" /><div className="absolute -bottom-28 -left-20 h-64 w-64 rounded-full bg-white/10" />
        <img src="/telegram-icon.png" alt="" className="relative h-[104px] w-[104px] rounded-full shadow-lg" />
        <h1 className="relative mt-6 text-3xl font-bold tracking-[-.05em]">Old Time<span className="text-[#eeffde]">.</span></h1>
        <p className="relative mt-2 text-sm text-white/80">Private conversations. Real connections.</p>
      </section>
      <section className="flex flex-1 items-center justify-center px-5 py-10 sm:px-10">
        <div className="w-full max-w-[380px] animate-page-in">
           <p className="text-xs font-semibold uppercase tracking-[.18em] text-muted-foreground">{birthdayUser ? 'One last step' : 'Welcome back'}</p><h2 className="mt-2 text-3xl font-bold tracking-[-.05em]">{birthdayUser ? 'Add your birthday.' : 'Sign in to chat.'}</h2>
            {birthdayUser ? <form onSubmit={submitBirthday} className="mt-8 space-y-5 animate-page-in" data-testid="form-birthday"><div><label htmlFor="birthday" className="mb-2 block text-sm font-semibold">Birthday</label><div className="flex items-center gap-3 rounded-xl border border-border bg-background px-4 py-3.5 focus-within:border-primary"><Calendar size={18} className="text-primary" /><input id="birthday" required inputMode="numeric" value={birthday} onChange={(event) => setBirthday(formatBirthday(event.target.value))} placeholder="MM/DD/YYYY" maxLength={10} className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground/55" data-testid="input-birthday" /></div><p className="mt-2 text-xs text-muted-foreground">Your birthday stays private and is never shown on your profile.</p></div><button type="submit" disabled={savingBirthday || !birthdayToIso(birthday)} className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3.5 text-sm font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-60" data-testid="button-save-birthday">{savingBirthday ? 'Saving...' : <>Continue <ArrowRight size={17} /></>}</button></form> : !challengeId ? <form onSubmit={submitPhone} className="mt-8 space-y-5" data-testid="form-request-otp"><div><label htmlFor="phone" className="mb-2 block text-sm font-semibold">Phone number</label><div className="flex items-center gap-3 rounded-xl border border-border bg-background px-4 py-3.5 focus-within:border-primary"><Phone size={18} className="text-primary" /><input id="phone" required minLength={7} value={phone} onChange={(event) => setPhone(formatPhone(event.target.value))} placeholder="(555) 014-2024" className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground/55" data-testid="input-phone" /></div><p className="mt-2 text-xs text-muted-foreground">We will text a verification code to this number.</p></div><button type="submit" disabled={requestOtp.isPending} className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3.5 text-sm font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-60" data-testid="button-request-otp">{requestOtp.isPending ? 'Sending code...' : <>Continue <ArrowRight size={17} /></>}</button></form> : <form onSubmit={submitOtp} className="mt-8 space-y-5 animate-page-in" data-testid="form-verify-otp"><div className="rounded-xl border border-primary/25 bg-primary/5 p-4"><div className="flex items-start gap-3"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground"><Check size={16} strokeWidth={3} /></span><div><p className="text-sm font-semibold">Code sent to {phone}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Enter the code from your SMS. It expires shortly.</p></div></div></div><div><label htmlFor="otp" className="mb-2 block text-sm font-semibold">Enter your code</label><input id="otp" required inputMode="numeric" pattern="[0-9]{4,10}" maxLength={6} autoFocus value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))} className="w-full rounded-xl border border-border bg-background px-4 py-4 text-center font-mono-app text-2xl tracking-[.55em] outline-none focus:border-primary" placeholder="000000" data-testid="input-otp" /></div><button type="submit" disabled={verifyOtp.isPending || otp.length < 4} className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3.5 text-sm font-bold text-primary-foreground disabled:opacity-60" data-testid="button-verify-otp">{verifyOtp.isPending ? 'Checking code...' : <>Open Old Time <ArrowRight size={17} /></>}</button><button type="button" onClick={() => { setChallengeId(''); setError(''); }} className="flex w-full items-center justify-center gap-2 py-2 text-xs font-semibold text-muted-foreground hover:text-primary" data-testid="button-change-number"><RefreshCw size={13} /> Use a different number</button></form>}
          {error && <p className="mt-5 rounded-lg bg-destructive/10 px-3 py-2 text-center text-sm text-destructive" data-testid="status-auth-error">{error}</p>}
          <div className="mt-12 border-t border-border pt-5"><div className="flex items-center gap-2 text-xs text-muted-foreground"><ShieldCheck size={15} className="text-[#4dc24b]" /> Private by default <span className="mx-1 text-border">/</span><span className={`h-1.5 w-1.5 rounded-full ${health.isError ? 'bg-destructive' : 'bg-[#4dc24b]'}`} /> {health.isError ? 'service resting' : 'service is awake'}</div><p className="mt-3 flex items-center gap-2 text-[11px] leading-5 text-muted-foreground/70"><LockKeyhole size={12} /> Your number is only used to sign you in.</p></div>
        </div>
      </section>
    </div>
  </div>;
}