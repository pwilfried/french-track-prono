import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";

import { AnimalChange, ANIMAL_SEEN_KEY } from "./animal-change";

const meta = {
  title: "Band/AnimalChange",
  component: AnimalChange,
  args: { animal: "guepard" },
  decorators: [
    (Story) => (
      <div className="max-w-[390px] bg-background p-4">
        <Story />
      </div>
    ),
  ],
  beforeEach: () => {
    localStorage.setItem(ANIMAL_SEEN_KEY, "ours");
  },
} satisfies Meta<typeof AnimalChange>;

export default meta;
type Story = StoryObj<typeof meta>;

/** From Ours to Guépard: announced, remembered at once, closed with ×. */
export const Changed: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("status")).toHaveTextContent("Tu es passé Guépard !");
    await expect(localStorage.getItem(ANIMAL_SEEN_KEY)).toBe("guepard");
    await userEvent.click(canvas.getByRole("button", { name: "Fermer" }));
    await expect(canvas.queryByRole("status")).toBeNull();
  },
};
