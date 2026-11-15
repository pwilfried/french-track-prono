import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";

import type { Club } from "@/application/clubs";
import { messages } from "@/app/messages.fr";
import { profileFamilyAnimal } from "@/domain/profile-reminder";

import {
  CompleteProfileCard,
  EMPTY_COMPLETE_PROFILE,
  type CompleteProfileState,
} from "./complete-profile-card";

const text = messages.playerHome.completeProfile;

type Save = (state: CompleteProfileState, data: FormData) => Promise<CompleteProfileState>;

const club: Club = {
  id: "club-1",
  name: "Athlé Club de Testville",
  city: "Testville",
  department: "75",
  validated: true,
};

const meta = {
  title: "Home/CompleteProfileCard",
  component: CompleteProfileCard,
  args: {
    firstPodium: false,
    bib: { number: 42, color: "blue" },
    pseudo: "Testeur",
    initial: EMPTY_COMPLETE_PROFILE,
    search: fn(async () => [club]),
    save: fn<Save>(async (state) => ({ ...state, done: true })),
    later: fn(async () => {}),
  },
  decorators: [
    (Story) => (
      <div className="max-w-[390px] bg-background p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof CompleteProfileCard>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Opens the sheet from the compact card. */
async function openSheet(canvasElement: HTMLElement) {
  const canvas = within(canvasElement);
  await userEvent.click(canvas.getByRole("button", { name: text.open }));
  await waitFor(() => expect(canvas.getByRole("dialog", { name: text.title })).toBeVisible());
  return within(canvas.getByRole("dialog", { name: text.title }));
}

/** The tile of a family: its animal, then its name. */
const tile = (family: keyof typeof text.family) =>
  new RegExp(`${messages.band.animals[profileFamilyAnimal(family)]}\\s*${text.family[family]}`);

/** From the club step to « Mes épreuves ». */
async function toFamilies(sheet: ReturnType<typeof within>) {
  await userEvent.click(sheet.getByRole("button", { name: text.next }));
  await waitFor(() =>
    expect(sheet.getByRole("heading", { name: new RegExp(text.familiesTitle) })).toBeVisible(),
  );
}

/** A compact card, one line and a button: the form stays closed. */
export const Compact: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("heading", { name: text.title })).toBeVisible();
    await expect(canvas.getByRole("button", { name: text.open })).toBeVisible();
    await expect(canvas.queryByRole("dialog")).toBeNull();
    await expect(canvas.queryByRole("checkbox")).toBeNull();
  },
};

/** Step 1, nothing chosen: the bib with the pseudo alone, the club search. */
export const Empty: Story = {
  play: async ({ canvasElement }) => {
    const sheet = await openSheet(canvasElement);
    await expect(sheet.getByRole("heading", { name: new RegExp(text.clubTitle) })).toBeVisible();
    await expect(sheet.getByRole("img", { name: "Dossard 42, Testeur" })).toBeVisible();
    await expect(sheet.getByLabelText(messages.clubPicker.searchLabel)).toBeVisible();
    await expect(sheet.getByRole("button", { name: text.laterLabel })).toBeVisible();
    await expect(sheet.queryByRole("heading", { name: new RegExp(text.familiesTitle) })).toBeNull();
    await expect(within(canvasElement).queryByText(text.firstPodium)).toBeNull();
  },
};

/** The profile is complete or put off: the home does not ask, nothing shows. */
export const NotAsked: Story = {
  args: { ask: false, firstPodium: true },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByRole("heading", { name: text.title })).toBeNull();
    await expect(within(canvasElement).queryByText(text.firstPodium)).toBeNull();
  },
};

/** The club picked in the list prints at once on the bib. */
export const ClubPrinted: Story = {
  play: async ({ canvasElement }) => {
    const sheet = await openSheet(canvasElement);
    await userEvent.type(sheet.getByLabelText(messages.clubPicker.searchLabel), "test");
    await userEvent.click(await sheet.findByRole("button", { name: new RegExp(club.name) }));
    await expect(
      sheet.getByRole("img", { name: `Dossard 42, Testeur, ${club.name}` }),
    ).toBeVisible();
  },
};

/** A club already chosen: printed on the bib, « Changer » offered. */
export const ClubChosen: Story = {
  args: { initial: { ...EMPTY_COMPLETE_PROFILE, club } },
  play: async ({ canvasElement }) => {
    const sheet = await openSheet(canvasElement);
    await expect(sheet.getByRole("img", { name: new RegExp(club.name) })).toBeVisible();
    await expect(sheet.getByRole("button", { name: messages.clubPicker.change })).toBeVisible();
  },
};

/** Step 2: six animals, all off; « Retour » goes back to the club, still chosen. */
export const Families: Story = {
  args: { initial: { ...EMPTY_COMPLETE_PROFILE, club } },
  play: async ({ canvasElement }) => {
    const sheet = await openSheet(canvasElement);
    await toFamilies(sheet);
    await expect(sheet.getAllByRole("checkbox")).toHaveLength(6);
    for (const family of Object.keys(text.family) as (keyof typeof text.family)[]) {
      await expect(sheet.getByRole("checkbox", { name: tile(family) })).not.toBeChecked();
    }
    await expect(sheet.getByRole("link", { name: text.precise })).toHaveAttribute(
      "href",
      "/profil/modifier",
    );
    await userEvent.click(sheet.getByRole("button", { name: text.back }));
    await expect(sheet.getByRole("heading", { name: new RegExp(text.clubTitle) })).toBeVisible();
    await expect(sheet.getByRole("img", { name: new RegExp(club.name) })).toBeVisible();
  },
};

