"use server";

import type { Role } from "@/lib/db/schema";
import { RequestError } from "@/lib/errors";
import { currentUser } from "@/lib/server/auth";
import { getDb } from "@/lib/server/db";
import { chooseRole } from "@/lib/workflow/users";

export type ChooseRoleResult = { ok: true; roles: Role[] } | { ok: false; error: string };

export async function chooseRoleAction(role: "farmer" | "investor"): Promise<ChooseRoleResult> {
  try {
    const user = await currentUser();
    if (!user) return { ok: false, error: "Your session expired. Sign in again." };
    return { ok: true, roles: await chooseRole(await getDb(), user, role) };
  } catch (e) {
    return { ok: false, error: e instanceof RequestError ? e.message : "Could not save your choice. Try again." };
  }
}
