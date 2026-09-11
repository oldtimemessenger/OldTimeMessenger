import React from "react";

type FaceComparisonProps = {
  feature: string;
  title: string;
  description: string;
  amount: string;
  afterClass: string;
  afterOverlay?: string;
  accent: string;
  detail: string;
};

const portrait = "/__mockup/images/face-filter-subject.png";

export function FaceComparison({
  feature,
  title,
  description,
  amount,
  afterClass,
  afterOverlay,
  accent,
  detail,
}: FaceComparisonProps) {
  return (
    <main className="min-h-screen bg-[#f5f1ec] px-5 py-5 text-[#231f20]">
      <div className="mx-auto flex min-h-[780px] max-w-[520px] flex-col">
        <header className="mb-4 flex items-start justify-between">
          <div>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#8a817c]">
              Face studio / live preview
            </p>
            <h1 className="text-[28px] font-semibold leading-[1.05] tracking-[-0.04em]">
              {title}
            </h1>
            <p className="mt-2 max-w-[310px] text-[13px] leading-5 text-[#756d68]">
              {description}
            </p>
          </div>
          <div
            className="rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-white"
            style={{ backgroundColor: accent }}
          >
            {feature}
          </div>
        </header>

        <section className="grid grid-cols-2 gap-2.5">
          <div className="overflow-hidden rounded-[22px] bg-[#d8d0c9] shadow-[0_12px_32px_rgba(49,38,31,0.10)]">
            <div className="relative aspect-[0.78] overflow-hidden">
              <img
                src={portrait}
                alt="Portrait before applying the face filter"
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-x-3 bottom-3 flex items-center justify-between">
                <span className="rounded-full bg-black/55 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.15em] text-white backdrop-blur">
                  Before
                </span>
                <span className="rounded-full bg-white/75 px-2.5 py-1 text-[10px] font-medium text-[#3d3531] backdrop-blur">
                  Camera
                </span>
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-[22px] bg-[#d8d0c9] shadow-[0_12px_32px_rgba(49,38,31,0.14)]">
            <div className="relative aspect-[0.78] overflow-hidden">
              <img
                src={portrait}
                alt={`Portrait after applying ${title}`}
                className={`h-full w-full object-cover ${afterClass}`}
              />
              {afterOverlay ? (
                <div
                  className="pointer-events-none absolute inset-0 mix-blend-color"
                  style={{ background: afterOverlay }}
                />
              ) : null}
              <div className="absolute inset-x-3 bottom-3 flex items-center justify-between">
                <span
                  className="rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.15em] text-white"
                  style={{ backgroundColor: accent }}
                >
                  After
                </span>
                <span className="rounded-full bg-white/80 px-2.5 py-1 text-[10px] font-medium text-[#3d3531] backdrop-blur">
                  {amount}
                </span>
              </div>
            </div>
          </div>
        </section>

        <div className="mt-4 rounded-[20px] border border-[#e3dbd4] bg-white/75 p-4 shadow-[0_10px_30px_rgba(49,38,31,0.06)]">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-[12px] font-semibold text-[#332d2a]">
                {feature} intensity
              </p>
              <p className="mt-1 text-[11px] text-[#8a817c]">{detail}</p>
            </div>
            <span className="text-[12px] font-bold" style={{ color: accent }}>
              42%
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-[#ece6e0]">
            <div
              className="h-1.5 w-[42%] rounded-full"
              style={{ backgroundColor: accent }}
            />
          </div>
          <div className="mt-3 flex justify-between text-[10px] uppercase tracking-[0.12em] text-[#a19891]">
            <span>Subtle</span>
            <span>Full look</span>
          </div>
        </div>

        <div className="mt-auto flex items-center justify-between pt-5">
          <div className="flex items-center gap-2">
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: accent }}
            />
            <span className="text-[11px] text-[#756d68]">
              Same face, controlled effect
            </span>
          </div>
          <button
            type="button"
            className="rounded-full bg-[#231f20] px-4 py-2 text-[11px] font-semibold text-white transition-transform hover:scale-[1.03]"
          >
            Try this look
          </button>
        </div>
      </div>
    </main>
  );
}