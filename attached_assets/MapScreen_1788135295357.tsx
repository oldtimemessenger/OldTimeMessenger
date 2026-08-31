import React, { useState } from "react";
import {
  Search, Locate, Plus, Minus, Ghost, Phone, Video, MessageSquare, X, Users,
} from "lucide-react";

function initialsOf(n) { return n.split(" ").map((p) => p[0]).slice(0, 2).join(""); }

const FRIENDS = [
  { name: "Maya R.", x: 32, y: 40, sharing: true, hasStory: true, place: "Wynwood Walls", updated: "2 min ago" },
  { name: "Theo K.", x: 62, y: 25, sharing: true, hasStory: true, place: "The Design District", updated: "5 min ago" },
  { name: "Priya S.", x: 70, y: 62, sharing: true, hasStory: false, place: "South Beach", updated: "12 min ago" },
  { name: "Noah B.", x: 45, y: 70, sharing: false, hasStory: false, place: "Hidden", updated: "" },
  { name: "Ava L.", x: 20, y: 58, sharing: true, hasStory: true, place: "Brickell", updated: "1 min ago" },
];

function MapBg() {
  // Clean, Google-Maps-like base built from plain CSS layers (no SVG/tiles needed —
  // renders reliably in any sandboxed preview).
  const road = (style) => (
    <div className="absolute bg-white" style={{ boxShadow: "0 0 0 1px rgba(0,0,0,0.03)", ...style }} />
  );
  return (
    <div className="absolute inset-0" style={{ background: "#EAEFF2" }}>
      {/* water */}
      <div className="absolute left-0 right-0 bottom-0" style={{ top: "62%", background: "#BFE0F2", borderTopLeftRadius: "45% 30%", borderTopRightRadius: "35% 25%" }} />
      {/* parks */}
      <div className="absolute rounded-2xl" style={{ left: "8%", top: "14%", width: "22%", height: "10%", background: "#CDEBD1" }} />
      <div className="absolute rounded-2xl" style={{ left: "58%", top: "34%", width: "18%", height: "8%", background: "#CDEBD1" }} />
      <div className="absolute rounded-xl" style={{ left: "36%", top: "58%", width: "15%", height: "7%", background: "#CDEBD1" }} />
      {/* horizontal roads */}
      {road({ left: 0, right: 0, top: "12%", height: 7 })}
      {road({ left: 0, right: 0, top: "27%", height: 7 })}
      {road({ left: 0, right: 0, top: "42%", height: 7 })}
      {road({ left: 0, right: 0, top: "57%", height: 7 })}
      {road({ left: 0, right: 0, top: "20%", height: 3, background: "#D8DEE3" })}
      {road({ left: 0, right: 0, top: "50%", height: 3, background: "#D8DEE3" })}
      {/* vertical roads */}
      {road({ top: 0, bottom: 0, left: "15%", width: 7 })}
      {road({ top: 0, bottom: 0, left: "45%", width: 7 })}
      {road({ top: 0, bottom: 0, left: "75%", width: 7 })}
      {road({ top: 0, bottom: 0, left: "30%", width: 3, background: "#D8DEE3" })}
      {road({ top: 0, bottom: 0, left: "85%", width: 3, background: "#D8DEE3" })}
      {/* diagonal avenue */}
      <div className="absolute" style={{ left: "-10%", top: "-5%", width: "150%", height: 6, background: "#FFD54A", opacity: 0.85, transform: "rotate(35deg)", transformOrigin: "top left" }} />
    </div>
  );
}

function PinAvatar({ f, onClick, size = 46 }) {
  return (
    <button
      onClick={onClick}
      className="absolute flex flex-col items-center -translate-x-1/2 -translate-y-full"
      style={{ left: `${f.x}%`, top: `${f.y}%` }}
    >
      <div className="rounded-full" style={{
        padding: f.hasStory ? 2.5 : 0,
        background: f.hasStory ? "conic-gradient(from 0deg,#F0537A,#E8963C,#8B5CF6,#4C63F5,#F0537A)" : "transparent",
      }}>
        <div className="rounded-full p-[2px] bg-white shadow-md">
          <div className="rounded-full flex items-center justify-center text-white font-semibold" style={{ width: size, height: size, fontSize: size * 0.34, background: "linear-gradient(135deg,#4C63F5,#34C77E)" }}>
            {initialsOf(f.name)}
          </div>
        </div>
      </div>
      <div className="w-2.5 h-2.5 rotate-45 -mt-1.5" style={{ background: "white" }} />
    </button>
  );
}

