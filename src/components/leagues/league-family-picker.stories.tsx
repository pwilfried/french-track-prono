import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, within } from "storybook/test";

import { messages } from "@/app/messages.fr";

import { LeagueFamilyPicker } from "./league-family-picker";

const text = messages.leagues;

const meta = {
  title: "Leagues/LeagueFamilyPicker",
  component: LeagueFamilyPicker,
  args: { onReadyChange: fn() },
  decorators: [
    (Story) => (
      <div className="max-w-[390px] bg-background p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof LeagueFamilyPicker>;

export default meta;
type Story = StoryObj<typeof meta>;

/** By default every event counts: no chip shown, the league can be created. */
export const AllEvents: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("radio", { name: new RegExp(text.allEvents) })).toBeChecked();
    await expect(canvas.queryByRole("checkbox", { name: text.family.sprint })).toBeNull();
    await expect(args.onReadyChange).toHaveBeenLastCalledWith(true);
  },
};

/** « Certaines familles » without any chip: nothing counts yet, the league cannot be created. */
export const NoFamilyChosen: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("radio", { name: new RegExp(text.someFamilies) }));
    await expect(canvas.getAllByRole("checkbox")).toHaveLength(8);
    await expect(canvas.getByText(text.familiesNone)).toBeVisible();
    await expect(args.onReadyChange).toHaveBeenLastCalledWith(false);
  },
};

/** Sprint and hurdles chosen: the summary lists them, the league can be created. */
export const SprintAndHurdles: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("radio", { name: new RegExp(text.someFamilies) }));
    await userEvent.click(canvas.getByRole("checkbox", { name: text.family.hurdles }));
    await userEvent.click(canvas.getByRole("checkbox", { name: text.family.sprint }));
    await expect(
      canvas.getByText(text.familiesSummary([text.family.sprint, text.family.hurdles])),
    ).toBeVisible();
    await expect(args.onReadyChange).toHaveBeenLastCalledWith(true);
  },
};

/** The longest names on a phone: the chips wrap, nothing overflows. */
export const LongText: Story = {
  args: { defaultFamilies: ["combined", "relay", "middle", "long", "jumps", "throws"] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("checkbox", { name: text.family.combined })).toBeChecked();
    await expect(canvasElement.scrollWidth).toBeLessThanOrEqual(canvasElement.clientWidth + 1);
  },
};
