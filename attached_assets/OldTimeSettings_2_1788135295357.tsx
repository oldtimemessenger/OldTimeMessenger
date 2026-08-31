import React, { useState, useMemo, createContext, useContext, useRef, useEffect } from "react";
import {
  Bell, Lock, Database, Circle, BatteryCharging, Globe, Star, Store, Gift,
  MessageCircle, HelpCircle, Lightbulb, User, Wallet, Bookmark, Phone,
  Smartphone, Folder, ChevronRight, Search, QrCode, Pencil, X, Check,
  UserCircle2, MessageSquare, UserPlus, Download, ShieldCheck,
  Users, PhoneCall, Settings as SettingsIcon, Camera, AtSign,
  ChevronLeft, PhoneIncoming, PhoneOutgoing, PhoneMissed, Trash2, LogOut,
  Plus, Copy, RefreshCw, Laptop, Monitor, PlusCircle, Minus, ChevronDown,
  Zap, Clock, MessageSquareText, Coffee, Send, ShieldAlert, Sparkles
} from "lucide-react";

// ---------------- Theme ----------------

const ACCENTS = {
  indigo: "#5B6EF5",
  teal: "#26A69A",
  rose: "#F0537A",
  amber: "#E8963C",
  violet: "#8B5CF6",
  classic: "#3390EC",
};

const ThemeCtx = createContext(null);
function useTheme() { return useContext(ThemeCtx); }

function palette(dark) {
  return {
    bg: dark ? "#000000" : "#F2F2F7",
    headerBg: dark ? "#0C0C0E" : "#F9F9FB",
    card: dark ? "#1C1C1E" : "#FFFFFF",
    cardPress: dark ? "#2A2A2C" : "#ECECF0",
    border: dark ? "#2C2C2E" : "#EAEAEE",
    text: dark ? "#FFFFFF" : "#1C1C1E",
    sub: dark ? "#98989F" : "#8E8E93",
    chip: dark ? "#2C2C2E" : "#E9E9EE",
  };
}

// ---------------- Primitives ----------------

function IconBadge({ bg, children }) {
  return (
    <div className="flex items-center justify-center rounded-[9px] shrink-0" style={{ width: 30, height: 30, background: bg }}>
      {children}
    </div>
  );
}

function Row({ icon, bg, label, value, badge, danger, onClick, isLast }) {
  const t = useTheme();
  const c = palette(t.dark);
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-3.5 py-2.5 text-left transition-colors"
      style={{ background: c.card, borderBottom: isLast ? "none" : `1px solid ${c.border}` }}
      onMouseDown={(e) => (e.currentTarget.style.background = c.cardPress)}
      onMouseUp={(e) => (e.currentTarget.style.background = c.card)}
      onMouseLeave={(e) => (e.currentTarget.style.background = c.card)}
    >
      <IconBadge bg={bg}>{icon}</IconBadge>
      <span className="flex-1 text-[16.5px]" style={{ color: danger ? "#FF453A" : c.text }}>{label}</span>
      {badge && (
        <span className="text-[11px] font-semibold text-white rounded-full px-1.5 py-0.5" style={{ background: t.accent }}>
          {badge}
        </span>
      )}
      {value && <span className="text-[15.5px]" style={{ color: c.sub }}>{value}</span>}
      {!danger && <ChevronRight size={17} strokeWidth={2.5} style={{ color: t.dark ? "#5A5A5E" : "#C7C7CC" }} />}
    </button>
  );
}

function Section({ children, title }) {
  const t = useTheme();
  const c = palette(t.dark);
  return (
    <div className="mb-6">
      {title && <div className="px-5 pb-1.5 text-[12.5px] font-semibold tracking-wide uppercase" style={{ color: c.sub }}>{title}</div>}
      <div className="mx-3.5 rounded-[13px] overflow-hidden" style={{ boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}>
        {children}
      </div>
    </div>
  );
}

function ToggleSwitch({ on, onChange }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onChange(!on); }}
      className="w-[46px] h-[27px] rounded-full relative shrink-0 transition-colors"
      style={{ background: on ? "#34C759" : "#78788029" }}
    >
      <span className="absolute top-[2px] left-[2px] w-[23px] h-[23px] bg-white rounded-full shadow transition-transform" style={{ transform: on ? "translateX(19px)" : "translateX(0)" }} />
    </button>
  );
}

function ToggleRow({ label, sub, on, onChange, isLast, icon, bg }) {
  const t = useTheme();
  const c = palette(t.dark);
  return (
    <div className="w-full flex items-center gap-3 px-3.5 py-3" style={{ background: c.card, borderBottom: isLast ? "none" : `1px solid ${c.border}` }}>
      {icon && <IconBadge bg={bg}>{icon}</IconBadge>}
      <div className="flex-1">
        <div className="text-[16.5px]" style={{ color: c.text }}>{label}</div>
        {sub && <div className="text-[13px] mt-0.5" style={{ color: c.sub }}>{sub}</div>}
      </div>
      <ToggleSwitch on={on} onChange={onChange} />
    </div>
  );
}

function ActionRow({ label, sub, onClick, isLast, right, textColor }) {
  const t = useTheme();
  const c = palette(t.dark);
  return (
    <button onClick={onClick} className="w-full flex items-center gap-3 px-3.5 py-3 text-left" style={{ background: c.card, borderBottom: isLast ? "none" : `1px solid ${c.border}` }}>
      <div className="flex-1">
        <div className="text-[16px]" style={{ color: textColor || t.accent }}>{label}</div>
        {sub && <div className="text-[13px] mt-0.5" style={{ color: c.sub }}>{sub}</div>}
      </div>
      {right}
    </button>
  );
}

function DetailShell({ title, onBack, children, rightAction }) {
  const t = useTheme();
  const c = palette(t.dark);
  return (
    <div className="absolute inset-0 flex flex-col z-20" style={{ background: c.bg }}>
      <div className="flex items-center justify-between gap-1 px-2 pt-14 pb-2" style={{ background: c.headerBg, borderBottom: `1px solid ${c.border}` }}>
        <button onClick={onBack} className="flex items-center px-1 py-1" style={{ color: t.accent }}>
          <ChevronLeft size={26} />
          <span className="text-[17px] -ml-1">Back</span>
        </button>
        {rightAction}
      </div>
      <div className="px-3.5 pt-2 pb-1">
        <h1 className="text-[28px] font-bold px-1" style={{ color: c.text }}>{title}</h1>
      </div>
      <div className="flex-1 overflow-y-auto pb-8">{children}</div>
    </div>
  );
}

