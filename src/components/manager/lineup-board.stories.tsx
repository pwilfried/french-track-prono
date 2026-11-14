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

/** The stadium before anything is placed: a « + » on each spot the team can fill. */
export const EmptyStadium: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("list", { name: text.stadium })).toBeVisible();
    await expect(canvas.getByText("0/4 places")).toBeVisible();
    await expect(canvas.getByRole("button", { name: text.validate })).toBeDisabled();
    await expect(canvas.getByText("À remplir : Sprint, Demi-fond, Libre")).toBeVisible();
  },
};

/** Tap a spot, pick an athlete in the sheet; validate once every place it can be is filled. */
export const Editing: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const page = within(canvasElement.ownerDocument.body);
    const sheet = () => within(page.getByRole("dialog"));
    const validate = canvas.getByRole("button", { name: text.validate });

    // The sprint spot: the sprinter fits, the others are greyed with the reason.
    await userEvent.click(canvas.getByRole("button", { name: text.emptyPlace("Sprint") }));
    await expect(page.getByRole("dialog", { name: text.sheetTitle("Sprint") })).toBeVisible();
    await expect(sheet().getByRole("button", { name: /Inès Démo/ })).toBeDisabled();
    await expect(sheet().getAllByText(text.wrongFamily("Sprint"))).toHaveLength(2);
    await expect(sheet().getByRole("button", { name: /Anna Modèle/ })).toBeDisabled();
    await expect(sheet().getByText(text.notEntered)).toBeVisible();
    await userEvent.click(sheet().getByRole("button", { name: /Léa Fictive/ }));
    await expect(
      canvas.getByRole("button", { name: text.takenPlace("Sprint", "Léa Fictive") }),
    ).toBeVisible();

    await userEvent.click(canvas.getByRole("button", { name: text.emptyPlace("Demi-fond") }));
    await userEvent.click(sheet().getByRole("button", { name: /Inès Démo/ }));
    await userEvent.click(canvas.getByRole("button", { name: text.emptyPlace("Libre") }));
    await userEvent.click(sheet().getByRole("button", { name: /Zoé Exemple/ }));

    await expect(canvas.getByText("3/4 places")).toBeVisible();
    await expect(canvas.getByText(text.full)).toBeVisible();
    await userEvent.click(validate);
    await waitFor(() => expect(args.onValidate).toHaveBeenCalledWith(["s1", "m1", "m2"]));

    // Picking an athlete placed elsewhere swaps the two.
    await userEvent.click(
      canvas.getByRole("button", { name: text.takenPlace("Demi-fond", "Inès Démo") }),
    );
    await userEvent.click(sheet().getByRole("button", { name: /Zoé Exemple/ }));
    await expect(
      canvas.getByRole("button", { name: text.takenPlace("Libre", "Inès Démo") }),
    ).toBeVisible();

    // « Retirer de cette place » sends the athlete back to the bench.
    await userEvent.click(
      canvas.getByRole("button", { name: text.takenPlace("Libre", "Inès Démo") }),
    );
    await userEvent.click(sheet().getByRole("button", { name: text.remove }));
    await expect(canvas.getByRole("button", { name: text.validate })).toBeDisabled();
  },
};

/** Some places filled, the others still to fill. */
export const PartlyFilled: Story = {
  args: { initial: ["s1", null, null, null] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("1/4 places")).toBeVisible();
    await expect(canvas.getByText("À remplir : Demi-fond, Libre")).toBeVisible();
  },
};

/** Every place the team can fill is filled: the lineup can be validated. */
export const Full: Story = {
  args: { initial: ["s1", "m1", null, "m2"] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(text.full)).toBeVisible();
    await expect(canvas.getByRole("button", { name: text.validate })).toBeEnabled();
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
    await expect(canvas.getByText(text.unfillablePlace("Lancers"))).toBeInTheDocument();
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

/** Long names are cut on the spots of the stadium and wrap on the bench. */
export const LongText: Story = {
  args: {
    athletes: [
      athlete("s1", "Marie-Clémentine Bartholomée-Vandenberghe", "100 m haies", "hurdles"),
      ...team.slice(1),
    ],
    initial: [null, "m1", null, null],
  },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText("Marie-Clémentine B.")).toBeVisible();
  },
};
