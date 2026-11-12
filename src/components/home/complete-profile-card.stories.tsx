import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";

import type { Club } from "@/application/clubs";
import { messages } from "@/app/messages.fr";

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

/** Nothing chosen yet: the club search, six families, « Préciser les épreuves ». */
export const Empty: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("heading", { name: text.title })).toBeVisible();
    await expect(canvas.getByText(text.text)).toBeVisible();
    await expect(canvas.getAllByRole("checkbox")).toHaveLength(6);
    for (const family of Object.values(text.family)) {
      await expect(canvas.getByRole("checkbox", { name: family })).not.toBeChecked();
    }
    await expect(canvas.getByRole("link", { name: text.precise })).toHaveAttribute(
      "href",
      "/profil/modifier",
    );
    await expect(canvas.queryByText(text.firstPodium)).toBeNull();
  },
};

/** A club picked in the list. */
export const ClubChosen: Story = {
  args: { initial: { ...EMPTY_COMPLETE_PROFILE, club } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(club.name)).toBeVisible();
    await expect(canvas.getByRole("button", { name: messages.clubPicker.change })).toBeVisible();
  },
};

/** Two families ticked; saving hides the card. */
export const FamiliesChosen: Story = {
  args: { initial: { ...EMPTY_COMPLETE_PROFILE, families: ["sprint", "jumps"] } },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("checkbox", { name: text.family.sprint })).toBeChecked();
    await expect(canvas.getByRole("checkbox", { name: text.family.jumps })).toBeChecked();
    await userEvent.click(canvas.getByText(text.family.throws));
    await expect(canvas.getByRole("checkbox", { name: text.family.throws })).toBeChecked();
    await userEvent.click(canvas.getByRole("button", { name: text.save }));
    await waitFor(() => expect(args.save).toHaveBeenCalled());
    const sent = args.save.mock.calls[0][1];
    await expect(sent.getAll("family")).toEqual(["sprint", "jumps", "throws"]);
    await waitFor(() => expect(canvas.queryByRole("heading", { name: text.title })).toBeNull());
  },
};

/** Just after the first prediction: the green banner above the card. */
export const FirstPodium: Story = {
  args: { firstPodium: true },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("status")).toHaveTextContent(text.firstPodium);
  },
};

/** « Plus tard »: the card goes at once and the server remembers it. */
export const Later: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: text.laterLabel }));
    await expect(args.later).toHaveBeenCalled();
    await expect(canvas.queryByRole("heading", { name: text.title })).toBeNull();
  },
};

/** Nothing chosen and saved: the error stays in the card. */
export const SaveError: Story = {
  args: {
    save: fn<Save>(async (state) => ({ ...state, error: "PROFILE_DETAILS_EMPTY" })),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: text.save }));
    await expect(await canvas.findByRole("alert")).toHaveTextContent(
      messages.errors.PROFILE_DETAILS_EMPTY,
    );
  },
};

/** A long club name typed by the player wraps inside the card. */
export const LongText: Story = {
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
    const canvas = within(canvasElement);
    const card = canvas.getByRole("region", { name: text.title });
    await expect(card.scrollWidth).toBeLessThanOrEqual(card.clientWidth + 1);
  },
};
