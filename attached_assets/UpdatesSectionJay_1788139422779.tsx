import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import {
  Heart, MessageCircle, Bookmark, Forward, Music2, Plus,
  UserPlus, Home, Compass, MessageSquare, Bell, X,
  Send, ChevronLeft, Volume2, VolumeX, MapPin, Camera,
  Settings, Edit3, Grid3x3
} from "lucide-react";

// ---------------- Seed data ----------------

const TAGS = ["comedy", "music", "food", "fitness", "travel", "tech", "art", "sports", "fashion", "gaming"];
const MY_LOCATION = "Miami, FL";

const CREATORS = [
  { handle: "reelchef", name: "Reel Chef", tags: ["food"], location: "Miami, FL", grad: "linear-gradient(135deg,#E8963C,#F0537A)" },
  { handle: "beatsbytee", name: "Tee Beats", tags: ["music"], location: "Atlanta, GA", grad: "linear-gradient(135deg,#8B5CF6,#4C63F5)" },
  { handle: "coach.dre", name: "Coach Dre", tags: ["fitness","sports"], location: "Miami, FL", grad: "linear-gradient(135deg,#34C77E,#26A69A)" },
  { handle: "wanderluxe", name: "Wanderluxe", tags: ["travel"], location: "Lisbon, PT", grad: "linear-gradient(135deg,#4C9CF5,#26A69A)" },
  { handle: "pixel.mo", name: "Pixel Mo", tags: ["tech","gaming"], location: "Austin, TX", grad: "linear-gradient(135deg,#6C7280,#1C1C1E)" },
  { handle: "sketchbyash", name: "Sketch by Ash", tags: ["art"], location: "Miami, FL", grad: "linear-gradient(135deg,#F0537A,#8B5CF6)" },
  { handle: "fitwithmaya", name: "Maya Fit", tags: ["fitness"], location: "Miami, FL", grad: "linear-gradient(135deg,#34C77E,#4C63F5)" },
  { handle: "drip.theo", name: "Theo Drip", tags: ["fashion"], location: "New York, NY", grad: "linear-gradient(135deg,#E8963C,#8B5CF6)" },
];

function seedPosts() {
  const captions = {
    food: "5-minute garlic butter shrimp 🍤🔥 #recipe",
    music: "new beat dropping this friday 🎧",
    fitness: "leg day at the beach 🏝️ who's joining",
    travel: "3am rooftop in Lisbon 🌙",
    tech: "this setting changed my whole workflow 💻",
    art: "3hr speed sketch, timelapse 🎨",
    sports: "game-winner at the buzzer 🏀",
    fashion: "thrifted this whole fit for $40 👀",
    gaming: "clutch 1v4 no cap 🎮",
    comedy: "when your wifi disconnects mid-meeting 💀",
  };
  let id = 1;
  const posts = [];
  CREATORS.forEach((c) => {
    c.tags.forEach((tag) => {
      posts.push({
        id: id++,
        creator: c,
        tags: [tag, ...(Math.random() > 0.6 ? [TAGS[Math.floor(Math.random() * TAGS.length)]] : [])],
        location: c.location,
        caption: captions[tag],
        sound: `${c.name} · original sound`,
        likes: Math.floor(200 + Math.random() * 4000),
        comments: [
          { user: "jade_", text: "this is so good 😭" },
          { user: "marcusv", text: "need the full tutorial" },
        ],
        commentCount: Math.floor(20 + Math.random() * 300),
        shares: Math.floor(5 + Math.random() * 150),
      });
    });
  });
  // add a couple comedy posts from a generic creator
  const comedyCreator = { handle: "lol.dani", name: "Dani", tags: ["comedy"], location: "Miami, FL", grad: "linear-gradient(135deg,#F0537A,#E8963C)" };
  posts.push({ id: id++, creator: comedyCreator, tags: ["comedy"], location: "Miami, FL", caption: captions.comedy, sound: "Dani · original sound", likes: 5200, comments: [{ user: "yaz", text: "literally me" }], commentCount: 410, shares: 88 });
  return posts;
}

function initialsOf(n) { return n.split(" ").map((p) => p[0]).slice(0, 2).join(""); }
function fmt(n) { return n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n); }

// ---------------- Feed post ----------------

