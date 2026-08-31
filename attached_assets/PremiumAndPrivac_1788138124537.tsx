import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Clock, Lock, Check, X, ChevronRight, Database, Sparkles, ShieldCheck,
  Download, Users, Zap, Play, ExternalLink, Bookmark, Trash2, Cloud,
  CloudOff, ChevronLeft, Crown, Eye, EyeOff
} from "lucide-react";

const ACCENT = "#5B6EF5";
const TIERS = [
  { key: "24h", label: "24 Hours", sub: "Free default — starts when opened", premium: false },
  { key: "7d", label: "7 Days", sub: "Premium — starts when opened", premium: true },
  { key: "30d", label: "30 Days", sub: "Premium — starts when opened", premium: true },
  { key: "never", label: "Never", sub: "Premium — permanent history", premium: true },
];

function Section({ title, children }) {
  return (
    <div className="mb-6">
      {title && <div className="px-5 pb-1.5 text-[12.5px] font-semibold tracking-wide uppercase text-[#8E8E93]">{title}</div>}
      <div className="mx-3.5 rounded-[13px] overflow-hidden bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">{children}</div>
    </div>
  );
}
function IconBadge({ bg, children }) {
  return <div className="flex items-center justify-center rounded-[9px] shrink-0" style={{ width: 30, height: 30, background: bg }}>{children}</div>;
}

// ---------------- Live expiration demo ----------------

function ExpirationDemo() {
  const DEMO_MS = 14000;
  const [messages, setMessages] = useState([
    { id: 1, from: "Jay", text: "What's up?", viewedAt: null, saved: false, gone: false },
    { id: 2, from: "Priya", text: "Sending the file now", viewedAt: null, saved: false, gone: false },
  ]);
  useEffect(() => {
    const id = setInterval(() => {
      setMessages((ms) => ms.map((m) => {
        if (m.saved || m.gone || !m.viewedAt) return m;
        const remaining = DEMO_MS - (Date.now() - m.viewedAt);
        if (remaining <= 0) return { ...m, gone: true };
        return m;
      }));
    }, 200);
    return () => clearInterval(id);
  }, []);

  function view(id) { setMessages((ms) => ms.map((m) => (m.id === id && !m.viewedAt ? { ...m, viewedAt: Date.now() } : m))); }
  function save(id) { setMessages((ms) => ms.map((m) => (m.id === id ? { ...m, saved: true } : m))); }
  function reset() { setMessages([{ id: Date.now(), from: "Jay", text: "New test message", viewedAt: null, saved: false, gone: false }, ...messages.filter((m) => !m.gone)]); }

  return (
    <Section title="Live demo — expires after it's opened">
      <div className="px-3.5 py-3 bg-white border-b border-[#EAEAEE]">
        <p className="text-[12.5px] text-[#8E8E93] leading-snug">
          The timer only starts once the recipient actually opens a message — sitting unread in the inbox doesn't burn the clock. Tap a message below to "open" it and watch its 14s demo timer begin; Save stops the deletion at any point.
        </p>
      </div>
      <div className="divide-y divide-[#EAEAEE]">
        {messages.filter((m) => !m.gone).length === 0 && (
          <div className="px-3.5 py-4 text-center text-[13.5px] text-[#8E8E93]">All demo messages deleted from server. <button onClick={reset} className="font-medium" style={{ color: ACCENT }}>Send a new one</button></div>
        )}
        {messages.filter((m) => !m.gone).map((m) => {
          const remaining = m.viewedAt ? Math.max(0, DEMO_MS - (Date.now() - m.viewedAt)) : DEMO_MS;
          const secs = Math.ceil(remaining / 1000);
          const pct = remaining / DEMO_MS;
          return (
            <div key={m.id} className="px-3.5 py-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-[12px] font-semibold shrink-0" style={{ background: "linear-gradient(135deg,#4C63F5,#34C77E)" }}>{m.from[0]}</div>
              <div className="flex-1 min-w-0">
                <div className="text-[14.5px] text-[#1C1C1E] truncate" style={{ filter: m.viewedAt ? "none" : "blur(4px)" }}>{m.text}</div>
                <div className="text-[11.5px] text-[#8E8E93] flex items-center gap-1 mt-0.5">
                  {m.saved ? (
                    <><Bookmark size={11} style={{ color: "#34C77E" }} /> Saved — won't be deleted</>
                  ) : m.viewedAt ? (
                    <><Clock size={11} /> Opened — deletes from server in {secs}s</>
                  ) : (
                    <><EyeOff size={11} /> Delivered — not yet opened, timer hasn't started</>
                  )}
                </div>
                {m.viewedAt && !m.saved && (
                  <div className="h-1 rounded-full bg-[#EEEFF3] mt-1.5 overflow-hidden">
                    <div className="h-full transition-all" style={{ width: `${pct * 100}%`, background: pct < 0.3 ? "#F0537A" : ACCENT }} />
                  </div>
                )}
              </div>
              {!m.viewedAt && (
                <button onClick={() => view(m.id)} className="flex items-center gap-1 px-3 py-1.5 rounded-full text-[12.5px] font-medium shrink-0 text-white" style={{ background: ACCENT }}>
                  <Eye size={12} /> View
                </button>
              )}
              {m.viewedAt && !m.saved && (
                <button onClick={() => save(m.id)} className="px-3 py-1.5 rounded-full text-[12.5px] font-medium shrink-0" style={{ background: "#EEF0FF", color: ACCENT }}>Save</button>
              )}
            </div>
          );
        })}
      </div>
    </Section>
  );
}

