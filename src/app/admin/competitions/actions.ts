"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  addCompetitionEvent,
  createCompetition,
  setCompetitionAthlete,
} from "@/application/create-competition";
import {
  deleteCompetition,
  deleteCompetitionEvent,
  editCompetition,
  editCompetitionEvent,
} from "@/application/edit-competition";
import { UseCaseError } from "@/application/errors";
import { computeManagerScores } from "@/application/manager-scores";
import {
  createSupabaseCompetitionAdminRepository,
  createSupabaseCompetitionEditRepository,
  createSupabaseManagerScoreRepository,
} from "@/infra";

import { formText } from "../../form-data";
import { adminOnly } from "../guard";

type Client = Awaited<ReturnType<typeof adminOnly>>["client"];

/** Runs a change, then goes to `done` or back to `back` with the error code. */
async function change(back: string, run: (client: Client) => Promise<string>) {
  const { client } = await adminOnly();
  let target: string;
  try {
    target = await run(client);
  } catch (error) {
    if (!(error instanceof UseCaseError)) throw error;
    target = `${back}${back.includes("?") ? "&" : "?"}erreur=${error.code}`;
  }
  revalidatePath("/admin/competitions");
  redirect(target);
}

export async function createCompetitionAction(data: FormData) {
  await change("/admin/competitions/nouvelle", async (client) => {
    const slug = await createCompetition({
      competitions: createSupabaseCompetitionAdminRepository(client),
    }).execute({
      name: formText(data, "name"),
      scope: formText(data, "scope"),
      venue: formText(data, "venue"),
      city: formText(data, "city"),
      countryCode: formText(data, "countryCode"),
      startsOn: formText(data, "startsOn"),
      endsOn: formText(data, "endsOn"),
    });
    return `/admin/competitions/${slug}?enregistre=1`;
  });
}

export async function addEventAction(data: FormData) {
  const competition = formText(data, "competition");
  await change(`/admin/competitions/${competition}`, async (client) => {
    await addCompetitionEvent({
      competitions: createSupabaseCompetitionAdminRepository(client),
    }).execute({
      competition,
      discipline: formText(data, "discipline"),
      gender: formText(data, "gender"),
      round: formText(data, "round"),
      localStart: formText(data, "localStart"),
      lockMinutes: Number(formText(data, "lockMinutes")),
    });
    return `/admin/competitions/${competition}?enregistre=1`;
  });
}

export async function setAthleteAction(data: FormData) {
  const competition = formText(data, "competition");
  const back = `/admin/competitions/${competition}?onglet=engages`;
  await change(back, async (client) => {
    await setCompetitionAthlete({
      competitions: createSupabaseCompetitionAdminRepository(client),
    }).execute({
      competition,
      athleteId: formText(data, "athleteId"),
      entered: formText(data, "entered") === "1",
    });
    return `${back}&enregistre=1`;
  });
}

export async function editCompetitionAction(data: FormData) {
  const slug = formText(data, "slug");
  await change(`/admin/competitions/${slug}/modifier`, async (client) => {
    await editCompetition({
      competitions: createSupabaseCompetitionEditRepository(client),
    }).execute({
      slug,
      name: formText(data, "name"),
      scope: formText(data, "scope"),
      venue: formText(data, "venue"),
      city: formText(data, "city"),
      countryCode: formText(data, "countryCode"),
      startsOn: formText(data, "startsOn"),
      endsOn: formText(data, "endsOn"),
    });
    return `/admin/competitions/${slug}?enregistre=1`;
  });
}

export async function deleteCompetitionAction(data: FormData) {
  const slug = formText(data, "slug");
  await change(`/admin/competitions/${slug}/modifier`, async (client) => {
    await deleteCompetition({
      competitions: createSupabaseCompetitionEditRepository(client),
    }).execute({ slug });
    return "/admin/competitions?enregistre=1";
  });
}

export async function editEventAction(data: FormData) {
  const eventSlug = formText(data, "eventSlug");
  await change(`/admin/${eventSlug}`, async (client) => {
    await editCompetitionEvent({
      competitions: createSupabaseCompetitionEditRepository(client),
    }).execute({
      eventSlug,
      round: formText(data, "round"),
      localStart: formText(data, "localStart"),
      lockMinutes: Number(formText(data, "lockMinutes")),
    });
    revalidatePath(`/admin/${eventSlug}`);
    return `/admin/${eventSlug}?enregistre=1`;
  });
}

export async function deleteEventAction(data: FormData) {
  const eventSlug = formText(data, "eventSlug");
  const competition = formText(data, "competition");
  await change(`/admin/${eventSlug}`, async (client) => {
    await deleteCompetitionEvent({
      competitions: createSupabaseCompetitionEditRepository(client),
    }).execute({ eventSlug });
    return `/admin/competitions/${competition}?enregistre=1`;
  });
}

/** Computes the Manager score of every participant playing the competition, again if need be (#431). */
export async function computeManagerScoresAction(data: FormData) {
  const competition = formText(data, "competition");
  await change(`/admin/competitions/${competition}`, async (client) => {
    const lines = await computeManagerScores({
      scores: createSupabaseManagerScoreRepository(client),
    }).execute({ competitionSlug: competition });
    return `/admin/competitions/${competition}?manager=${lines.length}`;
  });
}
