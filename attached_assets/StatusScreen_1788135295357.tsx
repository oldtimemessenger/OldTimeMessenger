import React, { useState, useEffect, useRef, useCallback } from "react";
import { Plus, X, Send, Pause, Play, ChevronLeft, ChevronRight, Camera, Type } from "lucide-react";

const COLORS = ["#F0537A", "#4C63F5", "#34C77E", "#E8963C", "#8B5CF6", "#26A69A"];

function initialsOf(n) { return n.split(" ").map((p) => p[0]).slice(0, 2).join(""); }

const SEED_FRIENDS = [
  { name: "Maya R.", seen: false, items: [{ type: "photo", bg: COLORS[0], caption: "Sunset run 🌇" }, { type: "photo", bg: COLORS[3], caption: "Coffee o'clock" }] },
  { name: "Theo K.", seen: false, items: [{ type: "photo", bg: COLORS[1], caption: "Studio session" }] },
  { name: "Priya S.", seen: true, items: [{ type: "photo", bg: COLORS[2], caption: "Beach day 🌊" }] },
  { name: "Delivery Support", seen: false, items: [{ type: "photo", bg: COLORS[4], caption: "We're hiring!" }] },
  { name: "Noah B.", seen: true, items: [{ type: "photo", bg: COLORS[5], caption: "New setup" }] },
  { name: "Ava L.", seen: false, items: [{ type: "photo", bg: COLORS[0], caption: "Hiking 🥾" }] },
];

function RingAvatar({ name, seen, hasStory, onClick, size = 62, mine, onAdd }) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-1.5 shrink-0" style={{ width: size + 14 }}>
      <div className="relative" style={{ width: size, height: size }}>
        <div
          className="absolute inset-0 rounded-full"
          style={{
            padding: hasStory ? 2.5 : 0,
            background: hasStory ? (seen ? "#C7C7CC" : "conic-gradient(from 0deg,#F0537A,#E8963C,#8B5CF6,#4C63F5,#F0537A)") : "transparent",
          }}
        >
          <div className="w-full h-full rounded-full bg-black p-[2px]">
            <div className="w-full h-full rounded-full flex items-center justify-center text-white font-semibold" style={{ fontSize: size * 0.32, background: `linear-gradient(135deg, #4C63F5, #34C77E)` }}>
              {initialsOf(name)}
            </div>
          </div>
        </div>
        {mine && (
          <button onClick={(e) => { e.stopPropagation(); onAdd(); }} className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full flex items-center justify-center border-2 border-black" style={{ background: "#4C63F5" }}>
            <Plus size={11} className="text-white" />
          </button>
        )}
      </div>
      <span className="text-[11px] text-white/85 truncate" style={{ maxWidth: size + 10 }}>{mine ? "You" : name}</span>
    </button>
  );
}

function StoryViewer({ friend, onClose, onNextFriend, onPrevFriend, onSendReply }) {
  const [idx, setIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reply, setReply] = useState("");
  const raf = useRef(null);
  const DURATION = 4000;

  useEffect(() => { setIdx(0); setProgress(0); }, [friend]);

  useEffect(() => {
    if (paused) return;
    let start = performance.now() - progress * DURATION;
    function tick(now) {
      const p = (now - start) / DURATION;
      if (p >= 1) {
        if (idx < friend.items.length - 1) { setIdx((i) => i + 1); setProgress(0); }
        else onNextFriend();
        return;
      }
      setProgress(p);
      raf.current = requestAnimationFrame(tick);
    }
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
    // eslint-disable-next-line
  }, [idx, paused, friend]);

  const item = friend.items[idx];

  function tapZone(dir) {
    if (dir === "next") {
      if (idx < friend.items.length - 1) { setIdx((i) => i + 1); setProgress(0); }
      else onNextFriend();
    } else {
      if (idx > 0) { setIdx((i) => i - 1); setProgress(0); }
      else onPrevFriend();
    }
  }

  return (
    <div className="absolute inset-0 z-40 overflow-hidden" style={{ background: item.bg }}>
      {/* Progress bars */}
      <div className="absolute top-3 left-3 right-3 flex gap-1 z-10">
        {friend.items.map((_, i) => (
          <div key={i} className="flex-1 h-[3px] rounded-full bg-white/30 overflow-hidden">
            <div className="h-full bg-white" style={{ width: `${i < idx ? 100 : i === idx ? progress * 100 : 0}%` }} />
          </div>
        ))}
      </div>

      <div className="absolute top-7 left-3 right-3 flex items-center justify-between z-10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[11px] font-semibold" style={{ background: "rgba(255,255,255,0.25)" }}>{initialsOf(friend.name)}</div>
          <span className="text-white text-[14px] font-medium">{friend.name}</span>
          <span className="text-white/70 text-[12px]">2h</span>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setPaused((p) => !p)} className="text-white/90">{paused ? <Play size={18} /> : <Pause size={18} />}</button>
          <button onClick={onClose} className="text-white/90"><X size={22} /></button>
        </div>
      </div>

      {/* Tap zones */}
      <button onClick={() => tapZone("prev")} className="absolute left-0 top-0 bottom-24 w-1/3 z-[5]" />
      <button onClick={() => tapZone("next")} className="absolute right-0 top-0 bottom-24 w-1/3 z-[5]" />

      <div className="absolute inset-0 flex items-center justify-center px-10 text-center">
        <span className="text-white text-[22px] font-semibold drop-shadow">{item.caption}</span>
      </div>

      {/* Reply bar */}
      <div className="absolute bottom-6 left-3 right-3 flex items-center gap-2 z-10">
        <input
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          onFocus={() => setPaused(true)}
          onBlur={() => setPaused(false)}
          onKeyDown={(e) => { if (e.key === "Enter" && reply.trim()) { onSendReply(friend.name, reply.trim()); setReply(""); } }}
          placeholder={`Reply to ${friend.name}`}
          className="flex-1 rounded-full px-4 py-2.5 text-[14px] text-white outline-none placeholder:text-white/60"
          style={{ background: "rgba(255,255,255,0.18)" }}
        />
        <button
          onClick={() => { if (reply.trim()) { onSendReply(friend.name, reply.trim()); setReply(""); } }}
          className="w-10 h-10 rounded-full flex items-center justify-center"
          style={{ background: "rgba(255,255,255,0.25)" }}
        >
          <Send size={16} className="text-white" />
        </button>
      </div>
    </div>
  );
}

