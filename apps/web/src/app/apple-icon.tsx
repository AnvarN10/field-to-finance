import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// Same field-row mark as icon.svg, full-bleed: iOS applies its own rounded mask.
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#F2C14E" }}>
        <svg width="180" height="180" viewBox="0 0 24 24">
          <path d="M6 15.5h12M6 12h12M6 8.5h8" stroke="#1A1405" strokeWidth="1.6" strokeLinecap="round" fill="none" />
        </svg>
      </div>
    ),
    size,
  );
}
