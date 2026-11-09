import type { PlayerDetailsInput } from "@/application/player-details";

import { formText } from "./form-data";

/** What the sign-up and profile forms send about the player (#340, #341), and what to show back. */
export type PlayerDetailsFields = {
  sex: string;
  disciplines: string[];
  club: { id: string; name: string; city: string } | null;
  newClubName: string;
  newClubCity: string;
};

/** Reads the sex, disciplines and club fields of a form (SexPicker, DisciplinePicker, ClubPicker). */
export function readPlayerDetails(data: FormData): {
  fields: PlayerDetailsFields;
  input: PlayerDetailsInput;
} {
  const clubId = formText(data, "clubId");
  const fields: PlayerDetailsFields = {
    sex: formText(data, "sex"),
    disciplines: data.getAll("discipline").filter((d): d is string => typeof d === "string"),
    club: clubId
      ? { id: clubId, name: formText(data, "clubName"), city: formText(data, "clubCity") }
      : null,
    newClubName: formText(data, "newClubName"),
    newClubCity: formText(data, "newClubCity"),
  };
  return {
    fields,
    input: {
      sex: fields.sex,
      disciplines: fields.disciplines,
      clubId,
      newClubName: fields.newClubName,
      newClubCity: fields.newClubCity,
    },
  };
}
