// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
const { NotificationBell } = await import("../src/components/cabinet/notification-bell");

const items = [
  { id: "1", title: "KYC approved", body: "Accept a pool's key features document to subscribe.", createdAt: "2026-10-05T10:00:00.000Z", readAt: null, link: "/investor" },
  { id: "2", title: "New pool open: wheat 2027", body: "Read its key features.", createdAt: "2026-10-05T09:00:00.000Z", readAt: null, link: null },
];

afterEach(() => vi.unstubAllGlobals());

describe("NotificationBell", () => {
  it("shows the unread count, lists notifications and marks them read", async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) =>
      init?.method === "POST" ? Response.json({ ok: true }) : Response.json({ ok: true, unread: 2, items }),
    );
    vi.stubGlobal("fetch", fetchMock);
    render(<NotificationBell />);
    const button = await screen.findByRole("button", { name: "Notifications, 2 unread" });
    await userEvent.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("KYC approved")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /KYC approved/ })).toHaveAttribute("href", "/investor");
    await userEvent.click(screen.getByRole("button", { name: "Mark all read" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Notifications" })).toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledWith("/api/notifications", expect.objectContaining({ method: "POST" }));
  });

  it("closes on Escape and stays quiet when the request fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline"); }));
    render(<NotificationBell />);
    const button = screen.getByRole("button", { name: "Notifications" });
    await userEvent.click(button);
    expect(screen.getByText("Nothing new.")).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    expect(button).toHaveAttribute("aria-expanded", "false");
  });
});
