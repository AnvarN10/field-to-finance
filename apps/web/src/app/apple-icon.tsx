import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// Same mark as icon.svg, full-bleed: iOS applies its own rounded mask.
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#F2C14E" }}>
        <svg width="180" height="180" viewBox="0 0 24 24">
          <circle cx="12" cy="8.3" r="3" fill="#1A1405" />
          <path d="M4.5 13.5h15M12 13.5V25M10.2 13.5 5 25M13.8 13.5 19 25M8.4 13.5-1 25M15.6 13.5 25 25" stroke="#1A1405" strokeWidth="1.5" strokeLinecap="round" fill="none" />
        </svg>
      </div>
    ),
    size,
  );
}
