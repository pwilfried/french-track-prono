import type { SupabaseClient } from "@supabase/supabase-js";

import { UseCaseError } from "@/application/errors";
import type { AuthService } from "@/application/request-magic-link";

export function createSupabaseAuthService(client: SupabaseClient): AuthService {
  return {
    async sendEmailCode(email, redirectTo) {
      const { error } = await client.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: redirectTo, shouldCreateUser: true },
      });
      if (error) throw new UseCaseError("AUTH_UNAVAILABLE");
    },

    async verifyEmailCode(email, code) {
      const { data, error } = await client.auth.verifyOtp({ email, token: code, type: "email" });
      if (error) {
        // A refused code answers with a 4xx status; no status or a 5xx means the service failed.
        if (error.status !== undefined && error.status >= 400 && error.status < 500) return null;
        throw new UseCaseError("AUTH_UNAVAILABLE");
      }
      return data.user ? { userId: data.user.id } : null;
    },
  };
}