function FeedPost({ post, active, liked, saved, following, onLike, onSave, onFollow, onComment, onShare, onSound, onOpenProfile, muted, setMuted }) {
  const [showHeart, setShowHeart] = useState(false);
  function doubleTapLike() {
    if (!liked) onLike();
    setShowHeart(true);
    setTimeout(() => setShowHeart(false), 700);
  }
  return (
    <div className="relative w-full h-full shrink-0 snap-start overflow-hidden" style={{ background: post.creator.grad }}>
      <div className="absolute inset-0" onDoubleClick={doubleTapLike} style={{ background: "radial-gradient(circle at 30% 20%, rgba(255,255,255,0.12), transparent 60%)" }} />
      {showHeart && (
        <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
          <Heart size={110} className="text-white drop-shadow-lg" fill="white" style={{ animation: "popHeart .7s ease" }} />
        </div>
      )}

      {/* mute toggle */}
      <button onClick={() => setMuted((m) => !m)} className="absolute top-14 right-4 z-10 w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "rgba(0,0,0,0.3)" }}>
        {muted ? <VolumeX size={15} className="text-white" /> : <Volume2 size={15} className="text-white" />}
      </button>

      {/* right action rail */}
      <div className="absolute right-3 bottom-28 flex flex-col items-center gap-5 z-10">
        <button onClick={() => onOpenProfile(post.creator)} className="flex flex-col items-center">
          <div className="w-12 h-12 rounded-full border-2 border-white flex items-center justify-center text-white text-[14px] font-bold" style={{ background: post.creator.grad }}>
            {initialsOf(post.creator.name)}
          </div>
          {!following && (
            <button onClick={(e) => { e.stopPropagation(); onFollow(); }} className="w-5 h-5 rounded-full -mt-2 flex items-center justify-center" style={{ background: "#F0537A" }}>
              <Plus size={12} className="text-white" />
            </button>
          )}
        </button>

        <button onClick={onLike} className="flex flex-col items-center gap-1">
          <Heart size={30} className="text-white" fill={liked ? "#F0537A" : "none"} style={{ color: liked ? "#F0537A" : "white" }} />
          <span className="text-white text-[11.5px] font-medium">{fmt(post.likes)}</span>
        </button>

        <button onClick={onComment} className="flex flex-col items-center gap-1">
          <MessageCircle size={28} className="text-white" />
          <span className="text-white text-[11.5px] font-medium">{fmt(post.commentCount)}</span>
        </button>

        <button onClick={onSave} className="flex flex-col items-center gap-1">
          <Bookmark size={26} className="text-white" fill={saved ? "#FFD54A" : "none"} style={{ color: saved ? "#FFD54A" : "white" }} />
          <span className="text-white text-[11.5px] font-medium">Save</span>
        </button>

        <button onClick={onShare} className="flex flex-col items-center gap-1">
          <Forward size={27} className="text-white" />
          <span className="text-white text-[11.5px] font-medium">{fmt(post.shares)}</span>
        </button>

        <button onClick={onSound} className="w-9 h-9 rounded-full flex items-center justify-center mt-1" style={{ background: post.creator.grad, animation: active ? "spin 4s linear infinite" : "none", border: "2px solid rgba(255,255,255,0.5)" }}>
          <Music2 size={14} className="text-white" />
        </button>
      </div>

      {/* bottom info */}
      <div className="absolute left-4 right-16 bottom-8 z-10">
        <div className="flex items-center gap-2 mb-1.5">
          <button onClick={() => onOpenProfile(post.creator)} className="text-white text-[15px] font-bold">@{post.creator.handle}</button>
          {!following && (
            <button onClick={onFollow} className="text-white text-[11.5px] font-semibold border border-white rounded-md px-2 py-0.5">Follow</button>
          )}
        </div>
        <div className="text-white text-[13.5px] leading-snug mb-1.5">{post.caption}</div>
        <div className="flex items-center gap-2 flex-wrap mb-1.5">
          {post.tags.map((t) => <span key={t} className="text-[#FFD54A] text-[12.5px] font-medium">#{t}</span>)}
        </div>
        <div className="flex items-center gap-1 text-white/80 text-[12px]">
          <MapPin size={11} /> {post.location}
        </div>
        <div className="flex items-center gap-1.5 mt-1.5 text-white/85 text-[12px]">
          <Music2 size={11} /> <span className="truncate max-w-[200px]">{post.sound}</span>
        </div>
      </div>
    </div>
  );
}

// ---------------- Comments sheet ----------------

function CommentsSheet({ post, onClose, onAddComment }) {
  const [text, setText] = useState("");
  return (
    <div className="absolute inset-0 z-40 flex items-end" style={{ background: "rgba(0,0,0,0.5)" }} onClick={onClose}>
      <div className="w-full bg-[#161618] rounded-t-3xl max-h-[70%] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <span className="text-white text-[14px] font-semibold">{post.commentCount} comments</span>
          <button onClick={onClose} className="text-white/60"><X size={20} /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 space-y-3 py-2">
          {post.comments.map((c, i) => (
            <div key={i} className="flex gap-2.5">
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[11px] font-semibold shrink-0" style={{ background: "linear-gradient(135deg,#4C63F5,#34C77E)" }}>{c.user[0].toUpperCase()}</div>
              <div>
                <div className="text-white/60 text-[12px]">@{c.user}</div>
                <div className="text-white text-[14px]">{c.text}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2 px-4 py-3 border-t border-white/10">
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Add comment..."
            className="flex-1 bg-white/10 rounded-full px-4 py-2.5 text-[14px] text-white outline-none placeholder:text-white/40" />
          <button onClick={() => { if (text.trim()) { onAddComment(text.trim()); setText(""); } }} className="text-[#5B6EF5] font-semibold text-[14px]">Post</button>
        </div>
      </div>
    </div>
  );
}

// ---------------- Creator profile (in-section only) ----------------

function CreatorProfile({ creator, following, onFollow, onBack, onMessage, postsCount }) {
  return (
    <div className="absolute inset-0 z-30 bg-[#0C0C0E] flex flex-col">
      <div className="flex items-center gap-3 px-4 pt-12 pb-3">
        <button onClick={onBack} className="text-white"><ChevronLeft size={24} /></button>
        <span className="text-white text-[16px] font-semibold">@{creator.handle}</span>
      </div>
      <div className="flex flex-col items-center gap-2 py-4">
        <div className="w-20 h-20 rounded-full flex items-center justify-center text-white text-2xl font-bold" style={{ background: creator.grad }}>{initialsOf(creator.name)}</div>
        <div className="text-white text-[16px] font-semibold">{creator.name}</div>
        <div className="text-white/50 text-[13px]">{creator.location}</div>
        <div className="flex gap-6 mt-2">
          <div className="text-center"><div className="text-white font-semibold text-[15px]">{postsCount}</div><div className="text-white/50 text-[11.5px]">Posts</div></div>
          <div className="text-center"><div className="text-white font-semibold text-[15px]">{fmt(12000 + creator.handle.length * 733)}</div><div className="text-white/50 text-[11.5px]">Followers</div></div>
          <div className="text-center"><div className="text-white font-semibold text-[15px]">{creator.tags.length}</div><div className="text-white/50 text-[11.5px]">Interests</div></div>
        </div>
        <div className="flex gap-2 mt-3">
          <button onClick={onFollow} className="px-6 py-2 rounded-full text-[14px] font-semibold" style={{ background: following ? "rgba(255,255,255,0.12)" : "#F0537A", color: "white" }}>
            {following ? "Following" : "Follow"}
          </button>
          <button onClick={onMessage} className="px-6 py-2 rounded-full text-[14px] font-semibold bg-white/10 text-white">Message</button>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-0.5 mt-2 px-0.5">
        {creator.tags.concat(creator.tags).slice(0, 9).map((t, i) => (
          <div key={i} className="aspect-[3/4] flex items-center justify-center text-white/80 text-[11px]" style={{ background: `linear-gradient(160deg, ${creator.grad.match(/#[0-9A-Fa-f]{6}/g)?.[0] || "#333"}, #111)` }}>
            #{t}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------- Your Updates profile (only reachable inside this section) ----------------

function MyProfile({ profile, following, likedCount, savedCount, myPosts, onCreatePost, onOpenSettings, onEditProfile }) {
  const [tab, setTab] = useState("posts");
  return (
    <div className="absolute inset-0 z-10 bg-[#0C0C0E] overflow-y-auto">
      <div className="flex items-center justify-between px-4 pt-12 pb-2">
        <span className="text-white text-[16px] font-semibold">@{profile.handle}</span>
        <button onClick={onOpenSettings} className="text-white/70"><Settings size={20} /></button>
      </div>
      <div className="flex flex-col items-center gap-2 py-4">
        <div className="w-20 h-20 rounded-full flex items-center justify-center text-white text-2xl font-bold" style={{ background: profile.grad }}>{initialsOf(profile.name)}</div>
        <div className="text-white text-[16px] font-semibold">{profile.name}</div>
        <div className="text-white/50 text-[13px] text-center px-10">{profile.bio}</div>
        <div className="text-[10.5px] text-white/30 mt-0.5">This profile only shows here in Updates — separate from your phone contacts.</div>
        <div className="flex gap-6 mt-2">
          <div className="text-center"><div className="text-white font-semibold text-[15px]">{myPosts.length}</div><div className="text-white/50 text-[11.5px]">Posts</div></div>
          <div className="text-center"><div className="text-white font-semibold text-[15px]">{following.size}</div><div className="text-white/50 text-[11.5px]">Following</div></div>
          <div className="text-center"><div className="text-white font-semibold text-[15px]">{fmt(likedCount * 340 + 812)}</div><div className="text-white/50 text-[11.5px]">Followers</div></div>
        </div>
        <button onClick={onEditProfile} className="flex items-center gap-1.5 px-5 py-2 rounded-full bg-white/10 text-white text-[13.5px] font-medium mt-2"><Edit3 size={13} /> Edit Profile</button>
      </div>
      <div className="flex border-t border-white/10 mt-2">
        {["posts", "saved"].map((t) => (
          <button key={t} onClick={() => setTab(t)} className="flex-1 py-2.5 text-[13px] font-medium flex items-center justify-center gap-1.5" style={{ color: tab === t ? "white" : "rgba(255,255,255,0.4)", borderBottom: tab === t ? "2px solid white" : "2px solid transparent" }}>
            {t === "posts" ? <Grid3x3 size={14} /> : <Bookmark size={14} />} {t === "posts" ? "Posts" : `Saved (${savedCount})`}
          </button>
        ))}
      </div>
      {tab === "posts" && (
        <div className="grid grid-cols-3 gap-0.5 mt-0.5">
          <button onClick={onCreatePost} className="aspect-[3/4] flex flex-col items-center justify-center gap-1 bg-white/5 text-white/60">
            <Plus size={22} /><span className="text-[11px]">New Post</span>
          </button>
          {myPosts.map((p) => (
            <div key={p.id} className="aspect-[3/4] flex items-end p-1.5 text-white text-[10.5px]" style={{ background: p.grad }}>{p.caption.slice(0, 24)}</div>
          ))}
        </div>
      )}
      {tab === "saved" && savedCount === 0 && <div className="text-center text-white/40 text-[13px] mt-10">No saved posts yet</div>}
    </div>
  );
}

// ---------------- Create post ----------------

function CreatePost({ onClose, onPost }) {
  const [caption, setCaption] = useState("");
  const [tag, setTag] = useState(TAGS[0]);
  const [grad, setGrad] = useState("linear-gradient(135deg,#5B6EF5,#34C77E)");
  const GRADS = ["linear-gradient(135deg,#5B6EF5,#34C77E)", "linear-gradient(135deg,#F0537A,#E8963C)", "linear-gradient(135deg,#8B5CF6,#4C63F5)", "linear-gradient(135deg,#26A69A,#4C9CF5)"];
  return (
    <div className="absolute inset-0 z-40 flex flex-col" style={{ background: grad }}>
      <div className="flex items-center justify-between px-4 pt-12 pb-2">
        <button onClick={onClose} className="text-white"><X size={24} /></button>
        <span className="text-white text-[15px] font-medium">New Post</span>
        <button onClick={() => { if (caption.trim()) onPost({ caption: caption.trim(), tag, grad }); }} className="text-white text-[15px] font-semibold">Post</button>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center gap-4 px-8">
        <Camera size={34} className="text-white/70" />
        <textarea autoFocus value={caption} onChange={(e) => setCaption(e.target.value)} rows={3} placeholder="Write a caption..."
          className="w-full bg-transparent text-white text-[19px] font-medium text-center outline-none placeholder:text-white/60 resize-none" />
        <div className="flex gap-2 flex-wrap justify-center">
          {TAGS.map((t) => (
            <button key={t} onClick={() => setTag(t)} className="px-3 py-1.5 rounded-full text-[12.5px] font-medium" style={{ background: tag === t ? "white" : "rgba(255,255,255,0.2)", color: tag === t ? "#111" : "white" }}>#{t}</button>
          ))}
        </div>
      </div>
      <div className="flex items-center justify-center gap-3 pb-10">
        {GRADS.map((g) => <button key={g} onClick={() => setGrad(g)} className="w-8 h-8 rounded-full" style={{ background: g, outline: grad === g ? "3px solid white" : "none", outlineOffset: 2 }} />)}
      </div>
    </div>
  );
}

// ---------------- Inbox (section-only, separate from phone-number chat) ----------------

function Inbox({ conversations, onOpen, onBack, requests, onOpenRequest }) {
  return (
    <div className="absolute inset-0 z-20 bg-[#0C0C0E] flex flex-col">
      <div className="flex items-center gap-3 px-4 pt-12 pb-3">
        <button onClick={onBack} className="text-white"><ChevronLeft size={24} /></button>
        <span className="text-white text-[17px] font-semibold">Inbox</span>
      </div>
      <div className="px-4 pb-2 text-[11.5px] text-white/35">Separate from your phone contacts — only people you follow or interact with here can reach you.</div>
      {requests.length > 0 && (
        <div className="px-4 pt-1 pb-1">
          <span className="text-white/70 text-[13px] font-medium">Message requests · {requests.length}</span>
        </div>
      )}
      {requests.map((c) => (
        <button key={c.id} onClick={() => onOpenRequest(c)} className="w-full flex items-center gap-3 px-4 py-3">
          <div className="w-11 h-11 rounded-full flex items-center justify-center text-white text-[13px] font-semibold shrink-0" style={{ background: c.grad }}>{initialsOf(c.name)}</div>
          <div className="flex-1 text-left min-w-0">
            <div className="text-white text-[14.5px] font-medium">{c.name}</div>
            <div className="text-[#F0537A] text-[12px]">Wants to message you</div>
          </div>
          <span className="w-2.5 h-2.5 rounded-full bg-[#F0537A]" />
        </button>
      ))}
      {requests.length > 0 && conversations.length > 0 && <div className="mx-4 h-px bg-white/10 my-1" />}
      <div className="flex-1 overflow-y-auto">
        {conversations.map((c) => (
          <button key={c.id} onClick={() => onOpen(c)} className="w-full flex items-center gap-3 px-4 py-3">
            <div className="w-11 h-11 rounded-full flex items-center justify-center text-white text-[13px] font-semibold shrink-0" style={{ background: c.grad }}>{initialsOf(c.name)}</div>
            <div className="flex-1 text-left min-w-0">
              <div className="text-white text-[14.5px] font-medium">{c.name}</div>
              <div className="text-white/45 text-[12.5px] truncate">{c.lastMsg}</div>
            </div>
            {c.unread > 0 && <span className="text-[10.5px] font-bold text-white rounded-full px-1.5 py-0.5" style={{ background: "#F0537A" }}>{c.unread}</span>}
          </button>
        ))}
        {conversations.length === 0 && requests.length === 0 && <div className="text-white/40 text-[13px] text-center mt-10">No messages yet</div>}
      </div>
    </div>
  );
}

function Conversation({ convo, isRequest, onBack, onSend, onAccept, onDecline }) {
  const [text, setText] = useState("");
  function send() {
    if (!text.trim()) return;
    if (isRequest) onAccept();
    onSend(text.trim());
    setText("");
  }
  return (
    <div className="absolute inset-0 z-30 bg-[#0C0C0E] flex flex-col">
      <div className="flex items-center gap-3 px-4 pt-12 pb-3 border-b border-white/10">
        <button onClick={onBack} className="text-white"><ChevronLeft size={24} /></button>
        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[11px] font-semibold" style={{ background: convo.grad }}>{initialsOf(convo.name)}</div>
        <span className="text-white text-[15px] font-medium">{convo.name}</span>
      </div>
      {isRequest && (
        <div className="flex items-center justify-between px-4 py-3 bg-white/5">
          <span className="text-white/60 text-[12.5px]">Accept to reply, or decline this request</span>
          <div className="flex gap-2">
            <button onClick={onDecline} className="px-3 py-1.5 rounded-full text-[12.5px] font-medium bg-white/10 text-white">Decline</button>
            <button onClick={onAccept} className="px-3 py-1.5 rounded-full text-[12.5px] font-medium text-white" style={{ background: "#34C77E" }}>Accept</button>
          </div>
        </div>
      )}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
        {convo.messages.map((m, i) => (
          <div key={i} className={`flex ${m.from === "me" ? "justify-end" : "justify-start"}`}>
            <div className="rounded-2xl px-3.5 py-2 max-w-[75%] text-[14px]" style={{ background: m.from === "me" ? "#5B6EF5" : "rgba(255,255,255,0.1)", color: "white" }}>{m.text}</div>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 px-3 py-3 border-t border-white/10">
        <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder={isRequest ? "Message to accept..." : "Message..."} className="flex-1 bg-white/10 rounded-full px-4 py-2.5 text-[14px] text-white outline-none placeholder:text-white/40" />
        <button onClick={send} className="w-9 h-9 rounded-full flex items-center justify-center bg-[#5B6EF5]"><Send size={15} className="text-white" /></button>
      </div>
    </div>
  );
}

// ---------------- Notifications (section-only) ----------------

function Notifications({ items, onBack }) {
  return (
    <div className="absolute inset-0 z-30 bg-[#0C0C0E] flex flex-col">
      <div className="flex items-center gap-3 px-4 pt-12 pb-3">
        <button onClick={onBack} className="text-white"><ChevronLeft size={24} /></button>
        <span className="text-white text-[17px] font-semibold">Activity</span>
      </div>
      <div className="flex-1 overflow-y-auto px-4 space-y-3 py-2">
        {items.length === 0 && <div className="text-white/40 text-[13px] text-center mt-10">No activity yet</div>}
        {items.map((n, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: n.type === "like" ? "#F0537A33" : n.type === "follow" ? "#5B6EF533" : "#34C77E33" }}>
              {n.type === "like" ? <Heart size={15} style={{ color: "#F0537A" }} /> : n.type === "follow" ? <UserPlus size={15} style={{ color: "#5B6EF5" }} /> : <MessageCircle size={15} style={{ color: "#34C77E" }} />}
            </div>
            <div className="flex-1 text-white text-[13.5px]">{n.text}</div>
            <span className="text-white/30 text-[11px]">{n.time}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------- Explore ----------------

function Explore({ posts, weights, onOpenTag, onOpenPost }) {
  const sortedTags = [...TAGS].sort((a, b) => (weights[b] || 1) - (weights[a] || 1));
  return (
    <div className="absolute inset-0 z-10 bg-[#0C0C0E] overflow-y-auto pt-14 px-3">
      <div className="text-white text-[16px] font-semibold px-1 mb-3">Explore</div>
      <div className="flex gap-2 flex-wrap mb-4 px-1">
        {sortedTags.map((t) => (
          <button key={t} onClick={() => onOpenTag(t)} className="px-3 py-1.5 rounded-full text-[12.5px] font-medium bg-white/10 text-white">#{t}</button>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-1">
        {posts.map((p) => (
          <button key={p.id} onClick={() => onOpenPost(p)} className="aspect-[3/4] flex items-end p-1.5 text-white text-[10px]" style={{ background: p.creator.grad }}>
            @{p.creator.handle}
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------------- Sound sheet ----------------

function SoundSheet({ post, saved, onSave, onClose }) {
  return (
    <div className="absolute inset-0 z-40 flex items-end" style={{ background: "rgba(0,0,0,0.5)" }} onClick={onClose}>
      <div className="w-full bg-[#161618] rounded-t-3xl p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: post.creator.grad, animation: "spin 4s linear infinite" }}>
            <Music2 size={18} className="text-white" />
          </div>
          <div>
            <div className="text-white text-[15px] font-medium">{post.sound}</div>
            <div className="text-white/50 text-[12.5px]">{fmt(Math.floor(post.likes / 3))} videos use this sound</div>
          </div>
        </div>
        <button onClick={onSave} className="w-full py-2.5 rounded-full text-[14px] font-semibold" style={{ background: saved ? "rgba(255,255,255,0.12)" : "#5B6EF5", color: "white" }}>
          {saved ? "Saved to Sounds ✓" : "Save Sound"}
        </button>
      </div>
    </div>
  );
}

// ---------------- Settings (Updates-only) ----------------

function UpdatesSettings({ settings, onChange, onBack }) {
  const Row = ({ label, sub, children }) => (
    <div className="flex items-center justify-between px-4 py-3.5 border-b border-white/8">
      <div>
        <div className="text-white text-[14.5px]">{label}</div>
        {sub && <div className="text-white/40 text-[12px] mt-0.5">{sub}</div>}
      </div>
      {children}
    </div>
  );
  const Toggle = ({ on, onClick }) => (
    <button onClick={onClick} className="w-11 h-6 rounded-full relative" style={{ background: on ? "#34C77E" : "rgba(255,255,255,0.15)" }}>
      <span className="absolute top-[2px] left-[2px] w-5 h-5 bg-white rounded-full transition-transform" style={{ transform: on ? "translateX(20px)" : "translateX(0)" }} />
    </button>
  );
  return (
    <div className="absolute inset-0 z-30 bg-[#0C0C0E] flex flex-col">
      <div className="flex items-center gap-3 px-4 pt-12 pb-3">
        <button onClick={onBack} className="text-white"><ChevronLeft size={24} /></button>
        <span className="text-white text-[17px] font-semibold">Updates Settings</span>
      </div>
      <Row label="Private Account" sub="Only approved followers see your posts">
        <Toggle on={settings.privateAccount} onClick={() => onChange({ ...settings, privateAccount: !settings.privateAccount })} />
      </Row>
      <Row label="Show Location on Posts" sub="Displays city on new posts">
        <Toggle on={settings.showLocation} onClick={() => onChange({ ...settings, showLocation: !settings.showLocation })} />
      </Row>
      <Row label="Who Can Message You" sub="Controls Inbox requests">
        <button
          onClick={() => onChange({ ...settings, whoCanMessage: settings.whoCanMessage === "everyone" ? "following" : settings.whoCanMessage === "following" ? "noone" : "everyone" })}
          className="text-[13px] font-medium px-3 py-1.5 rounded-full bg-white/10 text-white capitalize"
        >
          {settings.whoCanMessage === "noone" ? "No One" : settings.whoCanMessage}
        </button>
      </Row>
      <Row label="Personalized For You" sub="Use likes & follows to rank your feed">
        <Toggle on={settings.personalized} onClick={() => onChange({ ...settings, personalized: !settings.personalized })} />
      </Row>
    </div>
  );
}

// ---------------- Edit profile ----------------

function EditProfile({ profile, onSave, onBack }) {
  const [name, setName] = useState(profile.name);
  const [bio, setBio] = useState(profile.bio);
  const GRADS = ["linear-gradient(135deg,#5B6EF5,#34C77E)", "linear-gradient(135deg,#F0537A,#E8963C)", "linear-gradient(135deg,#8B5CF6,#4C63F5)", "linear-gradient(135deg,#26A69A,#4C9CF5)"];
  const [grad, setGrad] = useState(profile.grad);
  return (
    <div className="absolute inset-0 z-30 bg-[#0C0C0E] flex flex-col">
      <div className="flex items-center justify-between px-4 pt-12 pb-3">
        <button onClick={onBack} className="text-white"><ChevronLeft size={24} /></button>
        <span className="text-white text-[16px] font-semibold">Edit Profile</span>
        <button onClick={() => onSave({ ...profile, name: name.trim() || profile.name, bio: bio.trim(), grad })} className="text-[#5B6EF5] text-[15px] font-semibold">Save</button>
      </div>
      <div className="flex flex-col items-center gap-3 py-5">
        <div className="w-20 h-20 rounded-full flex items-center justify-center text-white text-2xl font-bold" style={{ background: grad }}>{initialsOf(name || profile.name)}</div>
        <div className="flex gap-2">
          {GRADS.map((g) => <button key={g} onClick={() => setGrad(g)} className="w-7 h-7 rounded-full" style={{ background: g, outline: grad === g ? "2px solid white" : "none", outlineOffset: 2 }} />)}
        </div>
      </div>
      <div className="px-5 space-y-4">
        <div>
          <div className="text-white/50 text-[12px] mb-1">Name</div>
          <input value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-white/10 rounded-xl px-3.5 py-2.5 text-white text-[15px] outline-none" />
        </div>
        <div>
          <div className="text-white/50 text-[12px] mb-1">Bio</div>
          <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} className="w-full bg-white/10 rounded-xl px-3.5 py-2.5 text-white text-[15px] outline-none resize-none" />
        </div>
      </div>
    </div>
  );
}

// ---------------- Main ----------------

export default function UpdatesSection() {
  const [postsState, setPostsState] = useState(seedPosts);
  const [myPosts, setMyPosts] = useState([]);
  const [following, setFollowing] = useState(new Set(["coach.dre", "sketchbyash"]));
  const [liked, setLiked] = useState(new Set());
  const [saved, setSaved] = useState(new Set());
  const [savedSounds, setSavedSounds] = useState(new Set());
  const [weights, setWeights] = useState(() => Object.fromEntries(TAGS.map((t) => [t, 1])));
  const [tab, setTab] = useState("forYou"); // forYou | following | tag
  const [tagFilter, setTagFilter] = useState(null);
  const [singlePost, setSinglePost] = useState(null); // when opened from Explore grid
  const [view, setView] = useState("feed");
  const [prevView, setPrevView] = useState("feed");
  const [selectedCreator, setSelectedCreator] = useState(null);
  const [commentPostId, setCommentPostId] = useState(null);
  const [soundPostId, setSoundPostId] = useState(null);
  const [muted, setMuted] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [notifs, setNotifs] = useState([{ type: "follow", text: "coach.dre started following you", time: "1h" }]);
  const [toast, setToast] = useState(null);
  const [profile, setProfile] = useState({ name: "King Castani", handle: "kc.creates", bio: "making things · Miami 🌴", grad: "linear-gradient(135deg,#5B6EF5,#34C77E)" });
  const [settings, setSettings] = useState({ privateAccount: false, showLocation: true, whoCanMessage: "everyone", personalized: true });
  const flash = (m) => { setToast(m); setTimeout(() => setToast(null), 1300); };
  const containerRef = useRef(null);
  const viewedRef = useRef(new Set());

  function goTo(next) { setPrevView(view); setView(next); }

  const [conversations, setConversations] = useState([
    { id: 1, name: "Coach Dre", grad: "linear-gradient(135deg,#34C77E,#26A69A)", lastMsg: "Saw your comment 🔥 let's collab", unread: 2, messages: [{ from: "them", text: "Saw your comment 🔥 let's collab" }] },
    { id: 2, name: "Sketch by Ash", grad: "linear-gradient(135deg,#F0537A,#8B5CF6)", lastMsg: "thanks for the follow!", unread: 0, messages: [{ from: "them", text: "thanks for the follow!" }] },
  ]);
  const [requests, setRequests] = useState([
    { id: 3, name: "Wanderluxe", grad: "linear-gradient(135deg,#4C9CF5,#26A69A)", lastMsg: "loved your last post!", unread: 1, messages: [{ from: "them", text: "loved your last post!" }] },
  ]);
  const [openConvo, setOpenConvo] = useState(null);
  const [openConvoIsRequest, setOpenConvoIsRequest] = useState(false);

  function boost(tags, amt) {
    setWeights((w) => {
      const next = { ...w };
      tags.forEach((t) => { next[t] = (next[t] || 1) + amt; });
      return next;
    });
  }

  const forYouRanked = useMemo(() => {
    return [...postsState]
      .map((p) => {
        const tagScore = settings.personalized ? p.tags.reduce((s, t) => s + (weights[t] || 1), 0) : p.tags.length;
        const locBonus = p.location === MY_LOCATION ? 6 : 0;
        const followBonus = following.has(p.creator.handle) ? 10 : 0;
        const jitter = Math.random() * 2;
        return { ...p, _score: tagScore + locBonus + followBonus + jitter };
      })
      .sort((a, b) => b._score - a._score);
  }, [postsState, weights, following, settings.personalized]);

  const followingFeed = useMemo(() => postsState.filter((p) => following.has(p.creator.handle)), [postsState, following]);

  const tagFeed = useMemo(() => {
    if (!tagFilter) return [];
    return postsState
      .filter((p) => p.tags.includes(tagFilter))
      .map((p) => ({ ...p, _score: (weights[tagFilter] || 1) + (p.location === MY_LOCATION ? 3 : 0) + Math.random() }))
      .sort((a, b) => b._score - a._score);
  }, [postsState, tagFilter, weights]);

  const activeList = tab === "forYou" ? forYouRanked : tab === "following" ? followingFeed : tab === "single" ? (singlePost ? [singlePost] : []) : tagFeed;

  // dwell-time engagement
  useEffect(() => {
    if (view !== "feed") return;
    const post = activeList[activeIndex];
    if (!post) return;
    const t = setTimeout(() => {
      const key = `${tab}-${post.id}`;
      if (!viewedRef.current.has(key)) {
        viewedRef.current.add(key);
        boost(post.tags, 1);
      }
    }, 2200);
    return () => clearTimeout(t);
    // eslint-disable-next-line
  }, [activeIndex, tab, view]);

  const onScroll = useCallback((e) => {
    const h = e.currentTarget.clientHeight;
    const idx = Math.round(e.currentTarget.scrollTop / h);
    setActiveIndex(idx);
  }, []);

  function likePost(post) {
    const isLiked = liked.has(post.id);
    setLiked((s) => { const n = new Set(s); isLiked ? n.delete(post.id) : n.add(post.id); return n; });
    setPostsState((ps) => ps.map((p) => (p.id === post.id ? { ...p, likes: p.likes + (isLiked ? -1 : 1) } : p)));
    if (!isLiked) boost(post.tags, 3);
  }
  function savePost(post) {
    setSaved((s) => { const n = new Set(s); n.has(post.id) ? n.delete(post.id) : n.add(post.id); return n; });
  }
  function followCreator(creator) {
    const isFollowing = following.has(creator.handle);
    setFollowing((s) => { const n = new Set(s); isFollowing ? n.delete(creator.handle) : n.add(creator.handle); return n; });
    if (!isFollowing) { boost(creator.tags, 5); flash(`Following @${creator.handle}`); setNotifs((n) => [{ type: "follow", text: `You followed @${creator.handle}`, time: "now" }, ...n]); }
    else flash(`Unfollowed @${creator.handle}`);
  }
  function addComment(post, text) {
    setPostsState((ps) => ps.map((p) => (p.id === post.id ? { ...p, comments: [...p.comments, { user: profile.handle, text }], commentCount: p.commentCount + 1 } : p)));
    boost(post.tags, 2);
  }
  function openMessageFor(creator) {
    let convo = conversations.find((c) => c.name.toLowerCase().includes(creator.name.toLowerCase()));
    if (!convo) {
      convo = { id: Date.now(), name: creator.name, grad: creator.grad, lastMsg: "", unread: 0, messages: [] };
      setConversations((c) => [convo, ...c]);
    }
    setOpenConvo(convo);
    setOpenConvoIsRequest(false);
    goTo("conversation");
  }
  function openRequest(r) {
    setOpenConvo(r);
    setOpenConvoIsRequest(true);
    goTo("conversation");
  }
  function acceptRequest() {
    if (!openConvo) return;
    setRequests((rs) => rs.filter((r) => r.id !== openConvo.id));
    setConversations((cs) => [{ ...openConvo, unread: 0 }, ...cs]);
    setOpenConvoIsRequest(false);
  }
  function declineRequest() {
    if (!openConvo) return;
    setRequests((rs) => rs.filter((r) => r.id !== openConvo.id));
    setOpenConvo(null);
    setView("inbox");
    flash("Request declined");
  }
  function sendMsg(text) {
    setOpenConvo((c) => {
      const updated = { ...c, messages: [...c.messages, { from: "me", text }], lastMsg: text, unread: 0 };
      setConversations((cs) => cs.map((x) => (x.id === c.id ? updated : x)));
      return updated;
    });
  }

  const totalUnread = conversations.reduce((s, c) => s + c.unread, 0) + requests.length;

  return (
    <div className="w-full max-w-[430px] mx-auto h-[900px] relative overflow-hidden rounded-[28px] bg-black select-none">
      <style>{`
        @keyframes spin { from{transform:rotate(0)} to{transform:rotate(360deg)} }
        @keyframes popHeart { 0%{transform:scale(0.4);opacity:0} 30%{transform:scale(1.15);opacity:1} 60%{transform:scale(1)} 100%{transform:scale(1.3);opacity:0} }
      `}</style>

      {view === "feed" && (
        <>
          {/* top tabs */}
          <div className="absolute top-12 left-0 right-0 z-20 flex items-center justify-center gap-6">
            {tab === "tag" || tab === "single" ? (
              <button onClick={() => { setTab("forYou"); setActiveIndex(0); goTo("feed"); }} className="flex items-center gap-1.5 text-white text-[15px] font-semibold">
                <ChevronLeft size={18} /> {tab === "tag" ? `#${tagFilter}` : "Post"}
              </button>
            ) : (
              <>
                <button onClick={() => { setTab("following"); setActiveIndex(0); }} className="text-[15px] font-semibold" style={{ color: tab === "following" ? "white" : "rgba(255,255,255,0.55)" }}>Following</button>
                <button onClick={() => { setTab("forYou"); setActiveIndex(0); }} className="text-[15px] font-semibold" style={{ color: tab === "forYou" ? "white" : "rgba(255,255,255,0.55)" }}>For You</button>
              </>
            )}
          </div>
          <button onClick={() => goTo("notifications")} className="absolute top-12 right-4 z-20">
            <Bell size={20} className="text-white" />
            {notifs.length > 0 && <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-[#F0537A]" />}
          </button>

          <div ref={containerRef} onScroll={onScroll} className="absolute inset-0 overflow-y-scroll snap-y snap-mandatory" style={{ scrollbarWidth: "none" }}>
            {activeList.length === 0 ? (
              <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-white/50 px-10 text-center">
                <span className="text-[15px] font-medium">{tab === "following" ? "Follow creators to see them here" : "No posts to show"}</span>
                <button onClick={() => setTab("forYou")} className="text-[#5B6EF5] text-[14px] font-semibold mt-2">Explore For You</button>
              </div>
            ) : activeList.map((p, i) => (
              <FeedPost
                key={`${tab}-${p.id}`}
                post={p}
                active={i === activeIndex}
                liked={liked.has(p.id)}
                saved={saved.has(p.id)}
                following={following.has(p.creator.handle)}
                onLike={() => likePost(p)}
                onSave={() => savePost(p)}
                onFollow={() => followCreator(p.creator)}
                onComment={() => setCommentPostId(p.id)}
                onSound={() => setSoundPostId(p.id)}
                onShare={() => {
                  const link = `https://oldtime.app/u/${p.creator.handle}/${p.id}`;
                  if (navigator.clipboard?.writeText) navigator.clipboard.writeText(link).catch(() => {});
                  flash("Link copied to clipboard");
                }}
                onOpenProfile={(c) => { setSelectedCreator(c); goTo("creatorProfile"); }}
                muted={muted}
                setMuted={setMuted}
              />
            ))}
          </div>

          {/* bottom nav */}
          <div className="absolute bottom-0 left-0 right-0 flex items-center justify-around pt-2 pb-5 z-20" style={{ background: "linear-gradient(0deg, rgba(0,0,0,0.75), transparent)" }}>
            <button onClick={() => setView("feed")} className="flex flex-col items-center gap-0.5"><Home size={22} className="text-white" /><span className="text-white text-[10px]">Home</span></button>
            <button onClick={() => goTo("explore")} className="flex flex-col items-center gap-0.5"><Compass size={22} className="text-white/60" /><span className="text-white/60 text-[10px]">Explore</span></button>
            <button onClick={() => goTo("create")} className="w-11 h-8 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(90deg,#5B6EF5,#34C77E)" }}><Plus size={18} className="text-white" /></button>
            <button onClick={() => goTo("inbox")} className="flex flex-col items-center gap-0.5 relative">
              <MessageSquare size={22} className="text-white/60" />
              {totalUnread > 0 && <span className="absolute -top-1 right-0 w-4 h-4 rounded-full bg-[#F0537A] text-white text-[9px] font-bold flex items-center justify-center">{totalUnread}</span>}
              <span className="text-white/60 text-[10px]">Inbox</span>
            </button>
            <button onClick={() => goTo("profile")} className="flex flex-col items-center gap-0.5">
              <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[9px] font-bold" style={{ background: profile.grad }}>{initialsOf(profile.name)}</div>
              <span className="text-white/60 text-[10px]">Profile</span>
            </button>
          </div>

          {commentPostId && (() => {
            const cp = postsState.find((p) => p.id === commentPostId) || activeList.find((p) => p.id === commentPostId);
            return cp ? <CommentsSheet post={cp} onClose={() => setCommentPostId(null)} onAddComment={(t) => addComment(cp, t)} /> : null;
          })()}
          {soundPostId && (() => {
            const sp = postsState.find((p) => p.id === soundPostId) || activeList.find((p) => p.id === soundPostId);
            return sp ? <SoundSheet post={sp} saved={savedSounds.has(sp.id)} onClose={() => setSoundPostId(null)} onSave={() => setSavedSounds((s) => { const n = new Set(s); n.has(sp.id) ? n.delete(sp.id) : n.add(sp.id); return n; })} /> : null;
          })()}
        </>
      )}

      {view === "explore" && (
        <Explore
          posts={postsState}
          weights={weights}
          onOpenTag={(t) => { setTagFilter(t); setTab("tag"); setActiveIndex(0); setView("feed"); }}
          onOpenPost={(p) => { setSinglePost(p); setTab("single"); setActiveIndex(0); setView("feed"); }}
        />
      )}

      {view === "creatorProfile" && selectedCreator && (
        <CreatorProfile
          creator={selectedCreator}
          following={following.has(selectedCreator.handle)}
          onFollow={() => followCreator(selectedCreator)}
          onBack={() => setView(prevView === "creatorProfile" ? "feed" : prevView)}
          onMessage={() => openMessageFor(selectedCreator)}
          postsCount={postsState.filter((p) => p.creator.handle === selectedCreator.handle).length}
        />
      )}

      {view === "profile" && (
        <MyProfile profile={profile} following={following} likedCount={liked.size} savedCount={saved.size} myPosts={myPosts}
          onCreatePost={() => goTo("create")} onOpenSettings={() => goTo("settings")} onEditProfile={() => goTo("editProfile")} />
      )}

      {view === "settings" && (
        <UpdatesSettings settings={settings} onChange={setSettings} onBack={() => setView(prevView === "settings" ? "profile" : prevView)} />
      )}

      {view === "editProfile" && (
        <EditProfile profile={profile} onBack={() => setView(prevView === "editProfile" ? "profile" : prevView)}
          onSave={(p) => { setProfile(p); setView("profile"); flash("Profile updated"); }} />
      )}

      {view === "create" && (
        <CreatePost onClose={() => setView(prevView === "create" ? "feed" : prevView)} onPost={({ caption, tag, grad }) => {
          setMyPosts((m) => [{ id: Date.now(), caption, grad }, ...m]);
          setPostsState((ps) => [{ id: Date.now() + 1, creator: { handle: profile.handle, name: profile.name, tags: [tag], location: MY_LOCATION, grad }, tags: [tag], location: MY_LOCATION, caption, sound: `${profile.name} · original sound`, likes: 0, comments: [], commentCount: 0, shares: 0 }, ...ps]);
          setView("profile");
          flash("Posted!");
        }} />
      )}

      {view === "inbox" && (
        <Inbox conversations={conversations} requests={requests} onBack={() => setView(prevView === "inbox" ? "feed" : prevView)}
          onOpen={(c) => { setConversations((cs) => cs.map((x) => (x.id === c.id ? { ...x, unread: 0 } : x))); setOpenConvo(c); setOpenConvoIsRequest(false); goTo("conversation"); }}
          onOpenRequest={openRequest}
        />
      )}

      {view === "conversation" && openConvo && (
        <Conversation convo={openConvo} isRequest={openConvoIsRequest} onBack={() => setView("inbox")} onSend={sendMsg} onAccept={acceptRequest} onDecline={declineRequest} />
      )}

      {view === "notifications" && (
        <Notifications items={notifs} onBack={() => setView(prevView === "notifications" ? "feed" : prevView)} />
      )}

      {toast && (
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 text-white text-[13px] px-4 py-2 rounded-full z-50" style={{ background: "rgba(28,28,30,0.92)" }}>{toast}</div>
      )}
    </div>
  );
}
