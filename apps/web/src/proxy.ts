import type { NextRequest } from "next/server";
import { basicAuthResponse } from "@/lib/basic-auth";
import { cabinetRedirect } from "@/lib/cabinet-redirect";

// No matcher: the proxy runs on every request, static assets and server actions included. Only /api/health is public.
export function proxy(request: NextRequest) {
  const gate = basicAuthResponse(request, process.env);
  // Basic auth answered (401/503): stop here. Passed: cabinets without a session cookie go to sign-in.
  if (gate.headers.get("x-middleware-next") !== "1") return gate;
  return cabinetRedirect(request) ?? gate;
}

export const config = {};