/** Closing the sheet keeps the animals lit, and the card is still there. */
export const CloseKeepsDraft: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    let sheet = await openSheet(canvasElement);
    await toFamilies(sheet);
    await userEvent.click(sheet.getByText(text.family.sprint));
    await userEvent.click(sheet.getByRole("button", { name: messages.competitions.sheet.close }));
    await waitFor(() => expect(canvas.queryByRole("dialog")).toBeNull());
    await expect(canvas.getByRole("heading", { name: text.title })).toBeVisible();
    sheet = await openSheet(canvasElement);
    await expect(sheet.getByRole("checkbox", { name: tile("sprint") })).toBeChecked();
  },
};

/** Two animals lit, a third touched; saving confirms in the sheet and the card goes. */
export const FamiliesChosen: Story = {
  args: { initial: { ...EMPTY_COMPLETE_PROFILE, club, families: ["sprint", "jumps"] } },
  play: async ({ canvasElement, args }) => {
    const sheet = await openSheet(canvasElement);
    await toFamilies(sheet);
    await expect(sheet.getByRole("checkbox", { name: tile("sprint") })).toBeChecked();
    await expect(sheet.getByRole("checkbox", { name: tile("jumps") })).toBeChecked();
    await userEvent.click(sheet.getByText(text.family.throws));
    await expect(sheet.getByRole("checkbox", { name: tile("throws") })).toBeChecked();
    await userEvent.click(sheet.getByText(text.family.sprint));
    await expect(sheet.getByRole("checkbox", { name: tile("sprint") })).not.toBeChecked();
    await userEvent.click(sheet.getByRole("button", { name: text.save }));
    await waitFor(() => expect(args.save).toHaveBeenCalled());
    const sent = args.save.mock.calls[0][1];
    await expect(sent.getAll("family")).toEqual(["jumps", "throws"]);
    await expect(sent.get("clubId")).toBe(club.id);
    await expect(await sheet.findByRole("status")).toHaveTextContent(text.done);
    await expect(within(canvasElement).queryByRole("region", { name: text.title })).toBeNull();
  },
};

/** Just after the first prediction: the green banner above the card. */
export const FirstPodium: Story = {
  args: { firstPodium: true },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("status")).toHaveTextContent(text.firstPodium);
  },
};

/** « Plus tard » on the card: it goes at once and the server remembers it. */
export const Later: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: text.laterLabel }));
    await expect(args.later).toHaveBeenCalled();
    await expect(canvas.queryByRole("heading", { name: text.title })).toBeNull();
  },
};

/** « Plus tard » from step 2 does the same, and closes the sheet. */
export const LaterFromSheet: Story = {
  play: async ({ canvasElement, args }) => {
    const sheet = await openSheet(canvasElement);
    await toFamilies(sheet);
    await userEvent.click(sheet.getByRole("button", { name: text.laterLabel }));
    await expect(args.later).toHaveBeenCalled();
    await waitFor(() => expect(within(canvasElement).queryByRole("dialog")).toBeNull());
  },
};

/** Nothing chosen and saved: the error stays on « Mes épreuves ». */
export const SaveError: Story = {
  args: {
    save: fn<Save>(async (state) => ({ ...state, error: "PROFILE_DETAILS_EMPTY" })),
  },
  play: async ({ canvasElement }) => {
    const sheet = await openSheet(canvasElement);
    await toFamilies(sheet);
    await userEvent.click(sheet.getByRole("button", { name: text.save }));
    await expect(await sheet.findByRole("alert")).toHaveTextContent(
      messages.errors.PROFILE_DETAILS_EMPTY,
    );
  },
};

/** A club refused by the server: back on « Mon club », the error under the field. */
export const ClubError: Story = {
  args: {
    save: fn<Save>(async (state) => ({ ...state, error: "CLUB_UNKNOWN" })),
  },
  play: async ({ canvasElement }) => {
    const sheet = await openSheet(canvasElement);
    await toFamilies(sheet);
    await userEvent.click(sheet.getByRole("button", { name: text.save }));
    await expect(await sheet.findByRole("alert")).toHaveTextContent(messages.errors.CLUB_UNKNOWN);
    await expect(sheet.getByRole("heading", { name: new RegExp(text.clubTitle) })).toBeVisible();
  },
};

/** A long club name wraps on the bib and nothing overflows at 320 px. */
export const LongText: Story = {
  decorators: [
    (Story) => (
      <div className="w-[320px]">
        <Story />
      </div>
    ),
  ],
  args: {
    firstPodium: true,
    initial: {
      ...EMPTY_COMPLETE_PROFILE,
      club: {
        id: "club-2",
        name: "Association Sportive et Culturelle d'Athlétisme de la Vallée de la Haute-Testrivière",
        city: "Saint-Testin-sur-Testrivière",
      },
      families: ["middle_distance", "combined"],
    },
  },
  play: async ({ canvasElement }) => {
    const card = within(canvasElement).getByRole("region", { name: text.title });
    await expect(card.scrollWidth).toBeLessThanOrEqual(card.clientWidth + 1);
    const sheet = await openSheet(canvasElement);
    const bib = sheet.getByRole("img", { name: /Haute-Testrivière/ });
    await expect(bib).toBeVisible();
    await expect(bib.scrollWidth).toBeLessThanOrEqual(bib.clientWidth + 1);
    await toFamilies(sheet);
    await expect(sheet.getByRole("checkbox", { name: tile("combined") })).toBeChecked();
  },
};
