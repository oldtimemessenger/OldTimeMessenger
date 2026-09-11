import React from "react";
import { FaceComparison } from "./_shared/FaceComparison";

export function Glow() {
  return (
    <FaceComparison
      feature="02"
      title="Studio Glow"
      description="Adds a warm portrait-light finish so the face feels brighter without looking overexposed."
      amount="42% strength"
      afterClass="brightness-[1.1] contrast-[0.92] saturate-[1.08]"
      afterOverlay="radial-gradient(circle at 52% 26%, rgba(255,236,207,0.5), transparent 46%), linear-gradient(135deg, rgba(245,181,130,0.12), rgba(255,255,255,0.08))"
      accent="#d18b55"
      detail="Warm light · lifted shadows · soft highlight"
    />
  );
}