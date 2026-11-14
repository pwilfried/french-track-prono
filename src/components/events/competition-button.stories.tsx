import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, within } from "storybook/test";

import { CompetitionButton, CompetitionButtonSkeleton } from "./competition-button";

const meta = {
  title: "Events/CompetitionButton",
  component: CompetitionButton,
  args: {
    competition: {
      slug: "meeting-fictif-2027",
      name: "Meeting fictif de Paris",
      city: "Paris",
      scope: "international",
      venue: "outdoor",
      startsOn: "2027-06-25",
      endsOn: "2027-06-27",
      finals: 12,
    },
    onChange: fn(),
  },
  decorators: [
    (Story) => (
      <div className="max-w-sm bg-background p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof CompetitionButton>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The competition shown: its first day, its name as the page title, its details, « Changer ». */
export const Default: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Meeting fictif de Paris",
    );
    await expect(canvas.getByText(/Paris · 25–27 juin 2027 · 12 épreuves/)).toBeVisible();
    const change = canvas.getByRole("button", { name: /Changer de compétition/ });
    await expect(change.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
    await userEvent.click(change);
    await expect(args.onChange).toHaveBeenCalled();
  },
};

/** Empty: no programme yet, and no other competition to choose: no « Changer ». */
export const NoProgramNoChoice: Story = {
  args: {
    competition: { ...meta.args.competition, finals: 0, city: null },
    onChange: undefined,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/programme à venir/)).toBeVisible();
    await expect(canvas.queryByRole("button")).not.toBeInTheDocument();
  },
};

/** Indoor: the « Salle » chip next to the name. */
export const Indoor: Story = {
  args: { competition: { ...meta.args.competition, venue: "indoor" } },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText("Salle")).toBeVisible();
  },
};

/** Loading: a grey card in its place. */
export const Loading: Story = {
  render: () => <CompetitionButtonSkeleton />,
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByRole("heading")).not.toBeInTheDocument();
  },
};

/** Error: the competitions cannot be read, the page falls back on a card without details. */
export const Unavailable: Story = {
  args: {
    competition: { ...meta.args.competition, name: "French Track Prono", city: null, finals: 0 },
    onChange: undefined,
  },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("heading")).toHaveTextContent(
      "French Track Prono",
    );
  },
};

/** Long text: a long name wraps, « Changer » stays on the card. */
export const LongName: Story = {
  args: {
    competition: {
      ...meta.args.competition,
      name: "Championnats d'Europe d'athlétisme en salle des moins de 23 ans",
      city: "Saint-Jean-de-Luz",
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const card = canvas.getByRole("heading").closest("div.relative")!;
    const change = canvas.getByRole("button");
    await expect(change.getBoundingClientRect().right).toBeLessThanOrEqual(
      card.getBoundingClientRect().right,
    );
  },
};
