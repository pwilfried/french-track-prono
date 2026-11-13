import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";

import { DayBar, DayBarSkeleton } from "./day-bar";

const meta = {
  title: "Events/DayBar",
  component: DayBar,
  args: {
    days: [
      { day: "2027-06-24", events: 4, today: false, done: true },
      { day: "2027-06-25", events: 6, today: true, done: false },
      { day: "2027-06-26", events: 5, today: false, done: false },
      { day: "2027-06-27", events: 7, today: false, done: false },
    ],
    selected: "2027-06-25",
    hrefOf: (day: string) => `/competitions?jour=${day}`,
  },
  decorators: [
    (Story) => (
      <div className="max-w-sm overflow-hidden bg-background p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof DayBar>;

export default meta;
type Story = StoryObj<typeof meta>;

/** « AUJ. » for today, the day chosen highlighted, a dot on a finished day and on today. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("AUJ.")).toBeVisible();
    const current = canvas.getByRole("link", { current: "date" });
    await expect(current).toHaveAccessibleName("vendredi 25 juin, aujourd'hui");
    await expect(current).toHaveAttribute("href", "/competitions?jour=2027-06-25");
    await expect(canvas.getByRole("link", { name: /24 juin, terminé/ })).toBeVisible();
    await expect(current.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
  },
};

/** Empty: a competition without dates shows no bar. */
export const Empty: Story = {
  args: { days: [] },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByRole("navigation")).not.toBeInTheDocument();
  },
};

/** Loading: grey tabs. */
export const Loading: Story = {
  render: () => <DayBarSkeleton />,
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByRole("link")).not.toBeInTheDocument();
  },
};

/** Error: the events could not be read, the days of the competition still show, none done. */
export const WithoutEvents: Story = {
  args: {
    days: meta.args.days.map((d) => ({ ...d, events: 0, done: false, today: false })),
    selected: "2027-06-24",
  },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByText("AUJ.")).not.toBeInTheDocument();
  },
};

/** Long text: a long competition (ten days) scrolls sideways instead of wrapping. */
export const LongCompetition: Story = {
  args: {
    days: Array.from({ length: 10 }, (_, i) => ({
      day: `2027-08-${String(i + 10).padStart(2, "0")}`,
      events: 5,
      today: i === 6,
      done: i < 6,
    })),
    selected: "2027-08-16",
  },
  play: async ({ canvasElement }) => {
    const nav = within(canvasElement).getByRole("navigation");
    await expect(nav.scrollWidth).toBeGreaterThan(nav.clientWidth);
  },
};
