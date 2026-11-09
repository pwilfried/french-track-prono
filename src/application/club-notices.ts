/** What the admin did to the club a player chose (#372). */
export type ClubNotice = {
  id: string;
  kind: "validated" | "renamed" | "removed" | "merged";
  clubName: string;
  newName: string | null;
};

/** Port: the signed-in player's unseen club notices. Real adapter = Supabase, fake = in memory. */
export interface ClubNoticeRepository {
  listUnseen(): Promise<ClubNotice[]>;
  dismiss(id: string): Promise<void>;
}

export function getClubNotices(ports: { notices: ClubNoticeRepository }) {
  return { execute: () => ports.notices.listUnseen() };
}

export function dismissClubNotice(ports: { notices: ClubNoticeRepository }) {
  return { execute: (input: { id: string }) => ports.notices.dismiss(input.id) };
}
