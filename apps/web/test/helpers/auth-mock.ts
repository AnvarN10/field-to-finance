import type { SessionUser } from "../../src/lib/auth/session";
import { RequestError } from "../../src/lib/errors";
import type { Permission } from "../../src/lib/permissions";
import { assertAccount, assertPermission } from "../../src/lib/workflow/guards";

/** `@/lib/server/auth` for action and route tests: the real permission and account checks over a test-chosen user. */
export function guardsFor(actor: () => SessionUser | null) {
  const signedIn = () => {
    const u = actor();
    if (!u) throw new RequestError("Your session expired. Sign in again.", 401);
    return u;
  };
  return {
    currentUser: async () => actor(),
    requirePermission: async (p: Permission) => assertPermission(signedIn(), p),
    requireAccount: async (k: "farmer" | "investor") => {
      const u = signedIn();
      assertAccount(u, k);
      return u;
    },
  };
}
