// Signature "Old Time" wallpaper intentionally omits an embedded base64 tile
// here to keep the repo small — drop the real PNGs into ./assets/wallpapers/
// and wire them into the "signature" entry below (tileLight / tileDark).
export const WALLPAPERS = [
  { id: "default", name: "Default", css: null },
  { id: "signature", name: "Old Time", adaptive: true, bgLight: "#FAF6EC", bgDark: "#0F131A" },
  { id: "solid-teal", name: "Deep Teal", css: "#0E2B2B" },
  { id: "solid-navy", name: "Midnight", css: "#0B1330" },
  { id: "solid-plum", name: "Plum", css: "#2A1330" },
  { id: "solid-forest", name: "Forest", css: "#132A1C" },
  { id: "solid-cream", name: "Cream", css: "#F5EFE0" },
  { id: "grad-sunset", name: "Sunset", from: "#FF9966", to: "#FF5E62" },
  { id: "grad-ocean", name: "Ocean", from: "#2193b0", to: "#6dd5ed" },
  { id: "grad-dusk", name: "Dusk", from: "#41295a", to: "#2F0743" },
  { id: "grad-mint", name: "Mint", from: "#0BAB64", to: "#3BB78F" },
  { id: "grad-berry", name: "Berry", from: "#C33764", to: "#1D2671" },
  { id: "grad-gold", name: "Gold", from: "#BF953F", to: "#FCF6BA" },
];