export default function StatusScreen() {
  const [friends, setFriends] = useState(SEED_FRIENDS);
  const [myStory, setMyStory] = useState(null); // {items:[...]}
  const [openIdx, setOpenIdx] = useState(null); // index into "storyList" (friends with items, my story prepended if exists)
  const [showAdd, setShowAdd] = useState(false);
  const [draftText, setDraftText] = useState("");
  const [draftColor, setDraftColor] = useState(COLORS[0]);
  const [toast, setToast] = useState(null);

  const flash = (m) => { setToast(m); setTimeout(() => setToast(null), 1400); };

  const storyList = myStory ? [{ name: "You", mine: true, items: myStory.items, seen: false }, ...friends] : friends;

  function openAt(i) { setOpenIdx(i); setFriends((fr) => fr.map((f, idx) => (storyList[i] === f ? { ...f, seen: true } : f))); }
  function next() { setOpenIdx((i) => (i < storyList.length - 1 ? i + 1 : null)); }
  function prev() { setOpenIdx((i) => (i > 0 ? i - 1 : null)); }

  function postStatus() {
    if (!draftText.trim()) return;
    setMyStory({ items: [{ type: "text", bg: draftColor, caption: draftText.trim() }] });
    setShowAdd(false);
    setDraftText("");
    flash("Status posted");
  }

  return (
    <div className="w-full max-w-[430px] mx-auto h-[900px] relative overflow-hidden rounded-[28px] bg-black select-none">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-12 pb-3">
        <span className="text-white text-[22px] font-bold">Status</span>
        <Camera size={20} className="text-white/70" onClick={() => setShowAdd(true)} />
      </div>

      {/* Horizontal scrollable ring row */}
      <div className="flex gap-3 px-4 pb-4 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
        <RingAvatar name="You" seen={false} hasStory={!!myStory} mine onAdd={() => setShowAdd(true)}
          onClick={() => (myStory ? openAt(0) : setShowAdd(true))} />
        {friends.map((f, i) => (
          <RingAvatar key={f.name} name={f.name} seen={f.seen} hasStory onClick={() => openAt(storyList.findIndex((s) => s.name === f.name))} />
        ))}
      </div>

      <div className="mx-4 h-px bg-white/10" />

      {/* Recent updates list (Snapchat/WhatsApp hybrid list) */}
      <div className="px-4 pt-3 pb-2 text-white/50 text-[12.5px] uppercase tracking-wide">Recent Updates</div>
      <div className="overflow-y-auto" style={{ maxHeight: "calc(100% - 260px)" }}>
        {friends.map((f, i) => (
          <button key={f.name} onClick={() => openAt(storyList.findIndex((s) => s.name === f.name))} className="w-full flex items-center gap-3 px-4 py-2.5">
            <RingAvatar name={f.name} seen={f.seen} hasStory size={48} onClick={() => {}} />
            <div className="text-left flex-1">
              <div className="text-white text-[15px]">{f.name}</div>
              <div className="text-white/50 text-[12.5px]">{f.seen ? "Viewed · 2h ago" : "New · 2h ago"}</div>
            </div>
          </button>
        ))}
      </div>

      {/* Story viewer */}
      {openIdx !== null && (
        <StoryViewer
          friend={storyList[openIdx]}
          onClose={() => setOpenIdx(null)}
          onNextFriend={next}
          onPrevFriend={prev}
          onSendReply={(name, text) => flash(`Sent to ${name}: "${text}"`)}
        />
      )}

      {/* Add status sheet */}
      {showAdd && (
        <div className="absolute inset-0 z-50 flex flex-col" style={{ background: draftColor }}>
          <div className="flex items-center justify-between px-4 pt-12 pb-2">
            <button onClick={() => setShowAdd(false)} className="text-white"><X size={24} /></button>
            <span className="text-white text-[15px] font-medium">New Status</span>
            <button onClick={postStatus} className="text-white text-[15px] font-semibold">Post</button>
          </div>
          <div className="flex-1 flex items-center justify-center px-8">
            <textarea
              autoFocus
              value={draftText}
              onChange={(e) => setDraftText(e.target.value)}
              placeholder="Type a status…"
              rows={3}
              className="w-full bg-transparent text-white text-[26px] font-semibold text-center outline-none placeholder:text-white/60 resize-none"
            />
          </div>
          <div className="flex items-center justify-center gap-3 pb-10">
            {COLORS.map((c) => (
              <button key={c} onClick={() => setDraftColor(c)} className="w-8 h-8 rounded-full" style={{ background: c, outline: draftColor === c ? "3px solid white" : "none", outlineOffset: 2 }} />
            ))}
          </div>
        </div>
      )}

      {toast && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white text-[13px] px-4 py-2 rounded-full z-[60]" style={{ background: "rgba(28,28,30,0.92)" }}>
          {toast}
        </div>
      )}
    </div>
  );
}
