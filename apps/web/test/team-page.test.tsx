// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
const inviteAction = vi.fn(async (email: string, roles: string[]) =>
  email === "refused@example.com" ? { ok: false as const, error: "You do not have permission to manage the team." } : { ok: true as const, link: `http://localhost:3000/invite/${"t".repeat(43)}`, expiresAt: "2026-10-14T10:00:00.000Z", roles },
);
const setMemberRolesAction = vi.fn(async () => ({ ok: true as const, message: "Roles saved", signatures: [] }));
vi.mock("../src/app/console/_actions/team", () => ({
  inviteAction: (...a: unknown[]) => inviteAction(...(a as [string, string[]])),
  setMemberRolesAction: (...a: unknown[]) => setMemberRolesAction(...(a as [])),
  revokeInvitationAction: vi.fn(),
}));
const { InviteForm } = await import("../src/components/console/invite-form");
const { PermissionMatrix } = await import("../src/components/console/permission-matrix");
const { MemberRoles } = await import("../src/components/console/member-roles");

describe("InviteForm", () => {
  it("needs a role, then shows the link once with copy and expiry", async () => {
    render(<InviteForm />);
    await userEvent.type(screen.getByLabelText("Email"), "partner@example.com");
    expect(screen.getByRole("button", { name: "Create invitation" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Create invitation" })).toHaveAccessibleDescription("Choose at least one role.");
    await userEvent.click(screen.getByRole("checkbox", { name: /Elevator/ }));
    await userEvent.click(screen.getByRole("button", { name: "Create invitation" }));
    expect(inviteAction).toHaveBeenCalledWith("partner@example.com", ["elevator"]);
    const link = await screen.findByRole("textbox", { name: "Invitation link" });
    expect(link).toHaveValue(`http://localhost:3000/invite/${"t".repeat(43)}`);
    expect(screen.getByRole("button", { name: "Copy link" })).toBeInTheDocument();
    expect(screen.getByText(/shown once/i)).toBeInTheDocument();
    expect(screen.getByText(/Expires/)).toBeInTheDocument();
  });

  it("shows the server's refusal", async () => {
    render(<InviteForm />);
    await userEvent.type(screen.getByLabelText("Email"), "refused@example.com");
    await userEvent.click(screen.getByRole("checkbox", { name: /Regulator/ }));
    await userEvent.click(screen.getByRole("button", { name: "Create invitation" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("You do not have permission to manage the team.");
  });
});

describe("MemberRoles", () => {
  it("saves the edited console roles", async () => {
    render(<MemberRoles userId="u1" email="co@example.com" roles={["compliance"]} />);
    await userEvent.click(screen.getByRole("button", { name: "Edit roles for co@example.com" }));
    await userEvent.click(screen.getByRole("checkbox", { name: /SCAS partner/ }));
    await userEvent.click(screen.getByRole("button", { name: "Save roles" }));
    expect(setMemberRolesAction).toHaveBeenCalledWith("u1", ["compliance", "scas"]);
  });
});

describe("MemberRoles removal", () => {
  it("asks before removing a member with no roles", async () => {
    setMemberRolesAction.mockClear();
    render(<MemberRoles userId="u2" email="el@example.com" roles={["elevator"]} />);
    await userEvent.click(screen.getByRole("button", { name: "Edit roles for el@example.com" }));
    await userEvent.click(screen.getByRole("checkbox", { name: /Elevator/ }));
    await userEvent.click(screen.getByRole("button", { name: "Remove from console" }));
    expect(setMemberRolesAction).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Yes, remove from console" }));
    expect(setMemberRolesAction).toHaveBeenCalledWith("u2", []);
  });
});

describe("PermissionMatrix", () => {
  it("lists every permission against every console role", () => {
    render(<PermissionMatrix />);
    const table = screen.getByRole("table");
    expect(within(table).getAllByRole("row")).toHaveLength(19);
    expect(within(table).getByRole("columnheader", { name: "Regulator" })).toBeInTheDocument();
  });
});