function Accordion({ items, openIndex, setOpenIndex }) {
  const t = useTheme();
  const c = palette(t.dark);
  return (
    <Section>
      {items.map((it, i) => (
        <div key={i} style={{ borderBottom: i === items.length - 1 ? "none" : `1px solid ${c.border}`, background: c.card }}>
          <button onClick={() => setOpenIndex(openIndex === i ? -1 : i)} className="w-full flex items-center justify-between gap-3 px-3.5 py-3 text-left">
            <span className="text-[15.5px] font-medium" style={{ color: c.text }}>{it.q}</span>
            <ChevronDown size={17} style={{ color: c.sub, transform: openIndex === i ? "rotate(180deg)" : "none", transition: "transform .15s" }} />
          </button>
          {openIndex === i && <div className="px-3.5 pb-3 text-[14px] leading-5" style={{ color: c.sub }}>{it.a}</div>}
        </div>
      ))}
    </Section>
  );
}

// ---------------- Main ----------------

const TABS = ["Contacts", "Calls", "Chats", "Settings", "Search"];

export default function OldTimeSettings() {
  const [dark, setDark] = useState(false);
  const [accentKey, setAccentKey] = useState("indigo");
  const accent = ACCENTS[accentKey];
  const c = palette(dark);

  const [activeTab, setActiveTab] = useState("Settings");
  const [query, setQuery] = useState("");
  const [openPanel, setOpenPanel] = useState(null);

  // Profile
  const [name, setName] = useState("King Castani");
  const [draftName, setDraftName] = useState(name);
  const [editingProfile, setEditingProfile] = useState(false);
  const [username, setUsername] = useState("");
  const [editingUsername, setEditingUsername] = useState(false);
  const [draftUsername, setDraftUsername] = useState("");

  // Notifications
  const [notif, setNotif] = useState({ msg: true, group: true, sound: true, vibrate: false, preview: true });

  // Privacy
  const [privacy, setPrivacy] = useState({ lastSeen: true, readReceipts: true, e2e: true, addToGroups: false });
  const [blocked, setBlocked] = useState(["+1 555 019 2231", "spam_bot_44"]);

  // Storage
  const [autoDownload, setAutoDownload] = useState(true);
  const [wifiOnly, setWifiOnly] = useState(false);
  const [cacheGB, setCacheGB] = useState(1.2);

  // Appearance handled by dark/accent above; wallpaper
  const [wallpaper, setWallpaper] = useState(0);

  // Power saving
  const [lowPower, setLowPower] = useState(false);
  const [autoLowPower, setAutoLowPower] = useState(true);

  // Language
  const [language, setLanguage] = useState("English");
  const LANGS = ["English", "Español", "Français", "Deutsch", "Português", "العربية", "हिन्दी", "中文"];

  // Wallet
  const [balance, setBalance] = useState(48.5);
  const [walletTx, setWalletTx] = useState([{ label: "Added funds", amt: 25, t: "Aug 12" }, { label: "Gift sent", amt: -5, t: "Aug 9" }]);

  // Saved messages
  const [saved, setSaved] = useState([{ text: "Pick up dry cleaning", t: "Yesterday" }, { text: "Recipe: garlic butter shrimp", t: "Mon" }]);
  const [savedInput, setSavedInput] = useState("");

  // Recent calls
  const [calls, setCalls] = useState([
    { name: "Maya R.", type: "in", time: "10:42 AM", dur: "4:12" },
    { name: "Delivery Support", type: "missed", time: "Yesterday", dur: "" },
    { name: "Theo K.", type: "out", time: "Mon", dur: "1:05" },
  ]);

  // Devices
  const [devices, setDevices] = useState([
    { name: "This iPhone", loc: "Miami, FL", current: true },
    { name: "MacBook Pro", loc: "Miami, FL", current: false },
    { name: "iPad Air", loc: "Orlando, FL", current: false },
  ]);

  // Folders
  const [folders, setFolders] = useState([{ name: "All Chats", count: 109 }, { name: "Personal", count: 18 }, { name: "Work", count: 7 }]);
  const [newFolder, setNewFolder] = useState("");

  // Premium / Stars / Business
  const [premium, setPremium] = useState(false);
  const [stars, setStars] = useState(120);
  const [biz, setBiz] = useState({ quickReplies: true, greeting: false, away: false, hours: true });

  // Gifts
  const GIFTS = [{ id: "rose", label: "Rose", cost: 5 }, { id: "cake", label: "Cake", cost: 15 }, { id: "trophy", label: "Trophy", cost: 30 }, { id: "diamond", label: "Diamond", cost: 60 }];
  const [giftSentMsg, setGiftSentMsg] = useState("");

  // Account
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  // Chats prefs
  const [chatPrefs, setChatPrefs] = useState({ enterToSend: true, autoplay: true, swipeReply: true });
  const [fontSize, setFontSize] = useState(16);

  // Invite
  const inviteCode = "OLDTIME-KC4471";
  const [copied, setCopied] = useState(false);
  const [invited, setInvited] = useState(3);

  // Updates
  const [updateStatus, setUpdateStatus] = useState("idle");

  // Ask a question
  const [askMsgs, setAskMsgs] = useState([{ from: "support", text: "Hi! Ask us anything about Old Time." }]);
  const [askInput, setAskInput] = useState("");

  // FAQ / Features accordions
  const [faqOpen, setFaqOpen] = useState(-1);
  const [featOpen, setFeatOpen] = useState(-1);

  // Logout
  const [logoutConfirm, setLogoutConfirm] = useState(false);
  const [loggedOut, setLoggedOut] = useState(false);

  const [toast, setToast] = useState(null);
  const flash = (msg) => { setToast(msg); setTimeout(() => setToast(null), 1300); };

  const groups = useMemo(() => ([
    { items: [
      { key: "profile", icon: <User size={17} className="text-white" strokeWidth={2.5} />, bg: "#FF7A59", label: "My Profile" },
      { key: "wallet", icon: <Wallet size={16} className="text-white" strokeWidth={2.5} />, bg: "#4C63F5", label: "Wallet", value: `$${balance.toFixed(2)}` },
    ]},
    { items: [
      { key: "saved", icon: <Bookmark size={16} className="text-white" strokeWidth={2.5} />, bg: "#4C9CF5", label: "Saved Messages", value: String(saved.length) },
      { key: "calls", icon: <Phone size={16} className="text-white" strokeWidth={2.5} />, bg: "#34C77E", label: "Recent Calls" },
      { key: "devices", icon: <Smartphone size={16} className="text-white" strokeWidth={2.5} />, bg: "#F0A23C", label: "Devices", value: `${devices.length} active` },
      { key: "folders", icon: <Folder size={16} className="text-white" strokeWidth={2.5} />, bg: "#4C9CF5", label: "Chat Folders", value: String(folders.length) },
    ]},
    { items: [
      { key: "notifications", icon: <Bell size={16} className="text-white" strokeWidth={2.5} fill="white" />, bg: "#F0537A", label: "Notifications and Sounds" },
      { key: "privacy", icon: <Lock size={15} className="text-white" strokeWidth={2.5} />, bg: "#6C7280", label: "Privacy and Security" },
      { key: "storage", icon: <Database size={15} className="text-white" strokeWidth={2.5} />, bg: "#34C77E", label: "Data and Storage", value: `${cacheGB.toFixed(1)} GB` },
      { key: "appearance", icon: <Circle size={15} className="text-white" strokeWidth={2.5} fill="white" />, bg: "#26A69A", label: "Appearance" },
      { key: "power", icon: <BatteryCharging size={16} className="text-white" strokeWidth={2.5} />, bg: "#E8963C", label: "Power Saving", value: lowPower ? "On" : "Off" },
      { key: "language", icon: <Globe size={16} className="text-white" strokeWidth={2.5} />, bg: "#8B5CF6", label: "Language", value: language },
    ]},
    { title: "old time+", items: [
      { key: "premium", icon: <Star size={15} className="text-white" strokeWidth={2.5} fill="white" />, bg: "linear-gradient(135deg,#E8963C,#F0537A)", label: "Old Time Premium", value: premium ? "Active" : "" },
      { key: "stars", icon: <Star size={15} className="text-white" strokeWidth={2.5} />, bg: "#E8963C", label: "My Stars", value: String(stars) },
      { key: "business", icon: <Store size={15} className="text-white" strokeWidth={2.5} />, bg: "linear-gradient(135deg,#8B5CF6,#F0537A)", label: "Business Tools" },
      { key: "gift", icon: <Gift size={16} className="text-white" strokeWidth={2.5} />, bg: "linear-gradient(135deg,#34C77E,#26A69A)", label: "Send a Gift" },
    ]},
    { title: "chats & connections", items: [
      { key: "account", icon: <UserCircle2 size={16} className="text-white" strokeWidth={2.5} />, bg: "#34C77E", label: "Account" },
      { key: "chatSettings", icon: <MessageSquare size={15} className="text-white" strokeWidth={2.5} fill="white" />, bg: "#26A69A", label: "Chats" },
      { key: "invite", icon: <UserPlus size={16} className="text-white" strokeWidth={2.5} />, bg: "#4C63F5", label: "Invite a Friend", value: `${invited} joined` },
      { key: "updates", icon: <Download size={16} className="text-white" strokeWidth={2.5} />, bg: "#6C7280", label: "App Updates", value: updateStatus === "uptodate" ? "Up to date" : "v3.2.1" },
    ]},
    { items: [
      { key: "ask", icon: <MessageCircle size={16} className="text-white" strokeWidth={2.5} fill="white" />, bg: "#E8963C", label: "Ask a Question" },
      { key: "faq", icon: <HelpCircle size={16} className="text-white" strokeWidth={2.5} />, bg: "#26A69A", label: "Old Time FAQ" },
      { key: "features", icon: <Lightbulb size={16} className="text-white" strokeWidth={2.5} fill="white" />, bg: "#E8C33C", label: "Old Time Features" },
    ]},
    { items: [
      { key: "logout", icon: <LogOut size={16} className="text-white" strokeWidth={2.5} />, bg: "#F0537A", label: "Log Out", danger: true },
    ]},
  ]), [balance, saved.length, devices.length, folders.length, cacheGB, lowPower, language, premium, stars, invited, updateStatus]);

  const filteredGroups = useMemo(() => {
    if (!query.trim()) return groups;
    const q = query.toLowerCase();
    return groups.map((g) => ({ ...g, items: g.items.filter((i) => i.label.toLowerCase().includes(q)) })).filter((g) => g.items.length > 0);
  }, [groups, query]);

  function copyInvite() {
    setCopied(true);
    flash("Invite code copied");
    setTimeout(() => setCopied(false), 1500);
  }

  function checkUpdates() {
    setUpdateStatus("checking");
    setTimeout(() => setUpdateStatus("uptodate"), 1100);
  }

  function sendAsk() {
    if (!askInput.trim()) return;
    const msg = askInput.trim();
    setAskMsgs((m) => [...m, { from: "me", text: msg }]);
    setAskInput("");
    setTimeout(() => setAskMsgs((m) => [...m, { from: "support", text: "Thanks — a specialist will follow up in your Saved Messages shortly." }]), 700);
  }

  function addSaved() {
    if (!savedInput.trim()) return;
    setSaved((s) => [{ text: savedInput.trim(), t: "Just now" }, ...s]);
    setSavedInput("");
  }

  function sendGift(g) {
    if (stars < g.cost) { flash("Not enough Stars"); return; }
    setStars((s) => s - g.cost);
    setGiftSentMsg(`${g.label} sent 🎉`);
    setTimeout(() => setGiftSentMsg(""), 1500);
  }

  function addFolder() {
    if (!newFolder.trim()) return;
    setFolders((f) => [...f, { name: newFolder.trim(), count: 0 }]);
    setNewFolder("");
  }

  // -------- Panels --------
  function renderPanel() {
    switch (openPanel) {

      case "profile":
        return (
          <DetailShell title="Edit Profile" onBack={() => setOpenPanel(null)}>
            <Section>
              <div className="flex flex-col items-center py-6 gap-3" style={{ background: c.card }}>
                <div className="relative">
                  <div className="w-24 h-24 rounded-full flex items-center justify-center text-white text-3xl font-semibold" style={{ background: `linear-gradient(135deg, ${accent}, #34C77E)` }}>KC</div>
                  <div className="absolute bottom-0 right-0 rounded-full p-2 border-2" style={{ background: accent, borderColor: c.card }}>
                    <Camera size={14} className="text-white" />
                  </div>
                </div>
                {editingProfile ? (
                  <div className="flex items-center gap-2 w-full px-8">
                    <input autoFocus value={draftName} onChange={(e) => setDraftName(e.target.value)}
                      className="flex-1 text-center text-[19px] font-semibold border-b-2 outline-none py-1 bg-transparent"
                      style={{ borderColor: accent, color: c.text }} />
                    <button onClick={() => { setName(draftName || name); setEditingProfile(false); }} style={{ color: accent }}><Check size={22} /></button>
                    <button onClick={() => { setDraftName(name); setEditingProfile(false); }} style={{ color: c.sub }}><X size={22} /></button>
                  </div>
                ) : (
                  <button onClick={() => setEditingProfile(true)} className="flex items-center gap-1.5 text-[19px] font-semibold" style={{ color: c.text }}>
                    {name} <Pencil size={14} style={{ color: c.sub }} />
                  </button>
                )}
                <div className="text-[15px]" style={{ color: c.sub }}>+1 786 910 0502</div>
              </div>
            </Section>
            <Section>
              <div className="px-3.5 py-3 flex items-center gap-3" style={{ background: c.card, borderBottom: `1px solid ${c.border}` }}>
                <IconBadge bg="#4C9CF5"><Camera size={15} className="text-white" /></IconBadge>
                <span className="flex-1 text-[16px]" style={{ color: c.text }}>Set Profile Photo</span>
                <button onClick={() => flash("Photo updated")} className="text-[14px] font-medium" style={{ color: accent }}>Choose</button>
              </div>
              <div className="px-3.5 py-3 flex items-center gap-3" style={{ background: c.card }}>
                <IconBadge bg="#8B5CF6"><AtSign size={15} className="text-white" /></IconBadge>
                {editingUsername ? (
                  <>
                    <input autoFocus value={draftUsername} onChange={(e) => setDraftUsername(e.target.value)} placeholder="username"
                      className="flex-1 text-[16px] outline-none bg-transparent" style={{ color: c.text }} />
                    <button onClick={() => { setUsername(draftUsername); setEditingUsername(false); }} style={{ color: accent }}><Check size={20} /></button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 text-[16px]" style={{ color: c.text }}>{username ? `@${username}` : "Set Username"}</span>
                    <button onClick={() => { setDraftUsername(username); setEditingUsername(true); }} className="text-[14px] font-medium" style={{ color: accent }}>Edit</button>
                  </>
                )}
              </div>
            </Section>
          </DetailShell>
        );

      case "notifications":
        return (
          <DetailShell title="Notifications" onBack={() => setOpenPanel(null)}>
            <Section title="Messages">
              <ToggleRow label="Message Notifications" on={notif.msg} onChange={(v) => setNotif((s) => ({ ...s, msg: v }))} />
              <ToggleRow label="Show Preview" on={notif.preview} onChange={(v) => setNotif((s) => ({ ...s, preview: v }))} isLast />
            </Section>
            <Section title="Groups">
              <ToggleRow label="Group Notifications" on={notif.group} onChange={(v) => setNotif((s) => ({ ...s, group: v }))} isLast />
            </Section>
            <Section title="Sound">
              <ToggleRow label="Sound" on={notif.sound} onChange={(v) => setNotif((s) => ({ ...s, sound: v }))} />
              <ToggleRow label="Vibrate" on={notif.vibrate} onChange={(v) => setNotif((s) => ({ ...s, vibrate: v }))} isLast />
            </Section>
          </DetailShell>
        );

      case "privacy":
        return (
          <DetailShell title="Privacy and Security" onBack={() => setOpenPanel(null)}>
            <Section title="Visibility">
              <ToggleRow label="Last Seen & Online" sub="Who can see when you're online" on={privacy.lastSeen} onChange={(v) => setPrivacy((s) => ({ ...s, lastSeen: v }))} />
              <ToggleRow label="Read Receipts" sub="Show blue checkmarks" on={privacy.readReceipts} onChange={(v) => setPrivacy((s) => ({ ...s, readReceipts: v }))} />
              <ToggleRow label="Allow Group Invites" on={privacy.addToGroups} onChange={(v) => setPrivacy((s) => ({ ...s, addToGroups: v }))} isLast />
            </Section>
            <Section title="Security">
              <ToggleRow label="End-to-End Encryption" sub="Secure all personal chats" on={privacy.e2e} onChange={(v) => setPrivacy((s) => ({ ...s, e2e: v }))} isLast />
            </Section>
            <Section title={`Blocked Users (${blocked.length})`}>
              {blocked.map((b, i) => (
                <div key={b} className="px-3.5 py-3 flex items-center gap-3" style={{ background: c.card, borderBottom: i === blocked.length - 1 ? "none" : `1px solid ${c.border}` }}>
                  <IconBadge bg="#6C7280"><ShieldAlert size={14} className="text-white" /></IconBadge>
                  <span className="flex-1 text-[15px]" style={{ color: c.text }}>{b}</span>
                  <button onClick={() => setBlocked((arr) => arr.filter((x) => x !== b))} className="text-[13px] font-medium" style={{ color: "#F0537A" }}>Unblock</button>
                </div>
              ))}
              {blocked.length === 0 && <div className="px-3.5 py-3 text-[14px]" style={{ color: c.sub, background: c.card }}>No blocked users</div>}
            </Section>
          </DetailShell>
        );

      case "storage":
        return (
          <DetailShell title="Data and Storage" onBack={() => setOpenPanel(null)}>
            <Section title="Automatic Media Download">
              <ToggleRow label="Auto-Download Media" on={autoDownload} onChange={setAutoDownload} />
              <ToggleRow label="Wi-Fi Only" on={wifiOnly} onChange={setWifiOnly} isLast />
            </Section>
            <Section title="Storage Usage">
              <div className="px-3.5 py-3" style={{ background: c.card }}>
                <div className="flex justify-between text-[14px] mb-2" style={{ color: c.text }}>
                  <span>Photos & Videos</span><span style={{ color: c.sub }}>{cacheGB.toFixed(1)} GB</span>
                </div>
                <div className="h-2 rounded-full overflow-hidden" style={{ background: c.chip }}>
                  <div className="h-full" style={{ width: `${Math.min(cacheGB / 3 * 100, 100)}%`, background: accent }} />
                </div>
              </div>
            </Section>
            <Section>
              <ActionRow label="Clear Cache" sub={`Free up ${cacheGB.toFixed(1)} GB`} textColor="#F0537A"
                onClick={() => { setCacheGB(0); flash("Cache cleared"); }} isLast
                right={<Trash2 size={16} style={{ color: "#F0537A" }} />} />
            </Section>
          </DetailShell>
        );

      case "appearance":
        return (
          <DetailShell title="Appearance" onBack={() => setOpenPanel(null)}>
            <Section title="Theme">
              <ToggleRow label={dark ? "Dark Mode" : "Light Mode"} sub="Switch app theme" on={dark} onChange={setDark} isLast />
            </Section>
            <Section title="Accent Color">
              <div className="flex items-center gap-4 px-3.5 py-4 flex-wrap" style={{ background: c.card }}>
                {Object.entries(ACCENTS).map(([k, v]) => (
                  <button key={k} onClick={() => setAccentKey(k)} className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: v, boxShadow: accentKey === k ? `0 0 0 3px ${c.card}, 0 0 0 5px ${v}` : "none" }}>
                    {accentKey === k && <Check size={16} className="text-white" />}
                  </button>
                ))}
              </div>
            </Section>
            <Section title="Chat Wallpaper">
              <div className="grid grid-cols-4 gap-2 px-3.5 py-3" style={{ background: c.card }}>
                {["#EAF4FF", "#FFF3E6", "#EAFBF0", "#F5EAFF", "#FFEAF1", "#E6F7F7", "#FFF9E0", "#EFEFEF"].map((clr, i) => (
                  <button key={i} onClick={() => setWallpaper(i)} className="aspect-square rounded-lg relative" style={{ background: clr, outline: wallpaper === i ? `2px solid ${accent}` : "none" }}>
                    {wallpaper === i && <Check size={14} className="absolute top-1 right-1" style={{ color: accent }} />}
                  </button>
                ))}
              </div>
            </Section>
          </DetailShell>
        );

      case "power":
        return (
          <DetailShell title="Power Saving" onBack={() => setOpenPanel(null)}>
            <Section>
              <ToggleRow label="Low Power Mode" sub="Reduce animations and background sync" on={lowPower} onChange={setLowPower} />
              <ToggleRow label="Enable Automatically" sub="Turn on when battery is below 20%" on={autoLowPower} onChange={setAutoLowPower} isLast />
            </Section>
          </DetailShell>
        );

      case "language":
        return (
          <DetailShell title="Language" onBack={() => setOpenPanel(null)}>
            <Section>
              {LANGS.map((l, i) => (
                <button key={l} onClick={() => { setLanguage(l); flash(`Language set to ${l}`); }} className="w-full flex items-center justify-between px-3.5 py-3" style={{ background: c.card, borderBottom: i === LANGS.length - 1 ? "none" : `1px solid ${c.border}` }}>
                  <span className="text-[16px]" style={{ color: c.text }}>{l}</span>
                  {language === l && <Check size={18} style={{ color: accent }} />}
                </button>
              ))}
            </Section>
          </DetailShell>
        );

      case "wallet":
        return (
          <DetailShell title="Wallet" onBack={() => setOpenPanel(null)}>
            <Section>
              <div className="px-4 py-6 flex flex-col items-center gap-1" style={{ background: c.card }}>
                <span className="text-[13px]" style={{ color: c.sub }}>Balance</span>
                <span className="text-[34px] font-bold" style={{ color: c.text }}>${balance.toFixed(2)}</span>
                <div className="flex gap-2 mt-3">
                  <button onClick={() => { setBalance((b) => b + 20); setWalletTx((t) => [{ label: "Added funds", amt: 20, t: "Just now" }, ...t]); flash("Added $20"); }}
                    className="px-4 py-2 rounded-full text-white text-[14px] font-medium" style={{ background: accent }}>+ Add Funds</button>
                  <button onClick={() => flash("Send money — pick a contact")} className="px-4 py-2 rounded-full text-[14px] font-medium" style={{ background: c.chip, color: c.text }}>Send</button>
                </div>
              </div>
            </Section>
            <Section title="Recent Activity">
              {walletTx.map((tx, i) => (
                <div key={i} className="px-3.5 py-3 flex items-center justify-between" style={{ background: c.card, borderBottom: i === walletTx.length - 1 ? "none" : `1px solid ${c.border}` }}>
                  <div>
                    <div className="text-[15px]" style={{ color: c.text }}>{tx.label}</div>
                    <div className="text-[12.5px]" style={{ color: c.sub }}>{tx.t}</div>
                  </div>
                  <span className="text-[15px] font-medium" style={{ color: tx.amt > 0 ? "#34C77E" : "#F0537A" }}>{tx.amt > 0 ? `+$${tx.amt}` : `-$${Math.abs(tx.amt)}`}</span>
                </div>
              ))}
            </Section>
          </DetailShell>
        );

      case "saved":
        return (
          <DetailShell title="Saved Messages" onBack={() => setOpenPanel(null)}>
            <div className="flex-1 flex flex-col h-full">
              <div className="flex-1 overflow-y-auto px-3.5 space-y-2 pb-2">
                {saved.map((s, i) => (
                  <div key={i} className="rounded-2xl px-3.5 py-2.5 max-w-[85%]" style={{ background: c.card }}>
                    <div className="text-[15px]" style={{ color: c.text }}>{s.text}</div>
                    <div className="text-[11px] text-right mt-1" style={{ color: c.sub }}>{s.t}</div>
                  </div>
                ))}
                {saved.length === 0 && <div className="text-center text-[14px] mt-6" style={{ color: c.sub }}>No saved messages yet</div>}
              </div>
              <div className="flex items-center gap-2 px-3.5 py-3" style={{ borderTop: `1px solid ${c.border}` }}>
                <input value={savedInput} onChange={(e) => setSavedInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addSaved()}
                  placeholder="Message yourself" className="flex-1 rounded-full px-4 py-2 text-[15px] outline-none" style={{ background: c.chip, color: c.text }} />
                <button onClick={addSaved} className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: accent }}>
                  <Send size={15} className="text-white" />
                </button>
              </div>
            </div>
          </DetailShell>
        );

      case "calls":
        return (
          <DetailShell title="Recent Calls" onBack={() => setOpenPanel(null)}
            rightAction={<button onClick={() => setCalls([])} className="text-[15px] mr-2" style={{ color: accent }}>Clear</button>}>
            <Section>
              {calls.map((call, i) => (
                <div key={i} className="px-3.5 py-3 flex items-center gap-3" style={{ background: c.card, borderBottom: i === calls.length - 1 ? "none" : `1px solid ${c.border}` }}>
                  <IconBadge bg={call.type === "missed" ? "#F0537A" : "#34C77E"}>
                    {call.type === "in" && <PhoneIncoming size={14} className="text-white" />}
                    {call.type === "out" && <PhoneOutgoing size={14} className="text-white" />}
                    {call.type === "missed" && <PhoneMissed size={14} className="text-white" />}
                  </IconBadge>
                  <div className="flex-1">
                    <div className="text-[15.5px]" style={{ color: call.type === "missed" ? "#F0537A" : c.text }}>{call.name}</div>
                    <div className="text-[12.5px]" style={{ color: c.sub }}>{call.time}{call.dur && ` · ${call.dur}`}</div>
                  </div>
                  <button onClick={() => flash(`Calling ${call.name}…`)} style={{ color: accent }}><Phone size={18} /></button>
                </div>
              ))}
              {calls.length === 0 && <div className="px-3.5 py-4 text-[14px] text-center" style={{ color: c.sub, background: c.card }}>No recent calls</div>}
            </Section>
          </DetailShell>
        );

      case "devices":
        return (
          <DetailShell title="Devices" onBack={() => setOpenPanel(null)}>
            <Section>
              {devices.map((d, i) => (
                <div key={i} className="px-3.5 py-3 flex items-center gap-3" style={{ background: c.card, borderBottom: i === devices.length - 1 ? "none" : `1px solid ${c.border}` }}>
                  <IconBadge bg={d.current ? "#34C77E" : "#6C7280"}>{d.name.includes("Mac") ? <Laptop size={14} className="text-white" /> : d.name.includes("iPad") ? <Monitor size={14} className="text-white" /> : <Smartphone size={14} className="text-white" />}</IconBadge>
                  <div className="flex-1">
                    <div className="text-[15.5px]" style={{ color: c.text }}>{d.name}{d.current && " (this device)"}</div>
                    <div className="text-[12.5px]" style={{ color: c.sub }}>{d.loc}</div>
                  </div>
                  {!d.current && (
                    <button onClick={() => setDevices((arr) => arr.filter((x) => x !== d))} className="text-[13px] font-medium" style={{ color: "#F0537A" }}>Log Out</button>
                  )}
                </div>
              ))}
            </Section>
          </DetailShell>
        );

      case "folders":
        return (
          <DetailShell title="Chat Folders" onBack={() => setOpenPanel(null)}>
            <Section>
              {folders.map((f, i) => (
                <div key={i} className="px-3.5 py-3 flex items-center gap-3" style={{ background: c.card, borderBottom: i === folders.length - 1 ? "none" : `1px solid ${c.border}` }}>
                  <IconBadge bg="#4C9CF5"><Folder size={14} className="text-white" /></IconBadge>
                  <span className="flex-1 text-[15.5px]" style={{ color: c.text }}>{f.name}</span>
                  <span className="text-[14px]" style={{ color: c.sub }}>{f.count}</span>
                  {f.name !== "All Chats" && (
                    <button onClick={() => setFolders((arr) => arr.filter((x) => x !== f))} className="ml-2" style={{ color: "#F0537A" }}><X size={16} /></button>
                  )}
                </div>
              ))}
            </Section>
            <Section title="New Folder">
              <div className="flex items-center gap-2 px-3.5 py-3" style={{ background: c.card }}>
                <input value={newFolder} onChange={(e) => setNewFolder(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addFolder()} placeholder="Folder name"
                  className="flex-1 text-[15px] outline-none bg-transparent" style={{ color: c.text }} />
                <button onClick={addFolder} style={{ color: accent }}><PlusCircle size={20} /></button>
              </div>
            </Section>
          </DetailShell>
        );

      case "premium":
        return (
          <DetailShell title="Old Time Premium" onBack={() => setOpenPanel(null)}>
            <Section>
              <div className="px-4 py-6 flex flex-col items-center gap-2" style={{ background: c.card }}>
                <Sparkles size={30} style={{ color: "#E8963C" }} />
                <div className="text-[19px] font-semibold" style={{ color: c.text }}>{premium ? "You're Premium" : "Unlock Premium"}</div>
                <div className="text-[13px] text-center" style={{ color: c.sub }}>Faster uploads, exclusive stickers, no ads, and larger file transfers.</div>
                <button onClick={() => { setPremium((p) => !p); flash(premium ? "Premium canceled" : "Welcome to Premium 🎉"); }}
                  className="mt-2 px-5 py-2.5 rounded-full text-white text-[15px] font-medium" style={{ background: premium ? "#6C7280" : "linear-gradient(135deg,#E8963C,#F0537A)" }}>
                  {premium ? "Cancel Premium" : "Subscribe — $4.99/mo"}
                </button>
              </div>
            </Section>
            <Section title="Included">
              {["4 GB file uploads", "Exclusive stickers & reactions", "No ads in Old Time", "Priority support"].map((f, i, arr) => (
                <div key={f} className="px-3.5 py-3 flex items-center gap-3" style={{ background: c.card, borderBottom: i === arr.length - 1 ? "none" : `1px solid ${c.border}` }}>
                  <Check size={16} style={{ color: "#34C77E" }} />
                  <span className="text-[15px]" style={{ color: c.text }}>{f}</span>
                </div>
              ))}
            </Section>
          </DetailShell>
        );

      case "stars":
        return (
          <DetailShell title="My Stars" onBack={() => setOpenPanel(null)}>
            <Section>
              <div className="px-4 py-6 flex flex-col items-center gap-1" style={{ background: c.card }}>
                <Star size={28} style={{ color: "#E8963C" }} fill="#E8963C" />
                <div className="text-[30px] font-bold" style={{ color: c.text }}>{stars}</div>
                <div className="text-[13px]" style={{ color: c.sub }}>Stars balance</div>
              </div>
            </Section>
            <Section title="Buy Stars">
              {[100, 500, 1000].map((amt, i, arr) => (
                <button key={amt} onClick={() => { setStars((s) => s + amt); flash(`+${amt} Stars`); }} className="w-full px-3.5 py-3 flex items-center justify-between" style={{ background: c.card, borderBottom: i === arr.length - 1 ? "none" : `1px solid ${c.border}` }}>
                  <span className="text-[15.5px]" style={{ color: c.text }}>{amt} Stars</span>
                  <span className="text-[14px] font-medium" style={{ color: accent }}>${(amt * 0.02).toFixed(2)}</span>
                </button>
              ))}
            </Section>
          </DetailShell>
        );

      case "business":
        return (
          <DetailShell title="Business Tools" onBack={() => setOpenPanel(null)}>
            <Section>
              <ToggleRow icon={<Zap size={14} className="text-white" />} bg="#E8963C" label="Quick Replies" on={biz.quickReplies} onChange={(v) => setBiz((s) => ({ ...s, quickReplies: v }))} />
              <ToggleRow icon={<MessageSquareText size={14} className="text-white" />} bg="#4C9CF5" label="Greeting Message" on={biz.greeting} onChange={(v) => setBiz((s) => ({ ...s, greeting: v }))} />
              <ToggleRow icon={<Coffee size={14} className="text-white" />} bg="#8B5CF6" label="Away Message" on={biz.away} onChange={(v) => setBiz((s) => ({ ...s, away: v }))} />
              <ToggleRow icon={<Clock size={14} className="text-white" />} bg="#34C77E" label="Business Hours" on={biz.hours} onChange={(v) => setBiz((s) => ({ ...s, hours: v }))} isLast />
            </Section>
          </DetailShell>
        );

      case "gift":
        return (
          <DetailShell title="Send a Gift" onBack={() => setOpenPanel(null)}>
            <Section title={`Balance: ${stars} Stars`}>
              <div className="grid grid-cols-2 gap-3 px-3.5 py-3" style={{ background: c.card }}>
                {GIFTS.map((g) => (
                  <button key={g.id} onClick={() => sendGift(g)} className="rounded-2xl py-4 flex flex-col items-center gap-1" style={{ background: c.chip }}>
                    <Gift size={26} style={{ color: accent }} />
                    <span className="text-[14px] font-medium" style={{ color: c.text }}>{g.label}</span>
                    <span className="text-[12px]" style={{ color: c.sub }}>{g.cost} ⭐</span>
                  </button>
                ))}
              </div>
            </Section>
            {giftSentMsg && <div className="text-center text-[14px]" style={{ color: "#34C77E" }}>{giftSentMsg}</div>}
          </DetailShell>
        );

      case "account":
        return (
          <DetailShell title="Account" onBack={() => setOpenPanel(null)}>
            <Section>
              <div className="px-3.5 py-3 flex items-center justify-between" style={{ background: c.card, borderBottom: `1px solid ${c.border}` }}>
                <span className="text-[15px]" style={{ color: c.sub }}>Phone</span>
                <span className="text-[15px]" style={{ color: c.text }}>+1 786 910 0502</span>
              </div>
              <ActionRow label="Change Number" onClick={() => flash("Enter your new number")} isLast />
            </Section>
            <Section>
              {!deleteConfirm ? (
                <ActionRow label="Delete Account" textColor="#F0537A" onClick={() => setDeleteConfirm(true)} isLast />
              ) : (
                <div className="px-3.5 py-3" style={{ background: c.card }}>
                  <div className="text-[14px] mb-3" style={{ color: c.text }}>This permanently deletes your account. Are you sure?</div>
                  <div className="flex gap-2">
                    <button onClick={() => setDeleteConfirm(false)} className="flex-1 py-2 rounded-full text-[14px] font-medium" style={{ background: c.chip, color: c.text }}>Cancel</button>
                    <button onClick={() => { setDeleteConfirm(false); flash("Account deletion canceled — demo mode"); }} className="flex-1 py-2 rounded-full text-[14px] font-medium text-white" style={{ background: "#F0537A" }}>Delete</button>
                  </div>
                </div>
              )}
            </Section>
          </DetailShell>
        );

      case "chatSettings":
        return (
          <DetailShell title="Chats" onBack={() => setOpenPanel(null)}>
            <Section>
              <ToggleRow label="Enter to Send" on={chatPrefs.enterToSend} onChange={(v) => setChatPrefs((s) => ({ ...s, enterToSend: v }))} />
              <ToggleRow label="Auto-Play Media" on={chatPrefs.autoplay} onChange={(v) => setChatPrefs((s) => ({ ...s, autoplay: v }))} />
              <ToggleRow label="Swipe to Reply" on={chatPrefs.swipeReply} onChange={(v) => setChatPrefs((s) => ({ ...s, swipeReply: v }))} isLast />
            </Section>
            <Section title="Font Size">
              <div className="px-3.5 py-4 flex items-center gap-3" style={{ background: c.card }}>
                <button onClick={() => setFontSize((f) => Math.max(12, f - 1))} style={{ color: accent }}><Minus size={18} /></button>
                <span className="flex-1 text-center" style={{ fontSize: fontSize, color: c.text }}>Aa</span>
                <button onClick={() => setFontSize((f) => Math.min(22, f + 1))} style={{ color: accent }}><Plus size={18} /></button>
              </div>
            </Section>
          </DetailShell>
        );

      case "invite":
        return (
          <DetailShell title="Invite a Friend" onBack={() => setOpenPanel(null)}>
            <Section>
              <div className="px-4 py-6 flex flex-col items-center gap-2" style={{ background: c.card }}>
                <UserPlus size={28} style={{ color: accent }} />
                <div className="text-[15px]" style={{ color: c.text }}>Your invite code</div>
                <div className="text-[20px] font-bold tracking-wide" style={{ color: accent }}>{inviteCode}</div>
                <button onClick={copyInvite} className="mt-1 flex items-center gap-1.5 px-4 py-2 rounded-full text-[14px] font-medium text-white" style={{ background: accent }}>
                  <Copy size={14} /> {copied ? "Copied!" : "Copy Code"}
                </button>
              </div>
            </Section>
            <Section>
              <div className="px-3.5 py-3 flex items-center justify-between" style={{ background: c.card }}>
                <span className="text-[15px]" style={{ color: c.text }}>Friends joined</span>
                <span className="text-[15px] font-semibold" style={{ color: c.text }}>{invited}</span>
              </div>
            </Section>
            <button onClick={() => { setInvited((n) => n + 1); flash("Invite sent!"); }} className="mx-3.5 py-3 rounded-[13px] text-white text-[15px] font-medium" style={{ background: "#34C77E" }}>
              Simulate Friend Joining
            </button>
          </DetailShell>
        );

      case "updates":
        return (
          <DetailShell title="App Updates" onBack={() => setOpenPanel(null)}>
            <Section>
              <div className="px-3.5 py-3 flex items-center justify-between" style={{ background: c.card, borderBottom: `1px solid ${c.border}` }}>
                <span className="text-[15px]" style={{ color: c.sub }}>Current Version</span>
                <span className="text-[15px]" style={{ color: c.text }}>3.2.1</span>
              </div>
              <ActionRow
                label={updateStatus === "checking" ? "Checking…" : updateStatus === "uptodate" ? "You're up to date" : "Check for Updates"}
                onClick={checkUpdates} isLast
                right={updateStatus === "checking" ? <RefreshCw size={16} className="animate-spin" style={{ color: accent }} /> : updateStatus === "uptodate" ? <Check size={16} style={{ color: "#34C77E" }} /> : null}
              />
            </Section>
          </DetailShell>
        );

      case "ask":
        return (
          <DetailShell title="Ask a Question" onBack={() => setOpenPanel(null)}>
            <div className="flex-1 flex flex-col h-full">
              <div className="flex-1 overflow-y-auto px-3.5 space-y-2 pb-2">
                {askMsgs.map((m, i) => (
                  <div key={i} className={`flex ${m.from === "me" ? "justify-end" : "justify-start"}`}>
                    <div className="rounded-2xl px-3.5 py-2.5 max-w-[80%] text-[15px]" style={{ background: m.from === "me" ? accent : c.card, color: m.from === "me" ? "#fff" : c.text }}>
                      {m.text}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2 px-3.5 py-3" style={{ borderTop: `1px solid ${c.border}` }}>
                <input value={askInput} onChange={(e) => setAskInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendAsk()}
                  placeholder="Type your question" className="flex-1 rounded-full px-4 py-2 text-[15px] outline-none" style={{ background: c.chip, color: c.text }} />
                <button onClick={sendAsk} className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: accent }}><Send size={15} className="text-white" /></button>
              </div>
            </div>
          </DetailShell>
        );

      case "faq":
        return (
          <DetailShell title="Old Time FAQ" onBack={() => setOpenPanel(null)}>
            <Accordion openIndex={faqOpen} setOpenIndex={setFaqOpen} items={[
              { q: "Is Old Time end-to-end encrypted?", a: "Yes, personal chats are encrypted end-to-end when the setting is enabled in Privacy and Security." },
              { q: "How do I change my number?", a: "Go to Account → Change Number and follow the verification steps." },
              { q: "What are Stars used for?", a: "Stars can be spent on gifts, premium stickers, and business tools throughout the app." },
              { q: "Can I use Old Time on multiple devices?", a: "Yes — manage every signed-in device from the Devices screen and log any of them out remotely." },
            ]} />
          </DetailShell>
        );

      case "features":
        return (
          <DetailShell title="Old Time Features" onBack={() => setOpenPanel(null)}>
            <Accordion openIndex={featOpen} setOpenIndex={setFeatOpen} items={[
              { q: "Chat Folders", a: "Organize chats into custom folders like Work or Personal, right from Settings." },
              { q: "Business Tools", a: "Quick replies, greeting and away messages, and business hours for professional accounts." },
              { q: "Wallet & Stars", a: "Send money, buy Stars, and gift them to friends inside any chat." },
              { q: "Premium", a: "Bigger uploads, exclusive stickers, and an ad-free experience." },
            ]} />
          </DetailShell>
        );

      default:
        return null;
    }
  }

  const handledPanels = new Set(["profile","notifications","privacy","storage","appearance","power","language","wallet","saved","calls","devices","folders","premium","stars","business","gift","account","chatSettings","invite","updates","ask","faq","features"]);

  function handleRowClick(item) {
    if (item.key === "logout") { setLogoutConfirm(true); return; }
    if (handledPanels.has(item.key)) setOpenPanel(item.key);
  }

  if (loggedOut) {
    return (
      <div className="w-full max-w-[430px] mx-auto h-[900px] flex flex-col items-center justify-center gap-4" style={{ background: c.bg }}>
        <LogOut size={34} style={{ color: c.sub }} />
        <div className="text-[17px]" style={{ color: c.text }}>You're logged out</div>
        <button onClick={() => setLoggedOut(false)} className="px-5 py-2.5 rounded-full text-white text-[15px] font-medium" style={{ background: accent }}>Log Back In</button>
      </div>
    );
  }

  return (
    <ThemeCtx.Provider value={{ dark, accent }}>
      <div className="w-full max-w-[430px] mx-auto h-[900px] relative overflow-hidden font-[-apple-system,BlinkMacSystemFont,'SF Pro Text',sans-serif] select-none" style={{ background: c.bg }}>

        {/* Status bar */}
        <div className="flex items-center justify-between px-6 pt-3 pb-1 text-[15px] font-semibold" style={{ background: c.headerBg, color: c.text }}>
          <span>11:08</span>
          <div className="flex items-center gap-1">
            <span className="text-[13px]">●●●●</span>
            <span className="text-[12px]">5G</span>
            <div className="w-6 h-3 border rounded-sm relative" style={{ borderColor: c.text }}>
              <div className="absolute inset-[1.5px]" style={{ background: "#E8963C", width: "40%" }} />
            </div>
          </div>
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-3.5 pt-2 pb-2" style={{ background: c.headerBg, borderBottom: `1px solid ${c.border}` }}>
          <button className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: c.card, boxShadow: "0 1px 2px rgba(0,0,0,0.08)" }} onClick={() => flash("Scan to add on Old Time")}>
            <QrCode size={18} style={{ color: c.text }} />
          </button>
          <h1 className="text-[17px] font-semibold" style={{ color: c.text }}>{name}</h1>
          <button onClick={() => setOpenPanel("profile")} className="text-[16px] font-medium w-9 text-right" style={{ color: accent }}>Edit</button>
        </div>

        {/* Search */}
        <div className="px-3.5 py-2" style={{ background: c.headerBg }}>
          <div className="flex items-center gap-2 rounded-[10px] px-3 py-2" style={{ background: c.chip }}>
            <Search size={16} style={{ color: c.sub }} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search settings"
              className="bg-transparent outline-none text-[15px] flex-1" style={{ color: c.text }} />
          </div>
        </div>

        {/* Body */}
        <div className="overflow-y-auto pt-2" style={{ height: "calc(100% - 210px)" }}>
          {filteredGroups.map((group, gi) => (
            <Section key={gi} title={group.title}>
              {group.items.map((item, idx) => (
                <Row key={item.key} icon={item.icon} bg={item.bg} label={item.label} value={item.value} badge={item.badge}
                  danger={item.danger} isLast={idx === group.items.length - 1} onClick={() => handleRowClick(item)} />
              ))}
            </Section>
          ))}
          {filteredGroups.length === 0 && <div className="text-center text-[14px] mt-10" style={{ color: c.sub }}>No settings found</div>}
        </div>

        {/* Bottom tab bar */}
        <div className="absolute bottom-0 left-0 right-0 flex items-stretch pb-1 pt-1.5" style={{ background: c.headerBg + "F2", borderTop: `1px solid ${c.border}` }}>
          {[
            { key: "Contacts", icon: <Users size={22} />, badge: "!" },
            { key: "Calls", icon: <PhoneCall size={22} /> },
            { key: "Chats", icon: <MessageSquare size={22} />, badge: "109" },
            { key: "Settings", icon: <SettingsIcon size={22} />, badge: "!" },
            { key: "Search", icon: <Search size={22} /> },
          ].map((t) => {
            const active = activeTab === t.key;
            return (
              <button key={t.key} onClick={() => setActiveTab(t.key)} className="flex-1 flex flex-col items-center gap-0.5 py-1 relative">
                <div style={{ color: active ? accent : c.sub }}>{t.icon}</div>
                {t.badge && <span className="absolute top-0 right-[22%] text-[10px] font-bold text-white rounded-full px-1.5 min-w-[16px] text-center" style={{ background: "#F0537A" }}>{t.badge}</span>}
                <span className="text-[10.5px]" style={{ color: active ? accent : c.sub, fontWeight: active ? 500 : 400 }}>{t.key}</span>
              </button>
            );
          })}
        </div>

        {/* Non-settings tab placeholder screens */}
        {activeTab !== "Settings" && (
          <div className="absolute inset-0 top-[92px] bottom-[64px] flex flex-col items-center justify-center gap-3 z-10" style={{ background: c.bg }}>
            <div style={{ color: c.sub }}>
              {activeTab === "Contacts" && <Users size={40} />}
              {activeTab === "Calls" && <PhoneCall size={40} />}
              {activeTab === "Chats" && <MessageSquare size={40} />}
              {activeTab === "Search" && <Search size={40} />}
            </div>
            <div className="text-[14px]" style={{ color: c.sub }}>{activeTab} screen lives in its own tab — this build covers Settings</div>
            <button onClick={() => setActiveTab("Settings")} className="text-[14px] font-medium mt-1" style={{ color: accent }}>Back to Settings</button>
          </div>
        )}

        {/* Detail panel overlay */}
        {openPanel && renderPanel()}

        {/* Logout confirm */}
        {logoutConfirm && (
          <div className="absolute inset-0 z-30 flex items-center justify-center px-8" style={{ background: "rgba(0,0,0,0.4)" }}>
            <div className="w-full rounded-2xl overflow-hidden" style={{ background: c.card }}>
              <div className="px-4 pt-5 pb-4 text-center">
                <div className="text-[16px] font-semibold mb-1" style={{ color: c.text }}>Log Out?</div>
                <div className="text-[13.5px]" style={{ color: c.sub }}>You'll need to verify your number to log back in.</div>
              </div>
              <div className="flex" style={{ borderTop: `1px solid ${c.border}` }}>
                <button onClick={() => setLogoutConfirm(false)} className="flex-1 py-3 text-[15px]" style={{ color: accent, borderRight: `1px solid ${c.border}` }}>Cancel</button>
                <button onClick={() => { setLogoutConfirm(false); setLoggedOut(true); }} className="flex-1 py-3 text-[15px] font-medium" style={{ color: "#F0537A" }}>Log Out</button>
              </div>
            </div>
          </div>
        )}

        {/* Toast */}
        {toast && (
          <div className="absolute bottom-20 left-1/2 -translate-x-1/2 text-white text-[13px] px-4 py-2 rounded-full z-30" style={{ background: "rgba(28,28,30,0.92)" }}>
            {toast}
          </div>
        )}
      </div>
    </ThemeCtx.Provider>
  );
}
