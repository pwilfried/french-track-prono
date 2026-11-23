import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";

import { messages } from "../../messages.fr";
import { EditProfileForm } from "./edit-profile-form";

const disciplines = [
  { name: "100 m", family: "sprint" as const },
  { name: "100 m haies", family: "hurdles" as const },
  { name: "Longueur", family: "horizontal_jumps" as const },
];

const initial = {
  pseudo: "Léa",
  bibNumber: "12",
  bibColor: "blue",
  sex: "F",
  disciplines: ["100 m", "Longueur"],
  club: null,
  newClubName: "",
  newClubCity: "",
};

const meta = {
  title: "Profile/EditProfileForm",
  component: EditProfileForm,
  args: {
    initial,
    disciplines,
    clubValidated: null,
    save: async (state) => state,
    searchClubs: async () => [],
  },
} satisfies Meta<typeof EditProfileForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const LivePreview: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("img", { name: "Dossard 12, Léa" })).toBeInTheDocument();
    const pseudo = canvas.getByLabelText(messages.editProfile.pseudoLabel);
    await userEvent.clear(pseudo);
    await expect(
      canvas.getByRole("img", { name: `Dossard 12, ${messages.editProfile.emptyPseudo}` }),
    ).toBeInTheDocument();
    await userEvent.type(pseudo, "Nina");
    await userEvent.click(canvas.getByRole("radio", { name: messages.bib.colors.gold }));
    const bib = canvas.getByRole("img", { name: "Dossard 12, Nina" });
    await expect(bib).toHaveAttribute("data-bib-color", "gold");
  },
};

export const PrivateFoldedThenOpened: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const toggle = canvas.getByRole("button", { name: /Privé : sexe et disciplines/ });
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(toggle).toHaveTextContent("Femme · 100 m, Longueur");
    await userEvent.click(toggle);
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(canvas.getByText(messages.editProfile.privateHint)).toBeVisible();
  },
};

export const PrivateOpenWhenItCarriesTheError: Story = {
  args: { initial: { ...initial, error: "SEX_INVALID" } },
  play: async ({ canvasElement }) => {
    const toggle = within(canvasElement).getByRole("button", {
      name: /Privé : sexe et disciplines/,
    });
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
  },
};

export const LongPseudo: Story = {
  args: { initial: { ...initial, pseudo: "Un pseudo vraiment très très long, quarante c" } },
};
