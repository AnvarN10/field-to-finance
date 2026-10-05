import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { basicAuthMode, basicAuthResponse, credentialsMatch, isPublicPath } from "../src/lib/basic-auth";
import { config, proxy } from "../src/proxy";

const header = (user: string, pass: string) => `Basic ${Buffer.from(`${user}:${pass}`).toString("base64")}`;
const env = (over: Record<string, string | undefined>) => ({ NODE_ENV: "production", ...over }) as NodeJS.ProcessEnv;
const req = (path: string, auth?: string, method = "GET") =>
  new NextRequest(`https://f2f.example${path}`, { method, headers: auth ? { authorization: auth } : {} });

describe("basic auth credentials", () => {
  it("accepts only the exact user and password", () => {
    expect(credentialsMatch(header("demo", "s3cret:pass"), "demo", "s3cret:pass")).toBe(true);
    expect(credentialsMatch(header("demo", "wrong"), "demo", "s3cret:pass")).toBe(false);
    expect(credentialsMatch(header("other", "s3cret:pass"), "demo", "s3cret:pass")).toBe(false);
    expect(credentialsMatch(header("demo", "s3cret"), "demo", "s3cret:pass")).toBe(false);
  });

  it("rejects missing, malformed and non-Basic headers", () => {
    expect(credentialsMatch(null, "demo", "pw")).toBe(false);
    expect(credentialsMatch("", "demo", "pw")).toBe(false);
    expect(credentialsMatch("Bearer abc", "demo", "pw")).toBe(false);
    expect(credentialsMatch("Basic !!!not-base64", "demo", "pw")).toBe(false);
    expect(credentialsMatch(`Basic ${Buffer.from("demopw").toString("base64")}`, "demo", "pw")).toBe(false);
  });

  it("accepts a lowercase scheme as RFC 7617 allows", () => {
    expect(credentialsMatch(header("demo", "pw").replace("Basic", "basic"), "demo", "pw")).toBe(true);
  });
});

describe("basic auth mode", () => {
  it("is on when both variables are set", () => {
    expect(basicAuthMode(env({ BASIC_AUTH_USER: "u", BASIC_AUTH_PASSWORD: "p" }))).toEqual({ kind: "on", user: "u", password: "p" });
  });

  it("is off outside production when unset", () => {
    expect(basicAuthMode(env({ NODE_ENV: "development" }))).toEqual({ kind: "off" });
    expect(basicAuthMode(env({ NODE_ENV: "test", BASIC_AUTH_USER: "u" }))).toEqual({ kind: "off" });
  });

  it("fails closed in production when either variable is missing", () => {
    expect(basicAuthMode(env({}))).toEqual({ kind: "locked" });
    expect(basicAuthMode(env({ BASIC_AUTH_USER: "u" }))).toEqual({ kind: "locked" });
    expect(basicAuthMode(env({ BASIC_AUTH_PASSWORD: "p" }))).toEqual({ kind: "locked" });
  });
});

describe("public paths", () => {
  it("only the healthcheck is public", () => {
    expect(isPublicPath("/api/health")).toBe(true);
    for (const p of ["/", "/api/health/x", "/api/healthz", "/api/evidence/ab", "/api/polygons/ab", "/admin", "/pools/1", "/_next/static/a.js"]) {
      expect(isPublicPath(p)).toBe(false);
    }
  });
});

describe("basic auth response", () => {
  const on = { BASIC_AUTH_USER: "demo", BASIC_AUTH_PASSWORD: "pw" };

  it("asks for credentials on pages and API routes", () => {
    for (const p of ["/", "/pools/5", "/api/evidence/abc", "/api/polygons/abc", "/api/tx/subscribe", "/admin"]) {
      const res = basicAuthResponse(req(p), env(on));
      expect(res.status).toBe(401);
      expect(res.headers.get("www-authenticate")).toBe('Basic realm="Field-to-Finance", charset="UTF-8"');
    }
  });

  it("rejects wrong credentials and server action posts without them", () => {
    expect(basicAuthResponse(req("/pools", header("demo", "nope")), env(on)).status).toBe(401);
    expect(basicAuthResponse(req("/admin", undefined, "POST"), env(on)).status).toBe(401);
  });

  it("lets correct credentials through", () => {
    const res = basicAuthResponse(req("/pools/5", header("demo", "pw")), env(on));
    expect(res.status).toBe(200);
    expect(res.headers.get("x-middleware-next")).toBe("1");
  });

  it("never asks the healthcheck for credentials", () => {
    expect(basicAuthResponse(req("/api/health"), env(on)).status).toBe(200);
    expect(basicAuthResponse(req("/api/health"), env({})).status).toBe(200);
  });

  it("refuses everything but the healthcheck in production without configured credentials", () => {
    const res = basicAuthResponse(req("/", header("demo", "pw")), env({}));
    expect(res.status).toBe(503);
    expect(res.headers.get("www-authenticate")).toBeNull();
  });

  it("is a pass-through in development without credentials", () => {
    expect(basicAuthResponse(req("/admin"), env({ NODE_ENV: "development" })).status).toBe(200);
  });

  it("never echoes the expected password", async () => {
    const res = basicAuthResponse(req("/", header("demo", "x")), env(on));
    expect(await res.text()).not.toContain("pw");
  });

  it("the proxy reads credentials from process.env", () => {
    const saved = { u: process.env.BASIC_AUTH_USER, p: process.env.BASIC_AUTH_PASSWORD };
    process.env.BASIC_AUTH_USER = "demo";
    process.env.BASIC_AUTH_PASSWORD = "pw";
    try {
      expect(proxy(req("/")).status).toBe(401);
      expect(proxy(req("/", header("demo", "pw"))).status).toBe(200);
      // Past basic auth, a cabinet without a session cookie redirects to sign-in; without basic auth it stays 401.
      expect(proxy(req("/farmer", header("demo", "pw"))).status).toBe(307);
      expect(proxy(req("/farmer")).status).toBe(401);
    } finally {
      if (saved.u === undefined) delete process.env.BASIC_AUTH_USER; else process.env.BASIC_AUTH_USER = saved.u;
      if (saved.p === undefined) delete process.env.BASIC_AUTH_PASSWORD; else process.env.BASIC_AUTH_PASSWORD = saved.p;
    }
  });

  it("runs on every path, static assets included", () => {
    for (const url of ["/", "/api/health", "/_next/static/chunks/a.js", "/samples/demo-fields.geojson", "/api/instrument/1"]) {
      expect(unstable_doesMiddlewareMatch({ config, url })).toBe(true);
    }
  });
});
