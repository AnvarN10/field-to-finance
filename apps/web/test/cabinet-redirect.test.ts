import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { cabinetRedirect } from "../src/lib/cabinet-redirect";

const req = (path: string, cookie?: string) => new NextRequest(`https://f2f.example${path}`, { headers: cookie ? { cookie } : {} });

describe("cabinetRedirect", () => {
  it("sends a visitor without a session cookie from a cabinet to sign-in with the path", () => {
    const r = cabinetRedirect(req("/arranger/roles?x=1"));
    expect(r?.status).toBe(307);
    expect(r?.headers.get("location")).toBe("https://f2f.example/sign-in?next=%2Farranger%2Froles%3Fx%3D1");
  });

  it("lets cabinet requests with a session cookie through (the page verifies it)", () => {
    expect(cabinetRedirect(req("/farmer", "f2f_session=tok"))).toBeNull();
  });

  it("ignores other paths and look-alike prefixes", () => {
    expect(cabinetRedirect(req("/pools/7"))).toBeNull();
    expect(cabinetRedirect(req("/farmers-market"))).toBeNull();
    expect(cabinetRedirect(req("/investor"))?.status).toBe(307);
  });

  it("lets a server action POST without a cookie reach the action, which answers \"Sign in again\"", () => {
    const post = new NextRequest("https://f2f.example/farmer/applications/1", { method: "POST", headers: { "next-action": "abc123" } });
    expect(cabinetRedirect(post)).toBeNull();
    const plainPost = new NextRequest("https://f2f.example/arranger", { method: "POST" });
    expect(cabinetRedirect(plainPost)).toBeNull();
    expect(cabinetRedirect(req("/arranger"))?.status).toBe(307);
  });
});
