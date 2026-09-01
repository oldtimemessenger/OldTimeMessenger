import './_group.css';
import { useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
  Camera,
  Check,
  ChevronRight,
  CircleHelp,
  Clock3,
  Cloud,
  Image as ImageIcon,
  LockKeyhole,
  MapPin,
  Menu,
  MessageCircle,
  Mic,
  MoreHorizontal,
  Phone,
  Plus,
  Radio,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Sparkles,
  UserRound,
  Video,
  X,
} from 'lucide-react';

type ScreenName = 'auth' | 'chats' | 'chat' | 'updates' | 'map' | 'calls' | 'settings';

const navItems: { id: ScreenName; label: string; icon: typeof MessageCircle }[] = [
  { id: 'auth', label: 'Sign in', icon: LockKeyhole },
  { id: 'chats', label: 'Chats', icon: MessageCircle },
  { id: 'chat', label: 'Conversation', icon: MessageCircle },
  { id: 'updates', label: 'Updates', icon: Radio },
  { id: 'map', label: 'Map', icon: MapPin },
  { id: 'calls', label: 'Calls', icon: Phone },
  { id: 'settings', label: 'Settings', icon: Settings },
];

function Avatar({ name, tone = '#3b8fd6', size = 44 }: { name: string; tone?: string; size?: number }) {
  const initials = name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase();
  return (
    <span className="ot-avatar" style={{ width: size, height: size, background: tone, fontSize: Math.max(11, size * 0.3) }}>
      {initials}
    </span>
  );
}

function IconButton({ label, children, onClick }: { label: string; children: React.ReactNode; onClick?: () => void }) {
  return <button className="ot-icon-button" aria-label={label} onClick={onClick}>{children}</button>;
}

function AppHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <header className="ot-header">
      <h1>{title}</h1>
      {action}
    </header>
  );
}

function AuthScreen({ goTo }: { goTo: (screen: ScreenName) => void }) {
  const [phone, setPhone] = useState('');
  const [sent, setSent] = useState(false);
  return (
    <div className="ot-auth">
      <div className="ot-auth-hero">
        <div className="ot-orbit" />
        <img src="/__mockup/images/telegram-icon.png" alt="Old Time" className="ot-logo" />
        <div className="ot-brand">Old Time<span>.</span></div>
        <p>Private conversations. Real connections.</p>
      </div>
      <div className="ot-auth-form">
        <div className="ot-kicker">WELCOME BACK</div>
        <h2>Sign in to chat.</h2>
        {!sent ? (
          <>
            <label htmlFor="tour-phone">Phone number</label>
            <div className="ot-input-wrap">
              <Phone size={18} />
              <input id="tour-phone" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="(555) 014-2024" />
            </div>
            <p className="ot-helper">We will text a verification code to this number.</p>
            <button className="ot-primary-button" onClick={() => setSent(true)} disabled={!phone.trim()}>
              Continue <ArrowRight size={18} />
            </button>
          </>
        ) : (
          <>
            <div className="ot-code-card">
              <span className="ot-check"><Check size={16} /></span>
              <div><strong>Code sent to {phone}</strong><small>Enter the code from your SMS. It expires shortly.</small></div>
            </div>
            <label htmlFor="tour-code">Enter your code</label>
            <input id="tour-code" className="ot-otp" placeholder="000000" />
            <button className="ot-primary-button" onClick={() => goTo('chats')}>Open Old Time <ArrowRight size={18} /></button>
            <button className="ot-text-button" onClick={() => setSent(false)}>Use a different number</button>
          </>
        )}
        <div className="ot-auth-footer">
          <div><ShieldCheck size={16} color="#4dc24b" /> Private by default <span>/</span><i /> service is awake</div>
          <small><LockKeyhole size={12} /> Your number is only used to sign you in.</small>
        </div>
      </div>
    </div>
  );
}

function ChatsScreen({ goTo }: { goTo: (screen: ScreenName) => void }) {
  return (
    <>
      <AppHeader title="Chats" action={<IconButton label="New message"><Plus size={22} /></IconButton>} />
      <div className="ot-page">
        <div className="ot-search"><Search size={18} /><input placeholder="Search chats" /></div>
        <div className="ot-chat-list">
          <button className="ot-chat-row" onClick={() => goTo('chat')}>
            <Avatar name="Mia Harper" tone="#4c9b85" />
            <div className="ot-row-copy"><div><strong>Mia Harper</strong><time>10:42 AM</time></div><p>The studio photos are ready</p></div>
            <span className="ot-badge">2</span>
          </button>
          <button className="ot-chat-row" onClick={() => goTo('chat')}>
            <Avatar name="Jordan Lee" tone="#8a6bbe" />
            <div className="ot-row-copy"><div><strong>Jordan Lee</strong><time>Yesterday</time></div><p>Are we still on for Saturday?</p></div>
          </button>
          <button className="ot-chat-row" onClick={() => goTo('chat')}>
            <Avatar name="Sam Rivera" tone="#d18a43" />
            <div className="ot-row-copy"><div><strong>Sam Rivera</strong><time>Mon</time></div><p>Voice message</p></div>
          </button>
        </div>
      </div>
    </>
  );
}

