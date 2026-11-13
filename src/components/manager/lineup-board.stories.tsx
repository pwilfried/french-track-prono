import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";

import { messages } from "@/app/messages.fr";

import { LineupBoard, type BoardAthlete } from "./lineup-board";

const text = messages.lineup;

const athlete = (
  athleteId: string,
  name: string,
  discipline: string,
  family: BoardAthlete["family"],
  entered = true,
): BoardAthlete => ({ athleteId, name, discipline, family, sex: "F", paid: 12, entered });

const team: BoardAthlete[] = [
  athlete("s1", "Léa Fictive", "100 m", "sprint"),
  athlete("m1", "Inès Démo", "800 m", "middle"),
  athlete("m2", "Zoé Exemple", "1500 m", "middle"),
  athlete("t1", "Anna Modèle", "Poids", "throws", false),
];

const meta = {
  title: "Manager/LineupBoard",
  component: LineupBoard,
  args: {
    // One sprint place, one middle-distance place, one free place and one nobody can fill.
    places: ["sprint", "middle", "throws", "free"],
    fillable: [true, true, false, true],
    athletes: team,
    initial: [null, null, null, null],
    status: "todo",
    onValidate: fn(async () => true),
  },
  decorators: [
    (Story) => (
      <div className="max-w-md bg-background p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof LineupBoard>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Tap a card, then a place that lights up; validate once every place it can be is filled. */
export const Editing: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const validate = canvas.getByRole("button", { name: text.validate });
    await expect(validate).toBeDisabled();
    await expect(canvas.getByText("0/4 places")).toBeVisible();
    await expect(canvas.getByText("À remplir : Sprint, Demi-fond, Libre")).toBeVisible();
    // The absent thrower cannot be picked; the throws place stays grey.
    await expect(canvas.queryByRole("button", { name: "Anna Modèle" })).toBeNull();
    await expect(canvas.getByText(text.unfillablePlace("Lancers"))).toBeInTheDocument();

    await userEvent.click(canvas.getByRole("button", { name: "Léa Fictive" }));
    await userEvent.click(canvas.getByRole("button", { name: text.emptyPlace("Sprint") }));
    await userEvent.click(canvas.getByRole("button", { name: "Inès Démo" }));
    // A middle-distance runner lights the middle-distance place and the free one, not the sprint.
    await expect(canvas.queryByRole("button", { name: text.emptyPlace("Sprint") })).toBeNull();
    await userEvent.click(canvas.getByRole("button", { name: text.emptyPlace("Demi-fond") }));
    await userEvent.click(canvas.getByRole("button", { name: "Zoé Exemple" }));
    await userEvent.click(canvas.getByRole("button", { name: text.emptyPlace("Libre") }));

    await expect(canvas.getByText("3/4 places")).toBeVisible();
    await expect(canvas.getByText(text.full)).toBeVisible();
    await userEvent.click(validate);
    await waitFor(() => expect(args.onValidate).toHaveBeenCalledWith(["s1", "m1", "m2"]));

    // Tapping a card of the stadium sends it back to the bench.
    await userEvent.click(
      canvas.getByRole("button", { name: text.takenPlace("Libre", "Zoé Exemple") }),
    );
    await expect(canvas.getByRole("button", { name: text.validate })).toBeDisabled();
  },
};

/** Validated: still editable until the lock. */
export const Validated: Story = {
  args: { status: "validated", initial: ["s1", "m1", null, "m2"] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("status")).toHaveTextContent(text.validated);
    await expect(canvas.getByRole("button", { name: text.validate })).toBeEnabled();
  },
};

/** Locked: the stadium reads only. */
export const Locked: Story = {
  args: { status: "locked", initial: ["s1", "m1", null, "m2"] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("status")).toHaveTextContent(text.locked);
    await expect(canvas.queryByRole("button")).toBeNull();
    await expect(canvas.getByText(text.lockedPlace("Sprint", "Léa Fictive"))).toBeInTheDocument();
  },
};

/** The database refused the lineup. */
export const Refused: Story = {
  args: { error: messages.errors.LINEUP_LOCKED, status: "validated" },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("alert")).toHaveTextContent(
      messages.errors.LINEUP_LOCKED,
    );
  },
};

/** No athlete in the team: every place is grey, an empty lineup validates. */
export const Empty: Story = {
  args: { athletes: [], fillable: [false, false, false, false] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(text.noTeam)).toBeVisible();
    await expect(canvas.getByRole("button", { name: text.validate })).toBeEnabled();
  },
};

/** Long names wrap on the cards. */
export const LongText: Story = {
  args: {
    athletes: [
      athlete("s1", "Marie-Clémentine Bartholomée-Vandenberghe", "100 m haies", "hurdles"),
      ...team.slice(1),
    ],
    initial: ["s1", null, null, null],
  },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText("Marie-Clémentine B.")).toBeVisible();
  },
};
