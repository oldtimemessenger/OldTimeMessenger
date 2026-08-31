import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Phone, PhoneOff, Video, VideoOff, Mic, MicOff, Volume2, VolumeX,
  SwitchCamera, UserPlus, X, ChevronDown, Grid3x3, MessageSquare, Sparkles
} from "lucide-react";

const ACCENT = "#34C77E";
const DECLINE = "#F0537A";

function initialsOf(n) { return n.split(" ").map((p) => p[0]).slice(0, 2).join(""); }

function useCallTimer(active) {
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [active]);
  useEffect(() => { if (!active) setSecs(0); }, [active]);
  const mm = String(Math.floor(secs / 60)).padStart(2, "0");
  const ss = String(secs % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

function CtrlBtn({ icon, label, active, danger, onClick, big }) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-1.5">
      <div
        className={`flex items-center justify-center rounded-full transition-all ${big ? "w-16 h-16" : "w-14 h-14"}`}
        style={{
          background: danger ? DECLINE : active ? "#FFFFFF" : "rgba(255,255,255,0.18)",
          color: danger ? "#fff" : active ? "#111" : "#fff",
        }}
      >
        {icon}
      </div>
      {label && <span className="text-[11.5px] text-white/85">{label}</span>}
    </button>
  );
}

export default function CallScreen() {
  const [stage, setStage] = useState("idle"); // idle | incoming | active | ended
  const [callType, setCallType] = useState("video"); // audio | video
  const [muted, setMuted] = useState(false);
  const [videoOn, setVideoOn] = useState(true);
  const [speaker, setSpeaker] = useState(true);
  const [frontCam, setFrontCam] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [participants, setParticipants] = useState(["Maya R."]);
  const [pip, setPip] = useState({ x: 0, y: 0 });
  const dragRef = useRef(null);
  const timer = useCallTimer(stage === "active");

  const caller = { name: "Maya R.", sub: "Old Time" };

  function startIncoming(type) {
    setCallType(type);
    setVideoOn(type === "video");
    setStage("incoming");
  }
  function accept() { setStage("active"); }
  function decline() { setStage("ended"); setTimeout(() => setStage("idle"), 1400); }
  function endCall() { setStage("ended"); setTimeout(() => setStage("idle"), 1400); }

  // Draggable PiP
  const onPointerDown = useCallback((e) => {
    const startX = e.clientX, startY = e.clientY;
    const orig = { ...pip };
    function move(ev) {
      const dx = ev.clientX - startX, dy = ev.clientY - startY;
      setPip({ x: Math.max(-180, Math.min(180, orig.x + dx)), y: Math.max(-500, Math.min(260, orig.y + dy)) });
    }
    function up() {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    }
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }, [pip]);

  // ---------- Idle / launcher ----------
  if (stage === "idle") {
    return (
      <div className="w-full max-w-[430px] mx-auto h-[900px] bg-[#F2F2F7] flex flex-col items-center justify-center gap-6 p-8 rounded-[28px] overflow-hidden">
        <div className="w-20 h-20 rounded-full flex items-center justify-center text-white text-2xl font-semibold" style={{ background: `linear-gradient(135deg, ${ACCENT}, #4C63F5)` }}>
          {initialsOf(caller.name)}
        </div>
        <div className="text-center">
          <div className="text-[20px] font-semibold text-[#1C1C1E]">{caller.name}</div>
          <div className="text-[14px] text-[#8E8E93]">Tap to simulate an incoming call</div>
        </div>
        <div className="flex gap-4">
          <button onClick={() => startIncoming("audio")} className="flex items-center gap-2 px-5 py-3 rounded-full text-white font-medium" style={{ background: ACCENT }}>
            <Phone size={17} /> Voice Call
          </button>
          <button onClick={() => startIncoming("video")} className="flex items-center gap-2 px-5 py-3 rounded-full text-white font-medium" style={{ background: "#4C63F5" }}>
            <Video size={17} /> Video Call
          </button>
        </div>
      </div>
    );
  }

  // ---------- Ended ----------
  if (stage === "ended") {
    return (
      <div className="w-full max-w-[430px] mx-auto h-[900px] bg-black flex flex-col items-center justify-center gap-3 rounded-[28px] overflow-hidden">
        <div className="w-20 h-20 rounded-full flex items-center justify-center text-white text-2xl font-semibold" style={{ background: `linear-gradient(135deg, ${ACCENT}, #4C63F5)` }}>
          {initialsOf(caller.name)}
        </div>
        <div className="text-white text-[19px] font-medium">Call Ended</div>
        <div className="text-white/60 text-[14px]">{timer !== "00:00" ? `Duration ${timer}` : "Call declined"}</div>
      </div>
    );
  }

  // ---------- Incoming ----------
  if (stage === "incoming") {
    return (
      <div className="w-full max-w-[430px] mx-auto h-[900px] relative overflow-hidden rounded-[28px]" style={{ background: "linear-gradient(180deg,#1a1a2e,#0d0d16)" }}>
        <div className="absolute inset-0 flex flex-col items-center pt-24 gap-2">
          <span className="text-white/70 text-[15px]">{callType === "video" ? "Incoming Video Call" : "Incoming Call"}</span>
          <div className="w-32 h-32 rounded-full flex items-center justify-center text-white text-4xl font-semibold mt-4 animate-pulse" style={{ background: `linear-gradient(135deg, ${ACCENT}, #4C63F5)` }}>
            {initialsOf(caller.name)}
          </div>
          <div className="text-white text-[26px] font-semibold mt-4">{caller.name}</div>
          <div className="text-white/50 text-[14px]">{caller.sub}</div>
        </div>

        <div className="absolute bottom-14 left-0 right-0 flex items-center justify-around px-10">
          <div className="flex flex-col items-center gap-2">
            <button onClick={decline} className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: DECLINE }}>
              <PhoneOff size={26} className="text-white" />
            </button>
            <span className="text-white/70 text-[12.5px]">Decline</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <button onClick={accept} className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: ACCENT }}>
              {callType === "video" ? <Video size={24} className="text-white" /> : <Phone size={24} className="text-white" />}
            </button>
            <span className="text-white/70 text-[12.5px]">Accept</span>
          </div>
        </div>
      </div>
    );
  }

  // ---------- Active ----------
  const isVideo = callType === "video" && videoOn;
  return (
    <div className="w-full max-w-[430px] mx-auto h-[900px] relative overflow-hidden rounded-[28px] bg-black select-none">
      {/* Remote view */}
      <div className="absolute inset-0" style={{
        background: isVideo
          ? "radial-gradient(circle at 30% 20%, #2b3a67, #0d0d16 70%)"
          : "linear-gradient(180deg,#1a1a2e,#0d0d16)"
      }}>
        {!isVideo && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
            <div className="w-32 h-32 rounded-full flex items-center justify-center text-white text-4xl font-semibold" style={{ background: `linear-gradient(135deg, ${ACCENT}, #4C63F5)` }}>
              {initialsOf(caller.name)}
            </div>
            <div className="flex items-end gap-1 h-6 mt-2">
              {[0,1,2,3,4].map((i) => (
                <span key={i} className="w-1 rounded-full bg-white/70" style={{ height: `${8 + (i % 3) * 6}px`, animation: `pulse 1.2s ease-in-out ${i * 0.1}s infinite` }} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 pt-12 pb-3" style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.55), transparent)" }}>
        <button onClick={() => {}} className="text-white/80"><ChevronDown size={22} /></button>
        <div className="text-center">
          <div className="text-white text-[16px] font-medium">{caller.name}{participants.length > 1 ? ` +${participants.length - 1}` : ""}</div>
          <div className="text-white/60 text-[12.5px]">{timer} · {isVideo ? "Video" : "Old Time Audio"}</div>
        </div>
        <button onClick={() => setShowAdd(true)} className="text-white/80"><UserPlus size={20} /></button>
      </div>

      {/* Self PiP */}
      {callType === "video" && (
        <div
          onPointerDown={onPointerDown}
          className="absolute w-[104px] h-[150px] rounded-2xl overflow-hidden cursor-grab active:cursor-grabbing shadow-lg border border-white/20"
          style={{ right: 16, top: 130, transform: `translate(${pip.x}px, ${pip.y}px)`, background: videoOn ? "linear-gradient(160deg,#3a3a4a,#1a1a24)" : "#111" }}
        >
          {videoOn ? (
            <div className="w-full h-full flex items-center justify-center text-white text-xl font-semibold" style={{ background: `linear-gradient(135deg, #4C63F5, ${ACCENT})`, transform: frontCam ? "scaleX(-1)" : "none" }}>
              You
            </div>
          ) : (
            <div className="w-full h-full flex items-center justify-center text-white/60 text-[12px]"><VideoOff size={18} /></div>
          )}
        </div>
      )}

      {/* Bottom control pill */}
      <div className="absolute bottom-10 left-0 right-0 px-5">
        <div className="rounded-[28px] px-4 py-4" style={{ background: "rgba(30,30,34,0.55)", backdropFilter: "blur(10px)" }}>
          <div className="grid grid-cols-4 gap-y-4 place-items-center">
            <CtrlBtn icon={muted ? <MicOff size={22} /> : <Mic size={22} />} label="Mute" active={muted} onClick={() => setMuted((m) => !m)} />
            <CtrlBtn icon={speaker ? <Volume2 size={22} /> : <VolumeX size={22} />} label="Speaker" active={speaker} onClick={() => setSpeaker((s) => !s)} />
            <CtrlBtn icon={callType === "video" && videoOn ? <Video size={22} /> : <VideoOff size={22} />} label="Video" active={callType === "video" && videoOn} onClick={() => { if (callType !== "video") setCallType("video"); setVideoOn((v) => !v); }} />
            <CtrlBtn icon={<SwitchCamera size={22} />} label="Flip" onClick={() => setFrontCam((f) => !f)} />
          </div>
          <div className="flex items-center justify-center gap-8 mt-4">
            <CtrlBtn icon={<Grid3x3 size={20} />} label="Effects" onClick={() => {}} />
            <CtrlBtn icon={<PhoneOff size={26} className="text-white" />} danger onClick={endCall} big />
            <CtrlBtn icon={<MessageSquare size={20} />} label="Chat" onClick={() => {}} />
          </div>
        </div>
      </div>

      {/* Add participant sheet */}
      {showAdd && (
        <div className="absolute inset-0 z-30 flex items-end" style={{ background: "rgba(0,0,0,0.5)" }} onClick={() => setShowAdd(false)}>
          <div className="w-full bg-[#1C1C1E] rounded-t-3xl p-4" onClick={(e) => e.stopPropagation()}>
            <div className="w-10 h-1 bg-white/25 rounded-full mx-auto mb-4" />
            <div className="text-white text-[16px] font-medium mb-3">Add to Call</div>
            {["Theo K.", "Delivery Support", "Priya S."].map((n) => (
              <button key={n} onClick={() => { setParticipants((p) => [...p, n]); setShowAdd(false); }} className="w-full flex items-center gap-3 py-2.5">
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-[13px] font-medium" style={{ background: "#4C63F5" }}>{initialsOf(n)}</div>
                <span className="text-white text-[15px]">{n}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <style>{`@keyframes pulse { 0%,100%{transform:scaleY(0.4)} 50%{transform:scaleY(1)} }`}</style>
    </div>
  );
}
