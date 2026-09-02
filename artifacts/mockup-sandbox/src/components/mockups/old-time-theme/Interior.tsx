import { useMemo, useState, type ReactNode } from "react";
import {
  Bell,
  BellOff,
  Check,
  CheckCheck,
  ChevronRight,
  CircleUserRound,
  Compass,
  Edit3,
  ImagePlus,
  Menu,
  Mic,
  Paperclip,
  Phone,
  Plus,
  Search,
  Send,
  ShieldCheck,
  SlidersHorizontal,
  X,
} from "lucide-react";

type Conversation = {
  name: string;
  initials: string;
  tone: string;
  message: string;
  time: string;
  unread?: number;
  online?: boolean;
  muted?: boolean;
  verified?: boolean;
};

type Story = {
  name: string;
  initials: string;
  tone: string;
  seen?: boolean;
  label: string;
};

const conversations: Conversation[] = [
  { name: "Mira Chen", initials: "MC", tone: "coral", message: "The little bookstore on 9th is open late.", time: "10:42 AM", unread: 2, online: true },
  { name: "Elliot Park", initials: "EP", tone: "blue", message: "Sent a photo", time: "9:18 AM", verified: true },
  { name: "Rhea Dalton", initials: "RD", tone: "purple", message: "That works for me. See you Sunday.", time: "Yesterday", online: true },
  { name: "Jon Bell", initials: "JB", tone: "gold", message: "Voice message", time: "Yesterday", muted: true },
  { name: "Nadia Brooks", initials: "NB", tone: "ink", message: "Do you still have the notes from the meeting?", time: "Mon", unread: 1 },
  { name: "Old Time team", initials: "OT", tone: "brand", message: "Welcome to a quieter way to keep in touch.", time: "Sun", verified: true },
];

const stories: Story[] = [
  { name: "Your story", initials: "AM", tone: "brand", label: "Add a moment" },
  { name: "Mira", initials: "MC", tone: "coral", label: "Coffee run", },
  { name: "Elliot", initials: "EP", tone: "blue", label: "North Beach", seen: true },
  { name: "Rhea", initials: "RD", tone: "purple", label: "Sunday light" },
  { name: "Jon", initials: "JB", tone: "gold", label: "New record", seen: true },
];

const toneStyles: Record<string, { background: string; foreground: string }> = {
  coral: { background: "#D97862", foreground: "#FFF8F0" },
  blue: { background: "#5276B8", foreground: "#F8FBFF" },
  purple: { background: "#765A9A", foreground: "#FBF8FF" },
  gold: { background: "#C3944C", foreground: "#FFFDF5" },
  ink: { background: "#3A4B63", foreground: "#F5F7FB" },
  brand: { background: "#263F86", foreground: "#F4F7FF" },
};

function Avatar({ initials, tone, size = "md", online = false }: { initials: string; tone: string; size?: "sm" | "md" | "lg"; online?: boolean }) {
  const palette = toneStyles[tone];
  return (
    <span className={`avatar avatar-${size}`} style={{ backgroundColor: palette.background, color: palette.foreground }}>
      {tone === "brand" ? <img src="/__mockup/images/old-time-icon.png" alt="" /> : initials}
      {online ? <span className="online-dot" aria-label="online" /> : null}
    </span>
  );
}

function StoryAvatar({ story, onClick }: { story: Story; onClick: () => void }) {
  return (
    <button className="story-item" onClick={onClick} aria-label={`Open ${story.name}'s story`}>
      <span className={`story-ring ${story.seen ? "seen" : ""}`}>
        <Avatar initials={story.initials} tone={story.tone} size="sm" />
        {story.name === "Your story" ? <span className="story-plus"><Plus size={12} strokeWidth={2.6} /></span> : null}
      </span>
      <span className="story-name">{story.name}</span>
    </button>
  );
}

function IconButton({ label, onClick, children, accent = false }: { label: string; onClick: () => void; children: ReactNode; accent?: boolean }) {
  return (
    <button className={`icon-button ${accent ? "accent-button" : ""}`} onClick={onClick} aria-label={label}>
      {children}
    </button>
  );
}

