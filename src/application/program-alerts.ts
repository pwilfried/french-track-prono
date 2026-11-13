/**
 * « Me prévenir à la publication » (#659): on a competition whose programme is not published yet,
 * the player asks for one push notification when its first events are out.
 */

/** Port: the signed-in player's alerts. Real adapter = Supabase, fake = in memory. */
export interface ProgramAlertRepository {
  isOn(competitionSlug: string): Promise<boolean>;
  turnOn(competitionSlug: string): Promise<void>;
  turnOff(competitionSlug: string): Promise<void>;
}

/** Whether the player asked to be told when the programme of the competition is out. */
export function getProgramAlert(ports: { alerts: ProgramAlertRepository }) {
  return {
    execute: (input: { competitionSlug: string }): Promise<boolean> =>
      ports.alerts.isOn(input.competitionSlug),
  };
}

/** The player turns the alert on or off (turning it on twice changes nothing). */
export function setProgramAlert(ports: { alerts: ProgramAlertRepository }) {
  return {
    execute: (input: { competitionSlug: string; on: boolean }): Promise<void> =>
      input.on
        ? ports.alerts.turnOn(input.competitionSlug)
        : ports.alerts.turnOff(input.competitionSlug),
  };
}
