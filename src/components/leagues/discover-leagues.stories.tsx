import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";

import { messages } from "@/app/messages.fr";

import { DiscoverLeagues, type DiscoverableRow } from "./discover-leagues";

const text = messages.leagues;

const row = (
  id: string,
  name: string,
  memberCount: number,
  createdAt: string,
  families?: DiscoverableRow["families"],
): DiscoverableRow => ({
  id,
  name,
  memberCount,
  createdAt,
  families,
  summary: { count: 2, start: "2027-03", end: "2027-06" },
  actions: (
    <button type="button" aria-label={text.publicJoinLabel(name)}>
      {text.publicJoin}
    </button>
  ),
});

const meta = {
  title: "Leagues/DiscoverLeagues",
  component: DiscoverLeagues,
  args: {
    notice: text.publicNotice.empty,
    leagues: [
      row("a", "Les Haies du Nord", 120, "2026-10-01T10:00:00Z", ["hurdles", "sprint"]),
      row("b", "Club Lancers", 12, "2026-11-01T10:00:00Z", ["throws"]),
      row("c", "Élite Testville", 199, "2026-09-01T10:00:00Z"),
    ],
  },
  decorators: [
    (Story) => (
      <div className="max-w-[390px] bg-background p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof DiscoverLeagues>;

export default meta;
type Story = StoryObj<typeof meta>;

const names = (canvas: ReturnType<typeof within>) =>
  within(canvas.getByRole("list", { name: text.publicTitle }))
    .getAllByRole("listitem")
    .map((li) => li.querySelector(".font-extrabold")?.textContent);

/** The most places left first; a family chip per family present. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(names(canvas)).toEqual(["Club Lancers", "Les Haies du Nord", "Élite Testville"]);
    const group = canvas.getByRole("group", { name: text.familyFilterLabel });
    await expect(
      within(group)
        .getAllByRole("button")
        .map((b) => b.textContent),
    ).toEqual(["Toutes", "Sprint", "Haies", "Lancers"]);
  },
};

/** Searching then filtering by family narrows the list; sorting changes the order. */
export const SearchFilterSort: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByRole("searchbox", { name: text.searchLabel }), "les");
    await expect(names(canvas)).toEqual(["Les Haies du Nord"]);
    await userEvent.clear(canvas.getByRole("searchbox", { name: text.searchLabel }));
    await userEvent.click(canvas.getByRole("button", { name: "Lancers" }));
    await expect(names(canvas)).toEqual(["Club Lancers"]);
    await userEvent.click(canvas.getByRole("button", { name: "Toutes" }));
    await userEvent.selectOptions(canvas.getByRole("combobox"), text.sorts.recent);
    await expect(names(canvas)).toEqual(["Club Lancers", "Les Haies du Nord", "Élite Testville"]);
    await userEvent.selectOptions(canvas.getByRole("combobox"), text.sorts.players);
    await expect(names(canvas)).toEqual(["Élite Testville", "Les Haies du Nord", "Club Lancers"]);
  },
};

/** Nothing matches: a short note instead of the list. */
export const NoMatch: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByRole("searchbox"), "zzz");
    await expect(canvas.getByRole("status")).toHaveTextContent(text.noMatch);
  },
};

/** Empty: no public league to join at all, the current notice. */
export const Empty: Story = {
  args: { leagues: [] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(text.publicNotice.empty)).toBeVisible();
    await expect(canvas.queryByRole("searchbox")).toBeNull();
  },
};

/** Long names and every family: the chips scroll, nothing overflows. */
export const LongText: Story = {
  args: {
    leagues: [
      row(
        "a",
        "Les Gazelles infatigables de la Vallée de la Haute-Testrivière et de ses environs",
        40,
        "2026-10-01T10:00:00Z",
        ["sprint", "hurdles", "middle", "long", "jumps", "throws", "combined", "relay"],
      ),
    ],
  },
  play: async ({ canvasElement }) => {
    const item = within(canvasElement).getByRole("listitem");
    await expect(item.scrollWidth).toBeLessThanOrEqual(item.clientWidth + 1);
  },
};