// ---------------- Upsell modal ----------------

function UpsellModal({ onClose, onGoPremium }) {
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center px-8" style={{ background: "rgba(0,0,0,0.45)" }} onClick={onClose}>
      <div className="w-full bg-white rounded-2xl p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 mb-2">
          <Crown size={18} style={{ color: "#E8963C" }} />
          <span className="text-[16px] font-semibold text-[#1C1C1E]">Premium Feature</span>
        </div>
        <p className="text-[13.5px] text-[#6C7280] mb-4">Longer message history is a Premium feature — free accounts keep the 24-hour privacy default.</p>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-full text-[14px] font-medium bg-[#EEEFF3] text-[#1C1C1E]">Not Now</button>
          <button onClick={onGoPremium} className="flex-1 py-2.5 rounded-full text-[14px] font-semibold text-white" style={{ background: "linear-gradient(135deg,#E8963C,#5B6EF5)" }}>See Premium</button>
        </div>
      </div>
    </div>
  );
}

// ---------------- Expiration settings ----------------

function ExpirationSettings({ expiration, setExpiration, isPremium, onUpsell }) {
  return (
    <Section title="Message Expiration">
      {TIERS.map((t, i) => {
        const locked = t.premium && !isPremium;
        const active = expiration === t.key;
        return (
          <button
            key={t.key}
            onClick={() => (locked ? onUpsell() : setExpiration(t.key))}
            className="w-full flex items-center gap-3 px-3.5 py-3"
            style={{ borderBottom: i === TIERS.length - 1 ? "none" : "1px solid #EAEAEE", opacity: locked ? 0.55 : 1 }}
          >
            <IconBadge bg={active ? "#34C77E" : "#9A9AA0"}>
              {locked ? <Lock size={13} className="text-white" /> : <Clock size={14} className="text-white" />}
            </IconBadge>
            <div className="flex-1 text-left">
              <div className="text-[15.5px] text-[#1C1C1E]">{t.label}</div>
              <div className="text-[12px] text-[#8E8E93]">{t.sub}</div>
            </div>
            {active && !locked && <Check size={18} style={{ color: ACCENT }} />}
          </button>
        );
      })}
    </Section>
  );
}

// ---------------- Storage settings ----------------

function StorageSettings({ autoDelete, setAutoDelete, keepMediaCloud, setKeepMediaCloud, isPremium, onUpsell }) {
  const Toggle = ({ on, onClick }) => (
    <button onClick={onClick} className="w-[46px] h-[27px] rounded-full relative shrink-0" style={{ background: on ? "#34C759" : "#E9E9EB" }}>
      <span className="absolute top-[2px] left-[2px] w-[23px] h-[23px] bg-white rounded-full shadow transition-transform" style={{ transform: on ? "translateX(19px)" : "translateX(0)" }} />
    </button>
  );
  return (
    <Section title="Data & Storage">
      <div className="flex items-center gap-3 px-3.5 py-3 border-b border-[#EAEAEE]">
        <IconBadge bg="#34C77E"><Database size={14} className="text-white" /></IconBadge>
        <div className="flex-1">
          <div className="text-[15.5px] text-[#1C1C1E]">Auto-delete media after delivery</div>
          <div className="text-[12px] text-[#8E8E93]">Sender → temp cloud → recipient downloads → removed</div>
        </div>
        <Toggle on={autoDelete} onClick={() => setAutoDelete(!autoDelete)} />
      </div>
      <button
        onClick={() => (isPremium ? setKeepMediaCloud(!keepMediaCloud) : onUpsell())}
        className="w-full flex items-center gap-3 px-3.5 py-3"
        style={{ opacity: isPremium ? 1 : 0.55 }}
      >
        <IconBadge bg={isPremium ? "#5B6EF5" : "#9A9AA0"}>{isPremium ? <Cloud size={14} className="text-white" /> : <Lock size={13} className="text-white" />}</IconBadge>
        <div className="flex-1 text-left">
          <div className="text-[15.5px] text-[#1C1C1E]">Keep media in cloud</div>
          <div className="text-[12px] text-[#8E8E93]">Premium — access photos/videos on any device</div>
        </div>
        {isPremium && <Toggle on={keepMediaCloud} onClick={() => setKeepMediaCloud(!keepMediaCloud)} />}
      </button>
    </Section>
  );
}

