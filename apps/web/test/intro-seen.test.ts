// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { INTRO_MS, INTRO_SEEN_KEY, introSeenScript, markIntroSeen } from "../src/lib/intro-seen";

const html = () => document.documentElement;
const runScript = (storage: () => Storage) => new Function("document", "getStorage", introSeenScript.replace("sessionStorage", "getStorage()"))(document, storage);

function memoryStorage(): Storage {
  const m = new Map<string, string>();
  return {
    get length() { return m.size; },
    clear: () => m.clear(),
    getItem: (k) => m.get(k) ?? null,
    key: (i) => [...m.keys()][i] ?? null,
    removeItem: (k) => void m.delete(k),
    setItem: (k, v) => void m.set(k, String(v)),
  };
}
const throwing = (): Storage => { throw new DOMException("denied", "SecurityError"); };

beforeEach(() => html().removeAttribute("data-seen"));
afterEach(() => vi.useRealTimers());

describe("head script (runs before paint)", () => {
  it("leaves the intro on for the first view of the session", () => {
    const s = memoryStorage();
    runScript(() => s);
    expect(html().hasAttribute("data-seen")).toBe(false);
  });

  it("marks <html> seen when the session already watched the intro", () => {
    const s = memoryStorage();
    s.setItem(INTRO_SEEN_KEY, "1");
    runScript(() => s);
    expect(html().hasAttribute("data-seen")).toBe(true);
  });

  it("survives blocked storage and keeps the intro", () => {
    expect(() => runScript(throwing)).not.toThrow();
    expect(html().hasAttribute("data-seen")).toBe(false);
  });

  it("is a self-contained statement that reads sessionStorage", () => {
    expect(introSeenScript).toContain("sessionStorage");
    expect(introSeenScript).toContain(INTRO_SEEN_KEY);
  });
});

describe("markIntroSeen (landing mount)", () => {
  it("records the view and switches the intro off after it has played", () => {
    vi.useFakeTimers();
    const s = memoryStorage();
    markIntroSeen(html(), () => s);
    expect(s.getItem(INTRO_SEEN_KEY)).toBe("1");
    expect(html().hasAttribute("data-seen")).toBe(false);
    vi.advanceTimersByTime(INTRO_MS);
    expect(html().hasAttribute("data-seen")).toBe(true);
  });

  it("does nothing more once the intro is already off", () => {
    vi.useFakeTimers();
    html().setAttribute("data-seen", "");
    const spy = vi.spyOn(globalThis, "setTimeout");
    markIntroSeen(html(), memoryStorage);
    expect(spy).not.toHaveBeenCalled();
  });

  it("still switches the intro off when storage is blocked", () => {
    vi.useFakeTimers();
    expect(() => markIntroSeen(html(), throwing)).not.toThrow();
    vi.advanceTimersByTime(INTRO_MS);
    expect(html().hasAttribute("data-seen")).toBe(true);
  });

  it("outlasts the longest intro animation (field fill: 550 + 600 delay + 500ms)", () => {
    expect(INTRO_MS).toBeGreaterThanOrEqual(1650);
  });
});

describe("intro CSS is scoped to the first view", () => {
  const css = readFileSync(join(__dirname, "../src/app/globals.css"), "utf8");
  it.each(["hero-card", "intro-fade", "hero-field-line", "hero-field-casing", "hero-field-fill"])(".%s animates only under html:not([data-seen])", (cls) => {
    const rules = css.split("\n").filter((l) => new RegExp(`\\.${cls}\\b[^{]*\\{[^}]*animation`).test(l));
    expect(rules.length).toBeGreaterThan(0);
    for (const r of rules) expect(r).toMatch(new RegExp(`html:not\\(\\[data-seen\\]\\)[^{]*\\.${cls}`));
  });
});
