import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";

import type { DisciplineFamily } from "@/domain/discipline";
import { teamBuild, type BuildRules } from "@/domain/manager-build";
import { MANAGER_FAMILIES, type ManagerSex } from "@/domain/manager-rules";

import { TeamBuildCard } from "./team-build-card";

const rules: BuildRules = {
  minTeamSize: 12,
  quotas: MANAGER_FAMILIES.map((family) => ({ family, min: 3, minPerSex: 1, maxPerSex: 4 })),
};
const a = (family: DisciplineFamily, sex: ManagerSex) => ({ family, sex });

const meta = {
  title: "Manager/TeamBuildCard",
  component: TeamBuildCard,
  decorators: [
    (Story) => (
      <div className="w-[390px] bg-background p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof TeamBuildCard>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Nothing recruited yet: every family to complete, the credits shared out. */
export const Empty: Story = {
  args: { build: teamBuild(rules, [], 120), left: 120 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("0/12")).toBeVisible();
    await expect(canvas.getByText(/Reste 120 crédits, soit 10 par athlète manquant/)).toBeVisible();
  },
};

/** Some families done, a middle-distance man missing. */
export const InProgress: Story = {
  args: {
    build: teamBuild(
      rules,
      [
        a("sprint", "F"),
        a("hurdles", "M"),
        a("sprint", "F"),
        a("middle", "F"),
        a("long", "F"),
        a("middle", "F"),
        a("throws", "M"),
      ],
      58,
    ),
    left: 58,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("7/12")).toBeVisible();
    await expect(canvas.getByText(/Il te manque au moins/)).toBeVisible();
    await expect(canvas.getByText(/soit 11 par athlète manquant/)).toBeVisible();
  },
};

/** A full team: every family ticked. */
export const Complete: Story = {
  args: {
    build: teamBuild(
      rules,
      MANAGER_FAMILIES.flatMap((family) => {
        const f: DisciplineFamily =
          family === "distance" ? "middle" : family === "jumps" ? "vertical_jumps" : family;
        return [a(f, "F"), a(f, "M"), a(f, "F")];
      }),
      4,
    ),
    left: 4,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("12/12")).toBeVisible();
    await expect(canvas.getByText(/Ton équipe est complète/)).toBeVisible();
  },
};

const bid = (family: DisciplineFamily, sex: ManagerSex) => ({ family, sex, pending: true });

/** Bids running count in the team, marked apart from the athletes won. */
export const WithBids: Story = {
  args: {
    build: teamBuild(rules, [a("sprint", "F"), bid("sprint", "M"), bid("middle", "F")], 70),
    left: 70,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("3/12")).toBeVisible();
    await expect(canvas.getByText("dont 2 enchères en cours")).toBeVisible();
  },
};

/** The bids and the athletes together go over the budget. */
export const OverBudget: Story = {
  args: {
    build: teamBuild(rules, [a("sprint", "F"), bid("sprint", "M")], 0, { spent: 120, budget: 100 }),
    left: 0,
  },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("alert")).toBeVisible();
  },
};
