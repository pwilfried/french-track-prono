import { UseCaseError } from "./errors";
import type { Profile, ProfileRepository } from "./create-profile";

export function getProfile(ports: { profiles: ProfileRepository }) {
  return {
    async execute(input: { userId: string }): Promise<Profile | null> {
      return ports.profiles.find(input.userId);
    },
  };
}

/**
 * The profile for the chrome of the app (proxy, header): "unavailable" instead of an error when it
 * cannot be read, so the page can still load. Unknown errors are bugs and stay visible.
 */
export function lookUpProfile(ports: { profiles: ProfileRepository }) {
  return {
    async execute(input: { userId: string }): Promise<Profile | null | "unavailable"> {
      try {
        return await ports.profiles.find(input.userId);
      } catch (error) {
        if (error instanceof UseCaseError) return "unavailable";
        throw error;
      }
    },
  };
}