// ---------------- Premium screen ----------------

function PremiumScreen({ isPremium, onSubscribe, onCancel }) {
  const FEATURES = [
    "Messages never expire (or set your own)",
    "Cloud message history across devices",
    "Cloud media storage",
    "No ads — anywhere in the app",
    "Larger groups & higher limits",
    "Premium Live room features",
  ];
  return (
    <Section title="Old Time Premium">
      <div className="px-4 py-6 flex flex-col items-center gap-2 border-b border-[#EAEAEE]">
        <Sparkles size={28} style={{ color: "#E8963C" }} />
        <div className="text-[19px] font-semibold text-[#1C1C1E]">{isPremium ? "You're Premium" : "$4.99/month"}</div>
        <div className="text-[13px] text-[#8E8E93] text-center px-4">
          {isPremium ? "Your messages, media, and history are stored — thanks for supporting Old Time." : "Free accounts stay lightweight for us and private for you — Premium adds permanence."}
        </div>
        <button
          onClick={isPremium ? onCancel : onSubscribe}
          className="mt-2 px-5 py-2.5 rounded-full text-white text-[15px] font-medium"
          style={{ background: isPremium ? "#6C7280" : "linear-gradient(135deg,#E8963C,#5B6EF5)" }}
        >
          {isPremium ? "Cancel Premium" : "Subscribe"}
        </button>
      </div>
      {FEATURES.map((f, i) => (
        <div key={f} className="px-3.5 py-3 flex items-center gap-3" style={{ borderBottom: i === FEATURES.length - 1 ? "none" : "1px solid #EAEAEE" }}>
          <Check size={16} style={{ color: isPremium ? "#34C77E" : "#C7C7CC" }} />
          <span className="text-[14.5px] text-[#1C1C1E]">{f}</span>
        </div>
      ))}
    </Section>
  );
}

// ---------------- Sponsored ad card (feed-native, watch-to-unlock) ----------------

function AdCard({ isPremium }) {
  const [open, setOpen] = useState(false);
  const [watched, setWatched] = useState(0);
  const REQUIRED = 10;
  const timerRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    timerRef.current = setInterval(() => setWatched((w) => Math.min(REQUIRED, w + 1)), 1000);
    return () => clearInterval(timerRef.current);
  }, [open]);

  const unlocked = watched >= REQUIRED;

  if (isPremium) {
    return (
      <Section title="Ad preview">
        <div className="px-4 py-6 text-center">
          <ShieldCheck size={22} style={{ color: "#34C77E" }} className="mx-auto mb-2" />
          <div className="text-[14.5px] text-[#1C1C1E] font-medium">Premium accounts see no ads</div>
          <div className="text-[12.5px] text-[#8E8E93] mt-1">This is what a free account's Updates feed looks like below.</div>
        </div>
      </Section>
    );
  }

  return (
    <Section title="Ad preview — as it appears in Updates">
      <div className="p-3.5">
        <div className="rounded-2xl overflow-hidden" style={{ background: "linear-gradient(135deg,#26A69A,#4C63F5)" }}>
          <div className="px-3.5 pt-3 flex items-center justify-between">
            <span className="text-white/80 text-[11px] font-semibold tracking-wide uppercase">Sponsored</span>
            <span className="text-white/60 text-[11px]">Brand X</span>
          </div>
          <div className="h-28 flex items-center justify-center">
            {!open ? (
              <button onClick={() => setOpen(true)} className="w-14 h-14 rounded-full bg-white/25 flex items-center justify-center">
                <Play size={22} className="text-white ml-0.5" fill="white" />
              </button>
            ) : (
              <div className="text-white text-center">
                <div className="text-[13px] font-medium mb-1">Playing ad…</div>
                <div className="w-32 h-1.5 bg-white/25 rounded-full overflow-hidden mx-auto">
                  <div className="h-full bg-white transition-all" style={{ width: `${(watched / REQUIRED) * 100}%` }} />
                </div>
              </div>
            )}
          </div>
          <div className="px-3.5 pb-3.5 flex items-center justify-between">
            <span className="text-white/70 text-[12px]">{open ? (unlocked ? "Offer unlocked" : `Watch ${REQUIRED - watched}s to unlock`) : "Tap to preview — normal scroll always available"}</span>
            <button
              disabled={!unlocked}
              onClick={() => unlocked && window.open("https://example.com", "_blank")}
              className="flex items-center gap-1 px-3 py-1.5 rounded-full text-[12px] font-semibold"
              style={{ background: unlocked ? "white" : "rgba(255,255,255,0.25)", color: unlocked ? "#26A69A" : "rgba(255,255,255,0.6)" }}
            >
              Get Offer {unlocked && <ExternalLink size={11} />}
            </button>
          </div>
        </div>
        <p className="text-[11.5px] text-[#8E8E93] mt-2 px-1">Users can always swipe past this card in the feed — the watch timer only gates the sponsor's CTA button when someone chooses to tap in, and never blocks scrolling.</p>
      </div>
    </Section>
  );
}