function ChatScreen({ goTo }: { goTo: (screen: ScreenName) => void }) {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState(['The studio photos are ready', 'They look amazing — sending the final set now.']);
  function send() {
    if (!message.trim()) return;
    setMessages([...messages, message.trim()]);
    setMessage('');
  }
  return (
    <div className="ot-chat-screen">
      <header className="ot-chat-header">
        <IconButton label="Back" onClick={() => goTo('chats')}><ArrowLeft size={23} /></IconButton>
        <Avatar name="Mia Harper" tone="#4c9b85" size={40} />
        <div><strong>Mia Harper</strong><small>online</small></div>
        <IconButton label="Call Mia"><Phone size={20} /></IconButton>
      </header>
      <div className="ot-message-list">
        <div className="ot-day-divider">TODAY</div>
        {messages.map((text, index) => (
          <div className={`ot-message-line ${index === 1 ? 'mine' : ''}`} key={`${text}-${index}`}>
            <div className={`ot-bubble ${index === 1 ? 'mine' : ''}`}>
              <p>{text}</p>
              <small>{index === 0 ? '10:42 AM' : '10:43 AM'} {index === 1 ? '✓✓' : ''}</small>
              {index === 0 && <div className="ot-retention"><Clock3 size={13} /> 24s until removed <button>Save</button></div>}
            </div>
          </div>
        ))}
        <div className="ot-lock-note"><LockKeyhole size={15} /> Opened messages disappear after 30 seconds unless you save them.</div>
      </div>
      <div className="ot-composer">
        <IconButton label="Add attachment"><Plus size={22} /></IconButton>
        <input value={message} onChange={(event) => setMessage(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && send()} placeholder="Message" />
        {message ? <button className="ot-send" onClick={send}><Send size={17} /></button> : <IconButton label="Open camera"><Camera size={21} /></IconButton>}
      </div>
    </div>
  );
}

function UpdatesScreen() {
  const [tab, setTab] = useState('For You');
  return (
    <>
      <AppHeader title="Updates" action={<IconButton label="Create update"><Camera size={21} /></IconButton>} />
      <div className="ot-page ot-updates">
        <div className="ot-status-rail">
          <button><span className="ot-status-avatar your-status"><Avatar name="You" tone="#dfeefa" size={58} /><b><Plus size={14} /></b></span><small>Your status</small></button>
          {[
            ['Mia', '#4c9b85'], ['Jordan', '#8a6bbe'], ['Sam', '#d18a43'], ['Avery', '#d65a66'],
          ].map(([name, tone]) => <button key={name}><span className="ot-status-ring"><Avatar name={name} tone={tone} size={58} /></span><small>{name}</small></button>)}
        </div>
        <div className="ot-feed-tabs">{['For You', 'Following', 'Interests'].map((item) => <button key={item} className={tab === item ? 'active' : ''} onClick={() => setTab(item)}>{item}</button>)}</div>
        {tab === 'Interests' ? (
          <div className="ot-interest-card"><Sparkles size={25} color="#3b8fd6" /><h3>Choose your interests</h3><p>Pick topics so For You knows what to prioritize.</p><div className="ot-pills"><span>Music</span><span>Travel</span><span>Food</span><span>Art</span></div></div>
        ) : (
          <div className="ot-post-grid">
            {[
              ['#4b8fc8', 'Mia', '124'], ['#d65a66', 'Jordan', '88'], ['#5d9d84', 'Sam', '201'],
              ['#8a6bbe', 'Avery', '64'], ['#d18a43', 'Mia', '153'], ['#52748f', 'Jordan', '97'],
            ].map(([tone, author, likes], index) => <button className="ot-post-tile" style={{ background: tone }} key={index}><span>@{author.toLowerCase()}</span><small><Video size={12} /> {likes}</small></button>)}
          </div>
        )}
      </div>
    </>
  );
}

function MapScreen() {
  return (
    <>
      <AppHeader title="Location" />
      <div className="ot-map-page">
        <div className="ot-map-card">
          <div className="ot-map-icon"><MapPin size={34} /></div>
          <h2>Current location ready</h2>
          <p>40.71280, -74.00600</p>
          <button className="ot-primary-button"><MapPin size={18} /> Refresh location</button>
        </div>
        <div className="ot-map-preview">
          <div className="ot-map-grid" /><span className="ot-map-road road-a" /><span className="ot-map-road road-b" /><span className="ot-map-pin"><MapPin size={24} /></span>
          <div className="ot-map-label"><MapPin size={14} /> Your current location</div>
        </div>
        <div className="ot-map-actions"><button><MapPin size={20} /> Open in Maps</button><button><Send size={19} /> Share location</button></div>
      </div>
    </>
  );
}

function CallsScreen() {
  return (
    <>
      <AppHeader title="Calls" />
      <div className="ot-page ot-calls">
        <div className="ot-section-label">CONTACTS</div>
        {[
          ['Mia Harper', '555 014 2024', '#4c9b85'],
          ['Jordan Lee', '555 014 2331', '#8a6bbe'],
          ['Sam Rivera', '555 014 2048', '#d18a43'],
        ].map(([name, phone, tone]) => <button className="ot-call-row" key={name}><Avatar name={name} tone={tone} /><div><strong>{name}</strong><small>{phone}</small></div><Phone size={21} /></button>)}
        <div className="ot-section-label recent-label">RECENT</div>
        <div className="ot-call-row static"><Avatar name="Avery Kim" tone="#d65a66" /><div><strong>Avery Kim</strong><small className="green">Outgoing · Today, 9:18 AM</small></div><Phone size={18} /></div>
      </div>
    </>
  );
}

function SettingsScreen() {
  const rows = [
    ['profile', 'My Profile', 'Jammie Vercetti', UserRound, '#ff7a59'],
    ['saved', 'Saved Messages', '4', Bookmark, '#4c9cf5'],
    ['calls', 'Recent Calls', '', Phone, '#34c77e'],
    ['storage', 'Data and Storage', 'On device', Cloud, '#34c77e'],
    ['appearance', 'Appearance', '', Sparkles, '#26a69a'],
    ['chats', 'Chats', '', MessageCircle, '#26a69a'],
    ['faq', 'Old Time FAQ', '', CircleHelp, '#26a69a'],
  ] as const;
  return (
    <>
      <AppHeader title="Settings" />
      <div className="ot-page ot-settings">
        <div className="ot-search"><Search size={18} /><input placeholder="Search settings" /></div>
        <div className="ot-settings-group">
          {rows.map(([id, label, detail, Icon, bg]) => <button className="ot-setting-row" key={id}><span style={{ background: bg }}><Icon size={16} /></span><div><strong>{label}</strong>{detail && <small>{detail}</small>}</div><ChevronRight size={18} /></button>)}
        </div>
        <button className="ot-logout"><span><ArrowLeft size={16} /></span>Log Out</button>
      </div>
    </>
  );
}

function ScreenContent({ screen, goTo }: { screen: ScreenName; goTo: (screen: ScreenName) => void }) {
  switch (screen) {
    case 'auth': return <AuthScreen goTo={goTo} />;
    case 'chat': return <ChatScreen goTo={goTo} />;
    case 'updates': return <UpdatesScreen />;
    case 'map': return <MapScreen />;
    case 'calls': return <CallsScreen />;
    case 'settings': return <SettingsScreen />;
    default: return <ChatsScreen goTo={goTo} />;
  }
}

export function OldTimeMobileTour() {
  const [screen, setScreen] = useState<ScreenName>('chats');
  return (
    <div className="ot-tour-shell">
      <div className="ot-tour-toolbar">
        <div className="ot-tour-title"><span className="ot-tour-mark">O</span><strong>Old Time</strong><small>mobile app tour</small></div>
        <div className="ot-tour-nav">
          {navItems.map(({ id, label, icon: Icon }) => <button key={id} className={screen === id ? 'active' : ''} onClick={() => setScreen(id)}><Icon size={14} />{label}</button>)}
        </div>
      </div>
      <div className="ot-phone">
        <div className="ot-phone-status"><span>9:41</span><span>▮▮▮ ᯤ</span></div>
        <ScreenContent screen={screen} goTo={setScreen} />
        {screen !== 'auth' && screen !== 'chat' && <nav className="ot-bottom-nav">
          {[
            ['chats', 'Chats', MessageCircle], ['updates', 'Updates', Radio], ['map', 'Map', MapPin], ['calls', 'Calls', Phone], ['settings', 'Settings', Settings],
          ].map(([id, label, Icon]) => <button key={id as string} className={screen === id ? 'active' : ''} onClick={() => setScreen(id as ScreenName)}><Icon size={19} /><span>{label as string}</span></button>)}
        </nav>}
      </div>
    </div>
  );
}