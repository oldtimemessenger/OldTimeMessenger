import React from "react";
import { FaceComparison } from "./_shared/FaceComparison";

export function Makeup() {
  return (
    <FaceComparison
      feature="03"
      title="Soft Color"
      description="Introduces a polished blush and lip tint direction while keeping the finish understated."
      amount="42% strength"
      afterClass="brightness-[1.04] contrast-[0.98] saturate-[1.16]"
      afterOverlay="radial-gradient(ellipse at 42% 59%, rgba(220,116,116,0.24), transparent 18%), radial-gradient(ellipse at 64% 59%, rgba(220,116,116,0.22), transparent 18%), radial-gradient(ellipse at 52% 69%, rgba(176,65,87,0.2), transparent 13%), linear-gradient(110deg, rgba(248,192,198,0.06), rgba(255,225,206,0.08))"
      accent="#b85f75"
      detail="Blush tint · lip color · natural contrast"
    />
  );
}