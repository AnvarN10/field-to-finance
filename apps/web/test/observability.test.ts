import { describe, expect, it } from "vitest";
import { posthogOptions, scrubEvent } from "../src/lib/observability";

describe("scrubEvent", () => {
  it("drops cookies, auth headers, query strings, bodies and user data", () => {
    const e = scrubEvent({
      request: {
        url: "https://f2f.example/api/kyc?email=a@b.c",
        cookies: { f2f_admin: "secret" },
        headers: { cookie: "f2f_admin=secret", authorization: "Bearer x", "user-agent": "ua" },
        data: { fullName: "Aigerim", email: "a@b.c" },
        query_string: "email=a@b.c",
      },
      user: { email: "a@b.c", ip_address: "1.2.3.4" },
      message: "boom",
    });
    expect(e.request).toEqual({ url: "https://f2f.example/api/kyc", headers: { "user-agent": "ua" } });
    expect(e.user).toBeUndefined();
    expect(e.message).toBe("boom");
  });
});

describe("scrubEvent and driver errors", () => {
  it("drops extra data and mechanism data, where postgres-js query parameters (BIN, names) would land", () => {
    const e = scrubEvent({
      extra: { query: "insert into farmer_profiles ...", parameters: ["Demo Farm LLP", "123456789012"] },
      exception: { values: [{ type: "PostgresError", mechanism: { type: "generic", data: { parameters: ["123456789012"] } } }] },
    });
    expect(e.extra).toBeUndefined();
    expect(JSON.stringify(e)).not.toContain("123456789012");
    expect((e.exception as { values: { type: string }[] }).values[0]!.type).toBe("PostgresError");
  });
});

describe("posthogOptions", () => {
  it("targets the EU host, disables recordings and registers app_env", () => {
    const o = posthogOptions("prod", "https://eu.i.posthog.com");
    expect(o.api_host).toBe("https://eu.i.posthog.com");
    expect(o.disable_session_recording).toBe(true);
    const calls: Record<string, unknown>[] = [];
    o.loaded({ register: (p: Record<string, unknown>) => calls.push(p), setPersonProperties: (p: Record<string, unknown>) => calls.push(p) });
    expect(calls).toEqual([{ app_env: "prod" }, { app_env: "prod" }]);
  });
});