export default function MapScreen() {
  const [friends, setFriends] = useState(FRIENDS);
  const [meSharing, setMeSharing] = useState(true);
  const [ghost, setGhost] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [selected, setSelected] = useState(null);
  const [sheetOpen, setSheetOpen] = useState(true);
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState(null);
  const flash = (m) => { setToast(m); setTimeout(() => setToast(null), 1400); };

  const visibleFriends = friends.filter((f) => f.sharing);
  const filteredFriends = friends.filter((f) => f.name.toLowerCase().includes(search.toLowerCase()));

  function toggleFriendSharingView(name) {
    // Toggling here simulates hiding a friend's pin from *your* view (mute location)
    setFriends((fs) => fs.map((f) => (f.name === name ? { ...f, sharing: !f.sharing } : f)));
  }

  return (
    <div className="w-full max-w-[430px] mx-auto h-[900px] relative overflow-hidden rounded-[28px] bg-white select-none">
      {/* Map */}
      <div className="absolute inset-0" style={{ transform: `scale(${zoom})`, transition: "transform .2s ease-out" }}>
        <MapBg />
        {/* my location */}
        {meSharing && !ghost && (
          <div className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: "50%", top: "48%" }}>
            <div className="w-5 h-5 rounded-full border-2 border-white shadow" style={{ background: "#4C63F5" }} />
            <div className="absolute inset-0 rounded-full animate-ping" style={{ background: "#4C63F599" }} />
          </div>
        )}
        {visibleFriends.map((f) => (
          <PinAvatar key={f.name} f={f} onClick={() => setSelected(f)} />
        ))}
      </div>

      {/* Search bar */}
      <div className="absolute top-12 left-4 right-4">
        <div className="flex items-center gap-2 bg-white rounded-full px-4 py-3 shadow-lg">
          <Search size={17} className="text-[#8E8E93]" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search friends or places"
            className="flex-1 outline-none text-[15px] text-[#1C1C1E] bg-transparent" />
          {ghost && <Ghost size={17} className="text-[#6C7280]" />}
        </div>
        {search && (
          <div className="mt-2 bg-white rounded-2xl shadow-lg overflow-hidden max-h-52 overflow-y-auto">
            {filteredFriends.length === 0 && <div className="px-4 py-3 text-[14px] text-[#8E8E93]">No matches</div>}
            {filteredFriends.map((f) => (
              <button key={f.name} onClick={() => { setSelected(f); setSearch(""); }} className="w-full flex items-center gap-3 px-4 py-2.5 border-b border-[#F0F0F3] last:border-none">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[12px] font-semibold" style={{ background: "linear-gradient(135deg,#4C63F5,#34C77E)" }}>{initialsOf(f.name)}</div>
                <div className="text-left">
                  <div className="text-[14.5px] text-[#1C1C1E]">{f.name}</div>
                  <div className="text-[12px] text-[#8E8E93]">{f.sharing ? f.place : "Location hidden"}</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Right-side controls */}
      <div className="absolute right-4 bottom-[300px] flex flex-col gap-3">
        <button onClick={() => setGhost((g) => !g)} className="w-11 h-11 rounded-full shadow-lg flex items-center justify-center" style={{ background: ghost ? "#1C1C1E" : "white" }}>
          <Ghost size={19} style={{ color: ghost ? "white" : "#6C7280" }} />
        </button>
        <div className="bg-white rounded-full shadow-lg flex flex-col overflow-hidden">
          <button onClick={() => setZoom((z) => Math.min(2, z + 0.2))} className="w-11 h-11 flex items-center justify-center border-b border-[#F0F0F3]"><Plus size={18} className="text-[#1C1C1E]" /></button>
          <button onClick={() => setZoom((z) => Math.max(0.6, z - 0.2))} className="w-11 h-11 flex items-center justify-center"><Minus size={18} className="text-[#1C1C1E]" /></button>
        </div>
        <button onClick={() => { setZoom(1); flash("Recentered"); }} className="w-11 h-11 rounded-full shadow-lg flex items-center justify-center bg-white">
          <Locate size={18} className="text-[#4C63F5]" />
        </button>
      </div>

      {/* Friend detail card */}
      {selected && (
        <div className="absolute left-4 right-4 bottom-[240px] bg-white rounded-2xl shadow-xl p-4 z-20">
          <button onClick={() => setSelected(null)} className="absolute top-3 right-3 text-[#8E8E93]"><X size={18} /></button>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full flex items-center justify-center text-white text-[15px] font-semibold" style={{ background: "linear-gradient(135deg,#4C63F5,#34C77E)" }}>{initialsOf(selected.name)}</div>
            <div>
              <div className="text-[16px] font-semibold text-[#1C1C1E]">{selected.name}</div>
              <div className="text-[13px] text-[#8E8E93]">{selected.place} · {selected.updated}</div>
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            {selected.hasStory && (
              <button onClick={() => flash(`Opening ${selected.name}'s story`)} className="flex-1 py-2 rounded-full text-white text-[13.5px] font-medium" style={{ background: "linear-gradient(135deg,#F0537A,#8B5CF6)" }}>View Story</button>
            )}
            <button onClick={() => flash(`Message sent to ${selected.name}`)} className="flex-1 py-2 rounded-full text-[13.5px] font-medium bg-[#EDEEF2] text-[#1C1C1E] flex items-center justify-center gap-1"><MessageSquare size={14} /> Chat</button>
            <button onClick={() => flash(`Calling ${selected.name}…`)} className="w-10 h-10 rounded-full bg-[#EDEEF2] flex items-center justify-center"><Phone size={15} className="text-[#1C1C1E]" /></button>
            <button onClick={() => flash(`Video calling ${selected.name}…`)} className="w-10 h-10 rounded-full bg-[#EDEEF2] flex items-center justify-center"><Video size={15} className="text-[#1C1C1E]" /></button>
          </div>
        </div>
      )}

      {/* Bottom sheet */}
      <div className="absolute left-0 right-0 bottom-0 bg-white rounded-t-3xl shadow-[0_-4px_20px_rgba(0,0,0,0.08)] transition-all"
        style={{ height: sheetOpen ? 240 : 88 }}>
        <button onClick={() => setSheetOpen((s) => !s)} className="w-full flex flex-col items-center pt-2 pb-1">
          <div className="w-10 h-1 bg-[#E5E5EA] rounded-full mb-2" />
        </button>

        <div className="flex items-center justify-between px-4 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-[13px] font-semibold" style={{ background: "linear-gradient(135deg,#4C63F5,#34C77E)" }}>KC</div>
            <div>
              <div className="text-[14.5px] font-medium text-[#1C1C1E]">Your Location</div>
              <div className="text-[12px] text-[#8E8E93]">{ghost ? "Ghost Mode on" : meSharing ? "Sharing with friends" : "Not sharing"}</div>
            </div>
          </div>
          <button
            onClick={() => setMeSharing((s) => !s)}
            className="px-3.5 py-1.5 rounded-full text-[12.5px] font-medium text-white"
            style={{ background: ghost ? "#8E8E93" : meSharing ? "#34C77E" : "#4C63F5" }}
            disabled={ghost}
          >
            {ghost ? "Hidden" : meSharing ? "Sharing" : "Share Location"}
          </button>
        </div>

        {sheetOpen && (
          <div className="overflow-y-auto px-4" style={{ height: 160 }}>
            <div className="flex items-center gap-1.5 text-[12px] text-[#8E8E93] mb-2"><Users size={13} /> {visibleFriends.length} friends visible on map</div>
            {friends.map((f) => (
              <div key={f.name} className="flex items-center justify-between py-2 border-b border-[#F2F2F5] last:border-none">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[11.5px] font-semibold" style={{ background: "linear-gradient(135deg,#4C63F5,#34C77E)" }}>{initialsOf(f.name)}</div>
                  <div>
                    <div className="text-[14px] text-[#1C1C1E]">{f.name}</div>
                    <div className="text-[11.5px] text-[#8E8E93]">{f.sharing ? f.place : "Not sharing"}</div>
                  </div>
                </div>
                <button onClick={() => toggleFriendSharingView(f.name)} className="text-[12px] font-medium" style={{ color: f.sharing ? "#4C63F5" : "#8E8E93" }}>
                  {f.sharing ? "On Map" : "Hidden"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {toast && (
        <div className="absolute bottom-[260px] left-1/2 -translate-x-1/2 text-white text-[13px] px-4 py-2 rounded-full z-30" style={{ background: "rgba(28,28,30,0.92)" }}>
          {toast}
        </div>
      )}
    </div>
  );
}
