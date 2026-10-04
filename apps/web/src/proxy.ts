import type { NextRequest } from "next/server";
import { basicAuthResponse } from "@/lib/basic-auth";

// No matcher: the proxy runs on every request, static assets and server actions included. Only /api/health is public.
export function proxy(request: NextRequest) {
  return basicAuthResponse(request, process.env);
}

export const config = {};
