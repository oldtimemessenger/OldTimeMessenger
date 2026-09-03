import { useState } from "react";
import {
  ArrowRight,
  Flame,
  LocateFixed,
  MapPin,
  Mic,
  Navigation,
  Plus,
  Search,
  X,
} from "lucide-react";
import "./_group.css";

const stories = [
  { name: "Maya", initials: "M", color: "#e9774c", x: 97, y: 390 },
  { name: "Andre", initials: "A", color: "#437e92", x: 262, y: 300 },
  { name: "Jules", initials: "J", color: "#8b5bb8", x: 322, y: 494 },
  { name: "Nia", initials: "N", color: "#dc9b38", x: 181, y: 512 },
];

function StoryBubble({
  story,
  onClick,
}: {
  story: (typeof stories)[number];
  onClick: () => void;
}) {
  return (
    <button
      className="story-bubble"
      style={{ left: story.x, top: story.y }}
      onClick={onClick}
      aria-label={`Open ${story.name}'s Story`}
    >
      <span className="story-ring">
        <span className="story-face" style={{ background: story.color }}>{story.initials}</span>
      </span>
    </button>
  );
}

export function MapPreview() {
  const [heatEnabled, setHeatEnabled] = useState(true);
  const [placement, setPlacement] = useState(false);
  const [storyOpen, setStoryOpen] = useState<string | null>(null);

  return (
    <main className="map-preview">
      <svg className="map-art" viewBox="0 0 402 874" role="img" aria-label="Muted map with transparent activity glow">
        <defs>
          <radialGradient id="heatCyan"><stop offset="0" stopColor="#20c8dc" stopOpacity=".35" /><stop offset="1" stopColor="#20c8dc" stopOpacity="0" /></radialGradient>
          <radialGradient id="heatGreen"><stop offset="0" stopColor="#5bd39a" stopOpacity=".33" /><stop offset="1" stopColor="#5bd39a" stopOpacity="0" /></radialGradient>
          <radialGradient id="heatHot"><stop offset="0" stopColor="#ff9d39" stopOpacity=".42" /><stop offset=".38" stopColor="#f05248" stopOpacity=".28" /><stop offset="1" stopColor="#f05248" stopOpacity="0" /></radialGradient>
          <filter id="softShadow"><feDropShadow dx="0" dy="3" stdDeviation="5" floodColor="#263642" floodOpacity=".18" /></filter>
        </defs>

        {/* Muted standard-map base: land, water, roads, then activity overlay. */}
        <rect width="402" height="874" fill="#e6ecef" />
        <path d="M0 80 C48 52 87 70 111 108 C131 140 119 184 82 206 C47 228 25 273 0 292Z" fill="#cbdde3" />
        <path d="M402 0 L402 185 C369 177 355 143 365 111 C373 81 390 48 402 0Z" fill="#cbdde3" />
        <path d="M0 663 C60 642 82 664 111 711 C135 749 171 766 209 760 C238 756 250 784 244 818 C240 846 211 860 185 874 L0 874Z" fill="#d0e0e2" />
        <path d="M315 0 C286 72 298 112 337 148 C362 172 361 217 337 253 C307 297 303 340 325 375 C345 407 340 443 305 474 C272 504 272 549 298 581" fill="none" stroke="#f7fafb" strokeWidth="25" opacity=".9" />
        <path d="M-30 600 C42 579 103 575 158 600 C210 624 248 616 288 588 C333 556 374 561 432 585" fill="none" stroke="#ffffff" strokeWidth="15" opacity=".95" />
        <path d="M-20 351 C50 327 88 338 137 368 C185 397 220 390 269 361 C319 331 355 324 430 343" fill="none" stroke="#ffffff" strokeWidth="11" opacity=".95" />
        <path d="M112 -20 C119 75 143 128 187 178 C222 219 236 264 225 319 C216 365 225 419 262 470 C297 517 302 573 280 632 C266 670 264 732 292 894" fill="none" stroke="#ffffff" strokeWidth="8" opacity=".9" />
        <path d="M36 0 C63 80 79 143 67 207 C57 263 70 304 114 356 C151 400 161 454 146 510 C131 569 143 616 180 665 C211 706 216 778 197 894" fill="none" stroke="#ffffff" strokeWidth="5" opacity=".92" />
        <path d="M14 438 C86 449 132 449 181 430 C233 410 297 414 414 453" fill="none" stroke="#c4cdd1" strokeWidth="2" />
        <path d="M4 281 C81 295 136 294 192 272 C257 247 328 250 410 276" fill="none" stroke="#c4cdd1" strokeWidth="2" />
        <path d="M145 0 C166 79 203 118 249 141 C292 164 311 204 303 254" fill="none" stroke="#c4cdd1" strokeWidth="2" />

        {/* Separate, transparent activity overlay. */}
        {heatEnabled && (
          <>
            <circle cx="111" cy="395" r="110" fill="url(#heatCyan)" />
            <circle cx="266" cy="315" r="126" fill="url(#heatGreen)" />
            <circle cx="315" cy="501" r="105" fill="url(#heatHot)" />
            <circle cx="185" cy="535" r="78" fill="url(#heatCyan)" />
          </>
        )}

        {/* Labels remain above the translucent glow. */}
        <g fill="#52626d" fontSize="12" fontWeight="600" letterSpacing=".2">
          <text x="31" y="248">Clearwater</text>
          <text x="74" y="321">Tampa</text>
          <text x="249" y="229">Spring Hill</text>
          <text x="283" y="574">Lakeland</text>
          <text x="130" y="716">St. Petersburg</text>
          <text x="292" y="703">Orlando</text>
        </g>
        <g fill="#778791" fontSize="8" fontWeight="500">
          <text x="52" y="261">Gulf of Mexico</text>
          <text x="242" y="244">State Road 52</text>
          <text x="291" y="588">I-4</text>
        </g>
      </svg>

      <button className="happening-pill" onClick={() => setStoryOpen("live")} aria-label="Open What's happening">
        <Mic size={15} />
        <strong>What&apos;s happening</strong>
        <span className="live-dot" />
        <span>4</span>
      </button>

      <div className="map-controls">
        <button
          className={`map-control ${heatEnabled ? "active" : ""}`}
          onClick={() => setHeatEnabled((enabled) => !enabled)}
          aria-label={heatEnabled ? "Hide activity glow" : "Show activity glow"}
        >
          <Flame size={20} />
        </button>
        <button className="map-control" aria-label="Recenter map"><LocateFixed size={20} /></button>
        <button className="map-control primary" onClick={() => setPlacement(true)} aria-label="Post a location"><Plus size={22} /></button>
      </div>

      {stories.map((story) => <StoryBubble key={story.name} story={story} onClick={() => setStoryOpen(story.name)} />)}

      <div className="map-pin pin-one"><MapPin size={17} fill="#fff" /></div>
      <div className="map-pin pin-two"><Navigation size={15} fill="#fff" /></div>

      {!placement && !storyOpen && (
        <section className="story-tray">
          <div className="tray-heading"><span><Flame size={14} /> Stories on the map</span><small>4 nearby</small></div>
          <div className="tray-stories">
            {stories.map((story) => (
              <button key={story.name} className="tray-story" onClick={() => setStoryOpen(story.name)}>
                <span className="tray-avatar" style={{ background: story.color }}>{story.initials}</span>
                <span>{story.name}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {storyOpen && storyOpen !== "live" && (
        <section className="story-preview">
          <span className="preview-avatar">{storyOpen[0]}</span>
          <div><strong>{storyOpen}</strong><p>Posted from this area · tap to view</p></div>
          <button className="preview-play" onClick={() => setStoryOpen(null)}><ArrowRight size={17} /></button>
          <button className="preview-close" onClick={() => setStoryOpen(null)} aria-label="Close Story preview"><X size={16} /></button>
        </section>
      )}

      {storyOpen === "live" && (
        <section className="live-sheet">
          <button className="preview-close" onClick={() => setStoryOpen(null)} aria-label="Close What's happening"><X size={16} /></button>
          <span className="eyebrow">LIVE NOW</span>
          <strong>Local conversations are active</strong>
          <p>Four people are sharing what is happening nearby.</p>
        </section>
      )}

      {placement && (
        <section className="placement-panel">
          <div className="panel-title"><div><strong>Choose where to post</strong><p>Move the map anywhere. The marker stays centered.</p></div><button onClick={() => setPlacement(false)} aria-label="Cancel"><X size={19} /></button></div>
          <div className="search-box"><Search size={17} /><input placeholder="Search a city, venue, or address" /><button aria-label="Search"><ArrowRight size={18} /></button></div>
          <div className="placement-actions"><button className="secondary-action"><LocateFixed size={16} /> My location</button><button className="primary-action" onClick={() => setPlacement(false)}><MapPin size={16} /> Post here</button></div>
        </section>
      )}
    </main>
  );
}