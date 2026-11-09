import type { SupabaseClient } from "@supabase/supabase-js";

import type { EmailChangeService } from "@/application/change-email";
import { UseCaseError } from "@/application/errors";

/** The client must carry the player's session. Supabase sends the code to the new address. */
export function createSupabaseEmailChangeService(client: SupabaseClient): EmailChangeService {
  return {
    async request(newEmail) {
      const { error } = await client.auth.updateUser({ email: newEmail });
      if (!error) return "sent";
      if (error.code === "email_exists" || error.status === 422) return "taken";
      throw new UseCaseError("AUTH_UNAVAILABLE");
    },

    async confirm(newEmail, code) {
      const { error } = await client.auth.verifyOtp({
        email: newEmail,
        token: code,
        type: "email_change",
      });
      if (!error) return true;
      // A refused code answers with a 4xx status; no status or a 5xx means the service failed.
      if (error.status !== undefined && error.status >= 400 && error.status < 500) return false;
      throw new UseCaseError("AUTH_UNAVAILABLE");
    },
  };
}
