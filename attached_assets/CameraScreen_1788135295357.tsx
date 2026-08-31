import React, { useState, useRef, useEffect, useCallback } from "react";
import { Zap, ZapOff, Timer, SwitchCamera, X, ChevronUp, Moon } from "lucide-react";

const MODES = ["PANO", "VIDEO", "PHOTO", "PORTRAIT", "SLO-MO"];
const ZOOM_STOPS = [0.5, 1, 2, 3, 5];

export default function CameraScreen() {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const canvasRef = useRef(null);
  const [hasCamera, setHasCamera] = useState(null); // null=checking, true/false
  const [facing, setFacing] = useState("user");
  const [mode, setMode] = useState("PHOTO");
  const [flash, setFlash] = useState("off"); // off | on | auto
  const [zoom, setZoom] = useState(1);
  const [dragging, setDragging] = useState(false);
  const [shots, setShots] = useState([]);
  const [flashFrame, setFlashFrame] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recSecs, setRecSecs] = useState(0);
  const [viewShot, setViewShot] = useState(null);
  const [night, setNight] = useState(false);
  const dialRef = useRef(null);

  async function startCamera(nextFacing) {
    // stop any previous stream first
    streamRef.current?.getTracks().forEach((t) => t.stop());
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("getUserMedia unavailable");
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: nextFacing || facing },
        audio: false,
      });
      streamRef.current = stream;
      setHasCamera(true);
    } catch (e) {
      streamRef.current = null;
      setHasCamera(false);
    }
  }

  // Attach the stream to the <video> element only once both exist —
  // the element is now always mounted, so this always succeeds when a stream is ready.
  useEffect(() => {
    if (hasCamera && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
    }
  }, [hasCamera]);

  useEffect(() => {
    startCamera(facing);
    return () => { streamRef.current?.getTracks().forEach((t) => t.stop()); };
    // eslint-disable-next-line
  }, []);

  function flipCamera() {
    const next = facing === "user" ? "environment" : "user";
    setFacing(next);
    setHasCamera(null);
    startCamera(next);
  }

  useEffect(() => {
    if (!recording) { setRecSecs(0); return; }
    const id = setInterval(() => setRecSecs((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [recording]);

  function capture() {
    setFlashFrame(true);
    setTimeout(() => setFlashFrame(false), 120);
    const canvas = canvasRef.current;
    const w = 240, h = 320;
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (hasCamera && videoRef.current && videoRef.current.videoWidth > 0) {
      ctx.save();
      if (facing === "user") { ctx.translate(w, 0); ctx.scale(-1, 1); }
      ctx.drawImage(videoRef.current, 0, 0, w, h);
      ctx.restore();
    } else {
      const grad = ctx.createLinearGradient(0, 0, w, h);
      grad.addColorStop(0, "#3a3a55"); grad.addColorStop(1, "#111116");
      ctx.fillStyle = grad; ctx.fillRect(0, 0, w, h);
    }
    const url = canvas.toDataURL("image/png");
    setShots((s) => [url, ...s].slice(0, 12));
  }

  function toggleRecord() {
    if (!recording) { setRecording(true); }
    else { setRecording(false); capture(); }
  }

  function onShutter() {
    if (mode === "VIDEO" || mode === "SLO-MO") toggleRecord();
    else capture();
  }

  // ---- Drag-up/down zoom dial (iPhone Camera Control style) ----
  const dragStart = useRef(null);
  const onDialDown = useCallback((e) => {
    setDragging(true);
    dragStart.current = { y: e.clientY, zoom };
    function move(ev) {
      const dy = dragStart.current.y - ev.clientY; // up = positive
      const newZoom = Math.min(10, Math.max(0.5, dragStart.current.zoom + dy / 60));
      setZoom(Math.round(newZoom * 10) / 10);
    }
    function up() {
      setDragging(false);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    }
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }, [zoom]);

  const flashCycle = () => setFlash((f) => (f === "off" ? "on" : f === "on" ? "auto" : "off"));

  return (
    <div className="w-full max-w-[430px] mx-auto h-[900px] relative overflow-hidden rounded-[28px] bg-black select-none">
      {/* Viewfinder — video element is ALWAYS mounted so the stream can attach reliably */}
      <div className="absolute inset-0 overflow-hidden bg-black" style={{ filter: night ? "brightness(1.25) saturate(0.9)" : "none" }}>
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
          style={{
            opacity: hasCamera ? 1 : 0,
            transform: `scale(${zoom}) ${facing === "user" ? "scaleX(-1)" : ""}`,
            transition: dragging ? "none" : "opacity .2s ease, transform .15s ease-out",
          }}
        />
        {hasCamera !== true && (
          <div
            className="absolute inset-0"
            style={{
              background: `radial-gradient(circle at 40% 30%, #3a3a55, #0c0c10 75%)`,
              transform: `scale(${zoom})`,
              transition: dragging ? "none" : "transform .15s ease-out",
            }}
          />
        )}
        {hasCamera === null && (
          <div className="absolute inset-0 flex items-center justify-center text-white/40 text-[13px]">Starting camera…</div>
        )}
        {hasCamera === false && (
          <div className="absolute inset-0 flex items-center justify-center px-10 text-center">
            <span className="text-white/50 text-[12.5px]">Camera permission unavailable in this preview — viewfinder simulated. Every control below still works.</span>
          </div>
        )}
      </div>

      {/* Flash frame effect */}
      {flashFrame && <div className="absolute inset-0 bg-white z-40" />}

      {/* Top controls */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-5 pt-12 z-10">
        <button onClick={flashCycle} className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "rgba(0,0,0,0.35)" }}>
          {flash === "off" ? <ZapOff size={17} className="text-white" /> : <Zap size={17} className="text-white" style={{ color: flash === "on" ? "#FFD54A" : "#fff" }} />}
        </button>
        <button onClick={() => setNight((n) => !n)} className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: night ? "#FFD54A33" : "rgba(0,0,0,0.35)" }}>
          <Moon size={16} className={night ? "text-[#FFD54A]" : "text-white"} />
        </button>
        <button className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "rgba(0,0,0,0.35)" }}>
          <Timer size={16} className="text-white" />
        </button>
        {recording && (
          <div className="absolute left-1/2 -translate-x-1/2 top-12 flex items-center gap-1.5 bg-black/40 px-2.5 py-1 rounded-full">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-white text-[12px] font-medium">{String(Math.floor(recSecs/60)).padStart(2,"0")}:{String(recSecs%60).padStart(2,"0")}</span>
          </div>
        )}
      </div>

      {/* Zoom readout */}
      <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col items-center gap-3 z-10">
        <div
          ref={dialRef}
          onPointerDown={onDialDown}
          className="w-11 h-44 rounded-full flex flex-col items-center justify-center cursor-grab active:cursor-grabbing relative"
          style={{ background: "rgba(255,255,255,0.12)" }}
        >
          <ChevronUp size={14} className="text-white/50 absolute top-2" />
          <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-[12px] font-semibold" style={{ background: dragging ? "#FFD54A" : "rgba(255,255,255,0.25)", color: dragging ? "#000" : "#fff" }}>
            {zoom}×
          </div>
          <span className="text-white/50 text-[10px] absolute bottom-2">drag</span>
        </div>
        <div className="flex flex-col gap-1.5 items-center">
          {ZOOM_STOPS.slice().reverse().map((z) => (
            <button key={z} onClick={() => setZoom(z)} className="text-[10.5px] px-1" style={{ color: Math.abs(zoom - z) < 0.05 ? "#FFD54A" : "rgba(255,255,255,0.55)", fontWeight: Math.abs(zoom - z) < 0.05 ? 700 : 400 }}>
              {z}×
            </button>
          ))}
        </div>
      </div>

      {/* Bottom controls */}
      <div className="absolute bottom-0 left-0 right-0 pb-10 pt-6 z-10" style={{ background: "linear-gradient(0deg, rgba(0,0,0,0.55), transparent)" }}>
        {/* Mode selector */}
        <div className="overflow-x-auto px-6 pb-4 flex gap-6 no-scrollbar" style={{ scrollbarWidth: "none" }}>
          {MODES.map((m) => (
            <button key={m} onClick={() => setMode(m)} className="shrink-0 text-[12.5px] tracking-wide font-medium" style={{ color: mode === m ? "#FFD54A" : "rgba(255,255,255,0.55)" }}>
              {m}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between px-8">
          {/* Filmstrip thumbnail */}
          <button onClick={() => shots[0] && setViewShot(shots[0])} className="w-11 h-11 rounded-lg overflow-hidden border border-white/30 flex items-center justify-center bg-white/10">
            {shots[0] ? <img src={shots[0]} className="w-full h-full object-cover" alt="last shot" /> : <span className="text-white/40 text-[10px]">Gallery</span>}
          </button>

          {/* Shutter */}
          <button onClick={onShutter} className="w-[76px] h-[76px] rounded-full border-4 border-white flex items-center justify-center">
            <div
              className="rounded-full transition-all"
              style={{
                width: recording ? 30 : (mode === "VIDEO" || mode === "SLO-MO") ? 60 : 62,
                height: recording ? 30 : (mode === "VIDEO" || mode === "SLO-MO") ? 60 : 62,
                borderRadius: recording ? 8 : "9999px",
                background: (mode === "VIDEO" || mode === "SLO-MO") ? "#F0537A" : "#fff",
              }}
            />
          </button>

          {/* Flip camera */}
          <button onClick={flipCamera} className="w-11 h-11 rounded-full flex items-center justify-center" style={{ background: "rgba(255,255,255,0.15)" }}>
            <SwitchCamera size={19} className="text-white" />
          </button>
        </div>
      </div>

      {/* Shot viewer */}
      {viewShot && (
        <div className="absolute inset-0 bg-black z-50 flex flex-col">
          <div className="flex justify-between items-center px-4 pt-12 pb-2">
            <button onClick={() => setViewShot(null)} className="text-white"><X size={24} /></button>
            <span className="text-white/70 text-[13px]">{shots.length} in filmstrip</span>
            <span className="w-6" />
          </div>
          <div className="flex-1 flex items-center justify-center px-4">
            <img src={viewShot} className="max-w-full max-h-full rounded-xl" alt="capture" />
          </div>
          <div className="flex gap-2 overflow-x-auto px-4 py-4">
            {shots.map((s, i) => (
              <button key={i} onClick={() => setViewShot(s)} className="w-14 h-14 shrink-0 rounded-lg overflow-hidden border" style={{ borderColor: s === viewShot ? "#FFD54A" : "transparent" }}>
                <img src={s} className="w-full h-full object-cover" alt="" />
              </button>
            ))}
          </div>
        </div>
      )}

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