// ---------------- Main ----------------

const TABS = ["Expiration", "Storage", "Premium", "Ad Preview"];

export default function PremiumAndPrivacy() {
  const [tab, setTab] = useState("Expiration");
  const [isPremium, setIsPremium] = useState(false);
  const [expiration, setExpiration] = useState("24h");
  const [autoDelete, setAutoDelete] = useState(true);
  const [keepMediaCloud, setKeepMediaCloud] = useState(false);
  const [showUpsell, setShowUpsell] = useState(false);
  const [toast, setToast] = useState(null);
  const flash = (m) => { setToast(m); setTimeout(() => setToast(null), 1500); };

  function subscribe() {
    setIsPremium(true);
    setShowUpsell(false);
    flash("Welcome to Premium 🎉");
  }
  function cancel() {
    setIsPremium(false);
    setExpiration("24h");
    setKeepMediaCloud(false);
    flash("Premium canceled — reverted to free defaults");
  }

  return (
    <div className="w-full max-w-[430px] mx-auto h-[900px] relative overflow-hidden rounded-[28px] bg-[#F2F2F7] select-none">
      <div className="flex items-center justify-between px-4 pt-12 pb-3 bg-[#F9F9FB] border-b border-[#EAEAEE]">
        <span className="text-[19px] font-bold text-[#1C1C1E]">Data, Privacy & Premium</span>
        {isPremium && <span className="flex items-center gap-1 text-[11.5px] font-semibold px-2 py-1 rounded-full" style={{ background: "#FFF4E5", color: "#E8963C" }}><Crown size={11} /> Premium</span>}
      </div>

      <div className="flex gap-1 px-3.5 pt-3 pb-1 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)} className="px-3.5 py-1.5 rounded-full text-[13px] font-medium shrink-0" style={{ background: tab === t ? "#1C1C1E" : "#E9E9EE", color: tab === t ? "white" : "#1C1C1E" }}>
            {t}
          </button>
        ))}
      </div>

      <div className="overflow-y-auto pt-3" style={{ height: "calc(100% - 150px)" }}>
        {tab === "Expiration" && (
          <>
            <ExpirationSettings expiration={expiration} setExpiration={setExpiration} isPremium={isPremium} onUpsell={() => setShowUpsell(true)} />
            <ExpirationDemo />
          </>
        )}
        {tab === "Storage" && (
          <StorageSettings autoDelete={autoDelete} setAutoDelete={setAutoDelete} keepMediaCloud={keepMediaCloud} setKeepMediaCloud={setKeepMediaCloud} isPremium={isPremium} onUpsell={() => setShowUpsell(true)} />
        )}
        {tab === "Premium" && <PremiumScreen isPremium={isPremium} onSubscribe={subscribe} onCancel={cancel} />}
        {tab === "Ad Preview" && <AdCard isPremium={isPremium} />}
      </div>

      {showUpsell && (
        <UpsellModal onClose={() => setShowUpsell(false)} onGoPremium={() => { setShowUpsell(false); setTab("Premium"); }} />
      )}

      {toast && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white text-[13px] px-4 py-2 rounded-full z-50" style={{ background: "rgba(28,28,30,0.92)" }}>{toast}</div>
      )}
    </div>
  );
}
