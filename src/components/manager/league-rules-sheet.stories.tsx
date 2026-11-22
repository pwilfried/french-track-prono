import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";

import { messages } from "@/app/messages.fr";

import { LeagueRulesSheet } from "./league-rules-sheet";

/** The messages keep a unit with its number (no-break spaces); the DOM text reads plain spaces. */
const plain = (value: string) => value.replace(/[\u00a0\u202f]/g, " ");

const text = messages.manager;

const meta = {
  title: "Manager/LeagueRulesSheet",
  component: LeagueRulesSheet,
  args: {
    rules: {
      budget: 100,
      minTeamSize: 12,
      lineup: { max: 8, perFamily: 2, bench: 4 },
      tablesDivisor: 10,
      bonuses: {
        first: 10,
        second: 6,
        third: 3,
        personal_best: 5,
        season_best: 3,
        national_record: 10,
        area_record: 15,
        world_record: 25,
      },
    },
    season: text.seasonFormat(14, 8, 14, 0),
  },
  decorators: [
    (Story) => (
      <div className="w-[390px] bg-background p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof LeagueRulesSheet>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The button opens the four parts of the rules over the page; « Fermer » closes them. */
export const Opens: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: new RegExp(text.rulesOpen) }));
    const sheet = within(canvasElement.ownerDocument.body).getByRole("dialog", {
      name: text.rules,
    });
    for (const title of Object.values(text.rulesSections)) {
      await expect(within(sheet).getByRole("region", { name: title })).toBeVisible();
    }
    await expect(sheet).toHaveTextContent(plain(text.tables(10)));
    await expect(
      within(sheet).getByRole("row", { name: new RegExp(text.bonusName.first) }),
    ).toHaveTextContent(plain(text.bonusValue(10)));
    await expect(sheet).toHaveTextContent(text.noPredictions);
    await userEvent.click(within(sheet).getByRole("button", { name: /Fermer/ }));
    await expect(canvas.getByRole("button", { name: new RegExp(text.rulesOpen) })).toBeVisible();
  },
};

/** Open, on the night background of the dark theme. */
export const Dark: Story = {
  args: { defaultOpen: true },
  decorators: [
    (Story) => (
      <div className="dark w-[390px] bg-background p-4">
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement.ownerDocument.body).getByRole("dialog", { name: text.rules }),
    ).toBeVisible();
  },
};
