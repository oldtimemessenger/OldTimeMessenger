import React from "react";
import { FaceComparison } from "./_shared/FaceComparison";

export function Retouch() {
  return (
    <FaceComparison
      feature="01"
      title="Natural Retouch"
      description="Softens harsh texture and balances the portrait while keeping the face recognizable and real."
      amount="42% strength"
      afterClass="brightness-[1.06] contrast-[0.96] saturate-[1.03]"
      accent="#b87c68"
      detail="Texture softened · highlights balanced · detail preserved"
    />
  );
}