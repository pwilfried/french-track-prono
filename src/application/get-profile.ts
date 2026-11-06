import type { Profile, ProfileRepository } from "./create-profile";

export function getProfile(ports: { profiles: ProfileRepository }) {
  return {
    async execute(input: { userId: string }): Promise<Profile | null> {
      return ports.profiles.find(input.userId);
    },
  };
}
