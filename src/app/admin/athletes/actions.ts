"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { listDisciplines } from "@/application/disciplines";
import {
  createAthlete,
  editAthlete,
  editAthleteDiscipline,
  setAthletePrice,
} from "@/application/edit-athlete";
import { UseCaseError } from "@/application/errors";
import { setAthleteRecord } from "@/application/set-athlete-record";
import { createSupabaseAthleteAdminRepository, createSupabaseDisciplineRepository } from "@/infra";

import { formText } from "../../form-data";
import { adminOnly } from "../guard";

/** Runs one change, then comes back to the athlete page with "saved" or the error code. */
async function change(
  data: FormData,
  run: (client: Awaited<ReturnType<typeof adminOnly>>["client"]) => Promise<void>,
) {
  const { client } = await adminOnly();
  const slug = formText(data, "slug");
  let outcome = "enregistre=1";
  try {
    await run(client);
  } catch (error) {
    if (!(error instanceof UseCaseError)) throw error;
    outcome = `erreur=${error.code}`;
  }
  revalidatePath(`/athletes/${slug}`);
  redirect(`/admin/athletes/${slug}?${outcome}`);
}

export async function editAthleteAction(data: FormData) {
  await change(data, (client) =>
    editAthlete({ athletes: createSupabaseAthleteAdminRepository(client) }).execute({
      athleteId: formText(data, "athleteId"),
      name: formText(data, "name"),
      countryCode: formText(data, "countryCode"),
      gender: formText(data, "gender"),
    }),
  );
}

export async function editDisciplineAction(data: FormData) {
  const action = formText(data, "action");
  await change(data, (client) =>
    editAthleteDiscipline({ athletes: createSupabaseAthleteAdminRepository(client) }).execute({
      athleteId: formText(data, "athleteId"),
      discipline: formText(data, "discipline"),
      action: action === "main" || action === "remove" ? action : "add",
    }),
  );
}

export async function setPriceAction(data: FormData) {
  await change(data, (client) =>
    setAthletePrice({ athletes: createSupabaseAthleteAdminRepository(client) }).execute({
      athleteId: formText(data, "athleteId"),
      price: formText(data, "price"),
    }),
  );
}

export async function setRecordAction(data: FormData) {
  await change(data, async (client) => {
    const disciplines = await listDisciplines({
      disciplines: createSupabaseDisciplineRepository(client),
    }).execute();
    const discipline = disciplines.find((d) => d.name === formText(data, "discipline"));
    if (!discipline) throw new UseCaseError("DISCIPLINE_NOT_FOUND");
    const useCase = setAthleteRecord({ athletes: createSupabaseAthleteAdminRepository(client) });
    for (const kind of ["pr", "sb"] as const) {
      await useCase.execute({
        athleteId: formText(data, "athleteId"),
        discipline,
        kind,
        mark: formText(data, `${kind}Mark`),
        date: formText(data, `${kind}Date`),
      });
    }
  });
}

export async function createAthleteAction(data: FormData) {
  const { client } = await adminOnly();
  let target: string;
  try {
    const slug = await createAthlete({
      athletes: createSupabaseAthleteAdminRepository(client),
    }).execute({
      name: formText(data, "name"),
      countryCode: formText(data, "countryCode"),
      gender: formText(data, "gender"),
      discipline: formText(data, "discipline"),
    });
    target = `/admin/athletes/${slug}?enregistre=1`;
  } catch (error) {
    if (!(error instanceof UseCaseError)) throw error;
    target = `/admin/athletes?erreur=${error.code}`;
  }
  revalidatePath("/admin/athletes");
  redirect(target);
}