export function Interior() {
  const [query, setQuery] = useState("");
  const [profileOpen, setProfileOpen] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [storyOpen, setStoryOpen] = useState<Story | null>(null);
  const [activeNav, setActiveNav] = useState("Chats");
  const [notice, setNotice] = useState("");

  const filteredConversations = useMemo(
    () => conversations.filter((conversation) => `${conversation.name} ${conversation.message}`.toLowerCase().includes(query.toLowerCase())),
    [query],
  );

  function showNotice(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2200);
  }

  return (
    <main className="phone-shell">
      <style>{`
        :root {
          color-scheme: light;
          font-family: 'DM Sans', 'Plus Jakarta Sans', sans-serif;
        }
        * { box-sizing: border-box; }
        button, input { font: inherit; }
        button { border: 0; cursor: pointer; }
        .phone-shell {
          width: 100%;
          min-height: 100vh;
          background:
            radial-gradient(circle at 100% 0%, rgba(222, 124, 93, .10), transparent 28%),
            linear-gradient(180deg, #F8F6F1 0%, #F4F3EF 100%);
          color: #1B2840;
          overflow: hidden;
          position: relative;
        }
        .app-body { max-width: 520px; min-height: 100vh; margin: 0 auto; position: relative; padding-bottom: 104px; }
        .status-bar { height: 26px; padding: 8px 21px 0; display: flex; align-items: center; justify-content: space-between; color: #52617A; font-size: 10px; letter-spacing: .04em; font-weight: 700; }
        .status-right { display: flex; gap: 7px; align-items: center; }
        .signal { width: 17px; height: 9px; display: flex; gap: 2px; align-items: end; }
        .signal i { width: 3px; background: #52617A; border-radius: 3px; }
        .signal i:nth-child(1) { height: 4px; opacity: .55; }.signal i:nth-child(2) { height: 6px; opacity: .72; }.signal i:nth-child(3) { height: 8px; }
        .battery { width: 17px; height: 9px; border: 1.3px solid #52617A; border-radius: 3px; padding: 1px; }.battery:after { content: ""; position: absolute; width: 2px; height: 4px; margin: 1px 0 0 17px; border-radius: 0 2px 2px 0; background: #52617A; }.battery span { display: block; width: 80%; height: 100%; border-radius: 1px; background: #52617A; }
        .topbar { padding: 17px 20px 12px; display: flex; justify-content: space-between; align-items: center; }
        .brand-lockup { display: flex; gap: 10px; align-items: center; text-align: left; }
        .brand-mark { width: 37px; height: 37px; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 10px rgba(38, 63, 134, .18); background: #263F86; }
        .brand-mark img { width: 100%; height: 100%; object-fit: cover; }
        .eyebrow { font-size: 10px; text-transform: uppercase; letter-spacing: .16em; color: #77839A; font-weight: 800; margin-bottom: 1px; }
        .page-title { font-family: Georgia, 'Times New Roman', serif; font-size: 27px; line-height: 1; letter-spacing: -.04em; color: #1C2B49; }
        .top-actions { display: flex; gap: 7px; align-items: center; }
        .icon-button { width: 38px; height: 38px; border-radius: 13px; color: #51617C; background: rgba(255,255,255,.66); border: 1px solid rgba(39, 56, 88, .09); display: inline-flex; align-items: center; justify-content: center; box-shadow: 0 5px 14px rgba(46, 57, 78, .05); transition: transform .18s ease, background .18s ease; }
        .icon-button:hover { transform: translateY(-1px); background: #FFFDF9; }
        .accent-button { background: #263F86; color: #F7F8FF; border-color: #263F86; box-shadow: 0 6px 13px rgba(38, 63, 134, .2); }
        .intro { padding: 1px 20px 17px; display: flex; justify-content: space-between; align-items: end; }
        .intro-copy { font-size: 12px; color: #7A8495; line-height: 1.35; }
        .intro-copy strong { color: #40516E; font-weight: 700; }
        .secure-chip { display: flex; align-items: center; gap: 5px; color: #6A778D; font-size: 10px; font-weight: 700; }
        .secure-chip svg { color: #738F78; }
        .stories-card { margin: 0 14px 13px; padding: 13px 10px 11px; background: rgba(255,255,255,.57); border: 1px solid rgba(40, 54, 79, .08); border-radius: 20px; box-shadow: 0 8px 24px rgba(46, 55, 75, .045); }
        .section-head { display: flex; align-items: center; justify-content: space-between; padding: 0 6px 11px; }
        .section-title { color: #344662; text-transform: uppercase; font-size: 10px; letter-spacing: .15em; font-weight: 800; }
        .section-action { color: #6B7790; background: transparent; font-size: 11px; font-weight: 700; display: flex; align-items: center; gap: 2px; padding: 4px 0; }
        .stories-list { display: flex; gap: 14px; overflow-x: auto; padding: 0 4px 1px; scrollbar-width: none; }
        .stories-list::-webkit-scrollbar { display: none; }
        .story-item { flex: 0 0 57px; background: transparent; color: #5F6C82; padding: 0; display: flex; flex-direction: column; align-items: center; gap: 5px; }
        .story-ring { width: 52px; height: 52px; border-radius: 18px; padding: 2px; background: linear-gradient(145deg, #E17C5F, #5E72BB 67%, #795399); position: relative; display: grid; place-items: center; }
        .story-ring.seen { background: #CDD1D8; }
        .story-name { max-width: 57px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 10px; font-weight: 700; letter-spacing: -.01em; }
        .story-plus { position: absolute; right: -3px; bottom: -3px; width: 18px; height: 18px; border-radius: 7px; display: grid; place-items: center; background: #E17C5F; color: white; border: 2px solid #F8F6F1; }
        .avatar { position: relative; flex: 0 0 auto; display: grid; place-items: center; border-radius: 15px; font-size: 11px; font-weight: 800; letter-spacing: .02em; overflow: visible; }
        .avatar img { width: 100%; height: 100%; object-fit: cover; border-radius: inherit; }
        .avatar-sm { width: 48px; height: 48px; border-radius: 16px; font-size: 10px; }
        .avatar-md { width: 50px; height: 50px; }
        .avatar-lg { width: 72px; height: 72px; border-radius: 23px; font-size: 18px; }
        .online-dot { position: absolute; width: 10px; height: 10px; right: -2px; bottom: -2px; border-radius: 50%; background: #6B9B7E; border: 2px solid #F8F6F1; }
        .search-wrap { margin: 0 14px 14px; position: relative; }
        .search-wrap svg { position: absolute; left: 15px; top: 13px; color: #7A879B; }
        .search-input { width: 100%; height: 43px; background: rgba(230, 232, 235, .70); border: 1px solid rgba(50, 67, 97, .04); border-radius: 14px; padding: 0 40px 0 42px; outline: none; color: #283A59; font-size: 13px; transition: background .18s ease, border .18s ease; }
        .search-input:focus { background: rgba(255,255,255,.82); border-color: rgba(82, 118, 184, .35); }
        .search-input::placeholder { color: #7A879B; }
        .search-clear { position: absolute; right: 8px; top: 7px; width: 29px; height: 29px; border-radius: 9px; display: grid; place-items: center; background: transparent; color: #728097; }
        .list-header { padding: 1px 20px 9px; display: flex; align-items: center; justify-content: space-between; }
        .list-title { font-family: Georgia, 'Times New Roman', serif; color: #243653; font-size: 20px; letter-spacing: -.03em; }
        .list-count { color: #8992A0; font-size: 10px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; }
        .chat-list { margin: 0 14px; border-radius: 20px; overflow: hidden; background: rgba(255,255,255,.71); border: 1px solid rgba(39, 56, 88, .08); box-shadow: 0 12px 28px rgba(47, 55, 72, .045); }
        .chat-row { width: 100%; min-height: 76px; padding: 12px 13px; display: flex; align-items: center; gap: 11px; background: transparent; text-align: left; color: inherit; border-bottom: 1px solid rgba(45, 58, 81, .075); transition: background .18s ease; }
        .chat-row:last-child { border-bottom: 0; }.chat-row:hover { background: rgba(245, 242, 235, .7); }
        .chat-copy { min-width: 0; flex: 1; }
        .chat-topline, .chat-bottomline { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
        .chat-name { color: #273957; font-size: 13px; font-weight: 800; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .verified { color: #5276B8; display: inline-flex; margin-left: 3px; vertical-align: -2px; }
        .chat-time { color: #9299A5; font-size: 10px; white-space: nowrap; font-weight: 700; }
        .chat-preview { color: #798397; font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 5px; }
        .preview-check { color: #6887B6; display: inline-flex; vertical-align: -2px; margin-right: 3px; }
        .unread { min-width: 20px; height: 20px; padding: 0 5px; display: grid; place-items: center; border-radius: 8px; background: #E17C5F; color: #FFF8F0; font-size: 10px; font-weight: 800; }
        .muted-icon { color: #9BA3AF; margin-left: 5px; }
        .empty-search { margin: 0 14px; border-radius: 20px; padding: 36px 24px; text-align: center; background: rgba(255,255,255,.58); border: 1px dashed rgba(50, 67, 97, .2); color: #68768D; font-size: 13px; }
        .empty-search strong { display: block; color: #354967; font-family: Georgia, serif; font-size: 19px; margin-bottom: 5px; }
        .bottom-dock { position: fixed; z-index: 5; left: 50%; bottom: 15px; transform: translateX(-50%); width: min(calc(100% - 28px), 360px); height: 66px; padding: 7px; border-radius: 23px; display: grid; grid-template-columns: repeat(4, 1fr); gap: 3px; background: rgba(31, 46, 76, .96); box-shadow: 0 14px 28px rgba(25, 37, 62, .22); }
        .nav-item { color: #AEB8CC; background: transparent; border-radius: 17px; min-width: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px; transition: background .18s ease, color .18s ease; }
        .nav-item.active { background: #F2EDE2; color: #273B63; }.nav-item span { font-size: 9px; font-weight: 800; letter-spacing: .01em; }
        .notice { position: fixed; z-index: 20; left: 50%; bottom: 93px; transform: translateX(-50%); background: #263F86; color: #FAFBFF; padding: 10px 15px; border-radius: 12px; box-shadow: 0 8px 20px rgba(38,63,134,.2); font-size: 12px; font-weight: 700; white-space: nowrap; }
        .scrim { position: fixed; inset: 0; z-index: 10; background: rgba(22, 31, 49, .32); backdrop-filter: blur(3px); display: flex; align-items: flex-end; justify-content: center; }
        .sheet { width: min(100%, 520px); background: #FBFAF7; border-radius: 25px 25px 0 0; padding: 14px 20px 27px; box-shadow: 0 -12px 32px rgba(28, 40, 61, .16); animation: rise .22s ease-out; }
        @keyframes rise { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: translateY(0); } }
        .sheet-grip { width: 34px; height: 4px; background: #D3D4D2; border-radius: 4px; margin: 0 auto 15px; }
        .sheet-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 17px; }.sheet-head h2 { color: #273957; font-family: Georgia, serif; font-size: 23px; margin: 0; letter-spacing: -.03em; }.close-button { width: 31px; height: 31px; border-radius: 10px; display: grid; place-items: center; background: #EEF0F1; color: #67748A; }
        .compose-input { width: 100%; min-height: 48px; border-radius: 14px; border: 1px solid #D8DCE2; background: #F1F2F1; outline: none; padding: 0 14px; color: #273957; font-size: 13px; margin-bottom: 11px; }.compose-input:focus { border-color: #7890BD; background: #FFF; }
        .compose-actions { display: flex; gap: 8px; margin-bottom: 13px; }.compose-tool { height: 34px; border-radius: 10px; padding: 0 11px; display: flex; align-items: center; gap: 6px; background: #F0EEE9; color: #647189; font-size: 11px; font-weight: 700; }
        .send-button { width: 100%; height: 46px; border-radius: 14px; background: #263F86; color: #FFF; display: flex; align-items: center; justify-content: center; gap: 8px; font-size: 13px; font-weight: 800; }
        .profile-panel { padding-bottom: 23px; }.profile-banner { margin: -14px -20px 19px; height: 116px; padding: 19px 20px; display: flex; align-items: end; justify-content: space-between; background: linear-gradient(135deg, #263F86, #536CB0 65%, #D97862); color: white; }.profile-banner h2 { margin: 0; font-family: Georgia, serif; font-size: 25px; letter-spacing: -.04em; }.profile-banner p { font-size: 11px; opacity: .75; margin: 3px 0 0; }.profile-card-avatar { margin-bottom: -34px; border: 4px solid #FBFAF7; border-radius: 27px; }.profile-info { padding-top: 10px; }.profile-row { display: flex; align-items: center; gap: 12px; padding: 13px 0; border-bottom: 1px solid #E7E5E0; }.profile-row svg { color: #617AAB; }.profile-row p { margin: 0; color: #273957; font-size: 13px; font-weight: 700; }.profile-row small { display: block; color: #8992A0; font-size: 10px; margin-top: 3px; font-weight: 600; }
        .story-viewer { align-items: center; }.story-viewer-card { width: min(calc(100% - 30px), 360px); min-height: 410px; padding: 18px; border-radius: 25px; display: flex; flex-direction: column; justify-content: space-between; color: white; box-shadow: 0 18px 40px rgba(21,32,55,.25); background: linear-gradient(150deg, #263F86 0%, #526AA6 56%, #D97862 120%); }.story-viewer-top { display: flex; align-items: center; gap: 10px; }.story-viewer-top .avatar { border: 2px solid rgba(255,255,255,.65); }.story-viewer-top strong { display: block; font-size: 13px; }.story-viewer-top span { font-size: 10px; opacity: .7; }.story-quote { font-family: Georgia, serif; font-size: 31px; line-height: 1.08; letter-spacing: -.04em; max-width: 260px; }.story-caption { font-size: 12px; opacity: .78; line-height: 1.4; }.story-close { align-self: flex-end; width: 34px; height: 34px; color: #FFF; background: rgba(255,255,255,.13); border-radius: 12px; display: grid; place-items: center; }
      `}</style>

      <div className="app-body">
        <div className="status-bar">
          <span>9:41</span>
          <div className="status-right"><span>•••</span><span className="signal"><i /><i /><i /></span><span className="battery"><span /></span></div>
        </div>
        <header className="topbar">
          <button className="brand-lockup" onClick={() => showNotice("Old Time keeps your conversations close.")} aria-label="About Old Time">
            <span className="brand-mark"><img src="/__mockup/images/old-time-icon.png" alt="Old Time" /></span>
            <span><span className="eyebrow">Old Time</span><span className="page-title">Chats</span></span>
          </button>
          <div className="top-actions">
            <IconButton label="Open profile" onClick={() => setProfileOpen(true)}><CircleUserRound size={19} strokeWidth={1.8} /></IconButton>
            <IconButton label="Start a new chat" onClick={() => setComposerOpen(true)} accent><Edit3 size={18} strokeWidth={1.9} /></IconButton>
          </div>
        </header>

        <div className="intro">
          <p className="intro-copy">Good morning, <strong>Amelia</strong>.<br />A quiet place for the people you keep.</p>
          <span className="secure-chip"><ShieldCheck size={13} strokeWidth={1.8} /> Private by default</span>
        </div>

        <section className="stories-card" aria-label="Stories">
          <div className="section-head">
            <span className="section-title">Stories</span>
            <button className="section-action" onClick={() => showNotice("Stories archive is coming next.")}>See archive <ChevronRight size={13} /></button>
          </div>
          <div className="stories-list">
            {stories.map((story) => <StoryAvatar key={story.name} story={story} onClick={() => setStoryOpen(story)} />)}
          </div>
        </section>

        <div className="search-wrap">
          <Search size={17} strokeWidth={1.8} />
          <input className="search-input" aria-label="Search chats" placeholder="Search conversations" value={query} onChange={(event) => setQuery(event.target.value)} />
          {query ? <button className="search-clear" onClick={() => setQuery("")} aria-label="Clear search"><X size={15} /></button> : null}
        </div>

        <div className="list-header">
          <h1 className="list-title">{activeNav === "Chats" ? "Your conversations" : activeNav}</h1>
          <span className="list-count">{activeNav === "Chats" ? `${filteredConversations.length} threads` : "Preview"}</span>
        </div>

        {activeNav !== "Chats" ? (
          <div className="empty-search"><strong>{activeNav} is close by.</strong>This preview keeps the focus on your conversations. Use the Chats tab to return.</div>
        ) : filteredConversations.length === 0 ? (
          <div className="empty-search"><strong>No conversations found.</strong>Try a name or a phrase from a recent message.</div>
        ) : (
          <div className="chat-list">
            {filteredConversations.map((conversation) => (
              <button className="chat-row" key={conversation.name} onClick={() => showNotice(`Opening ${conversation.name}'s conversation`)}>
                <Avatar initials={conversation.initials} tone={conversation.tone} online={conversation.online} />
                <span className="chat-copy">
                  <span className="chat-topline">
                    <span className="chat-name">{conversation.name}{conversation.verified ? <span className="verified"><Check size={11} strokeWidth={3} /></span> : null}</span>
                    <span className="chat-time">{conversation.time}</span>
                  </span>
                  <span className="chat-bottomline">
                    <span className="chat-preview">{conversation.verified ? <span className="preview-check"><CheckCheck size={12} strokeWidth={2.4} /></span> : null}{conversation.message}{conversation.muted ? <BellOff className="muted-icon" size={12} /> : null}</span>
                    {conversation.unread ? <span className="unread">{conversation.unread}</span> : null}
                  </span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      <nav className="bottom-dock" aria-label="Primary navigation">
        {[
          { label: "Chats", icon: Menu },
          { label: "Stories", icon: Compass },
          { label: "Calls", icon: Phone },
          { label: "Settings", icon: SlidersHorizontal },
        ].map(({ label, icon: NavIcon }) => (
          <button className={`nav-item ${activeNav === label ? "active" : ""}`} key={label} onClick={() => { setActiveNav(label); if (label !== "Chats") showNotice(`${label} preview selected`); }} aria-label={`Open ${label}`}>
            <NavIcon size={18} strokeWidth={1.8} /><span>{label}</span>
          </button>
        ))}
      </nav>

      {notice ? <div className="notice" role="status">{notice}</div> : null}

      {composerOpen ? (
        <div className="scrim" onClick={() => setComposerOpen(false)}>
          <section className="sheet" onClick={(event) => event.stopPropagation()} aria-label="New message">
            <div className="sheet-grip" />
            <div className="sheet-head"><h2>New message</h2><button className="close-button" onClick={() => setComposerOpen(false)} aria-label="Close new message"><X size={16} /></button></div>
            <input className="compose-input" autoFocus placeholder="Search people or write a name" />
            <div className="compose-actions"><button className="compose-tool" onClick={() => showNotice("Attachments are ready for the real app.")}><Paperclip size={15} /> Attach</button><button className="compose-tool" onClick={() => showNotice("Your camera is ready for the real app.")}><ImagePlus size={15} /> Photo</button><button className="compose-tool" onClick={() => showNotice("Voice messages are ready for the real app.")}><Mic size={15} /> Voice</button></div>
            <button className="send-button" onClick={() => { setComposerOpen(false); showNotice("Choose a person to start a conversation."); }}><Send size={16} /> Continue</button>
          </section>
        </div>
      ) : null}

      {profileOpen ? (
        <div className="scrim" onClick={() => setProfileOpen(false)}>
          <section className="sheet profile-panel" onClick={(event) => event.stopPropagation()} aria-label="Profile">
            <div className="sheet-grip" />
            <div className="profile-banner">
              <div><h2>Amelia Moore</h2><p>Available to your circle</p></div>
              <span className="profile-card-avatar"><Avatar initials="AM" tone="brand" size="lg" online /></span>
            </div>
            <div className="profile-info">
              <button className="profile-row" onClick={() => showNotice("Profile details are ready to edit.")}><CircleUserRound size={19} /><span><p>Personal profile</p><small>amelia.moore · Seen recently</small></span><ChevronRight size={16} color="#9BA3AF" /></button>
              <button className="profile-row" onClick={() => showNotice("Your privacy settings are protected.")}><ShieldCheck size={19} /><span><p>Privacy & security</p><small>Private by default</small></span><ChevronRight size={16} color="#9BA3AF" /></button>
              <button className="profile-row" onClick={() => showNotice("Notification preferences opened.")}><Bell size={19} /><span><p>Notifications</p><small>Messages and story replies</small></span><ChevronRight size={16} color="#9BA3AF" /></button>
            </div>
          </section>
        </div>
      ) : null}

      {storyOpen ? (
        <div className="scrim story-viewer" onClick={() => setStoryOpen(null)}>
          <section className="story-viewer-card" onClick={(event) => event.stopPropagation()} aria-label={`${storyOpen.name}'s story`}>
            <button className="story-close" onClick={() => setStoryOpen(null)} aria-label="Close story"><X size={17} /></button>
            <div className="story-viewer-top"><Avatar initials={storyOpen.initials} tone={storyOpen.tone} size="sm" /><div><strong>{storyOpen.name}</strong><span>just now</span></div></div>
            <div><p className="story-quote">{storyOpen.name === "Your story" ? "What would you like to remember today?" : storyOpen.label}</p><p className="story-caption">A small moment, shared with the people who matter.</p></div>
          </section>
        </div>
      ) : null}
    </main>
  );
}