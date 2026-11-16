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
  athlete("j1", "Zoé Exemple", "Longueur", "horizontal_jumps"),
  athlete("t1", "Anna Modèle", "Poids", "throws", false),
];

const meta = {
  title: "Manager/LineupBoard",
  component: LineupBoard,
  args: {
    // One place per family; nobody can fill the throws one.
    places: ["sprint", "distance", "jumps", "throws"],
    fillable: [true, true, true, false],
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
    await expect(canvas.getByText("À remplir : Sprint, Demi-fond et fond, Sauts")).toBeVisible();
    await expect(canvas.getByText(text.unfillable(1))).toBeVisible();
    // The bar sits right under the stadium, never over it (#929): not stuck to the screen's bottom.
    const validate = canvas.getByRole("button", { name: text.validate });
    await expect(getComputedStyle(validate.parentElement!).position).not.toBe("sticky");
    const stadium = canvas.getByRole("list", { name: text.stadium });
    const bench = canvas.getByRole("heading", { name: text.bench });
    await expect(
      stadium.compareDocumentPosition(validate) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    await expect(
      validate.compareDocumentPosition(bench) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  },
};

/** Tap a spot, pick an athlete in the sheet; validate once every place it can be is filled. */
export const Editing: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const page = within(canvasElement.ownerDocument.body);
    const sheet = () => within(page.getByRole("dialog"));
    const validate = canvas.getByRole("button", { name: text.validate });

    // The sprint spot: only the sprinter is listed, not the others nor the absent thrower (#937).
    await userEvent.click(canvas.getByRole("button", { name: text.emptyPlace("Sprint") }));
    await expect(page.getByRole("dialog", { name: text.sheetTitle("Sprint") })).toBeVisible();
    await expect(sheet().getAllByRole("listitem")).toHaveLength(1);
    await expect(sheet().queryByRole("button", { name: /Inès Démo/ })).toBeNull();
    await expect(sheet().queryByRole("button", { name: /Anna Modèle/ })).toBeNull();
    await userEvent.click(sheet().getByRole("button", { name: /Léa Fictive/ }));
    await expect(
      canvas.getByRole("button", { name: text.takenPlace("Sprint", "Léa Fictive") }),
    ).toBeVisible();

    await userEvent.click(
      canvas.getByRole("button", { name: text.emptyPlace("Demi-fond et fond") }),
    );
    await userEvent.click(sheet().getByRole("button", { name: /Inès Démo/ }));
    await userEvent.click(canvas.getByRole("button", { name: text.emptyPlace("Sauts") }));
    await userEvent.click(sheet().getByRole("button", { name: /Zoé Exemple/ }));

    await expect(canvas.getByText("3/4 places")).toBeVisible();
    await expect(canvas.getByText(text.fullOfEntered)).toBeVisible();
    await userEvent.click(validate);
    await waitFor(() => expect(args.onValidate).toHaveBeenCalledWith(["s1", "m1", "j1"]));
    // The confirmation shows as soon as the save succeeds, without waiting for the page (#874).
    await expect(await canvas.findByRole("status")).toHaveTextContent(text.validated);

    // « Retirer de cette place » sends the athlete back to the bench.
    await userEvent.click(
      canvas.getByRole("button", { name: text.takenPlace("Sauts", "Zoé Exemple") }),
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
    await expect(canvas.getByText("À remplir : Demi-fond et fond, Sauts")).toBeVisible();
  },
};

/**
 * Every place the team can fill is filled: the lineup can be validated, the bar says how many
 * places stay empty and why.
 */
export const Full: Story = {
  args: { initial: ["s1", "m1", "j1", null] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(text.fullOfEntered)).toBeVisible();
    await expect(canvas.getByText(text.unfillable(1))).toBeVisible();
    await expect(canvas.getByRole("button", { name: text.validate })).toBeEnabled();
  },
};

/** Every place filled, none left that nobody could fill. */
export const AllPlacesFilled: Story = {
  args: {
    places: ["sprint", "distance", "jumps"],
    fillable: [true, true, true],
    initial: ["s1", "m1", "j1"],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("3/3 places")).toBeVisible();
    await expect(canvas.getByText(text.full)).toBeVisible();
    await expect(canvas.queryByText(text.unfillable(1))).toBeNull();
    await expect(canvas.getByRole("button", { name: text.validate })).toBeEnabled();
  },
};

/**
 * No athlete of the team is entered (no start list yet, #839): every place is grey, the bar says
 * so and offers no empty lineup to validate.
 */
export const AllAbsent: Story = {
  args: {
    athletes: team.map((a) => ({ ...a, entered: false })),
    fillable: [false, false, false, false],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("0/4 places")).toBeVisible();
    await expect(canvas.getByText(text.nobodyEntered)).toBeVisible();
    await expect(canvas.queryByText(text.full)).toBeNull();
    await expect(canvas.queryByText(text.hint)).toBeNull();
    await expect(canvas.queryByRole("button", { name: text.validate })).toBeNull();
    await expect(canvas.getAllByText(messages.team.absent)).toHaveLength(4);
  },
};

/** A place nobody of the team can take: the sheet says so and lists nobody (#937). */
export const NobodyFits: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const page = within(canvasElement.ownerDocument.body);
    await userEvent.click(canvas.getByRole("button", { name: text.unfillablePlace("Lancers") }));
    const sheet = within(page.getByRole("dialog", { name: text.sheetTitle("Lancers") }));
    await expect(sheet.getByText(text.noEligible)).toBeVisible();
    await expect(sheet.queryByRole("list", { name: text.choices })).toBeNull();
  },
};

/** Validated: still editable until the lock. */
export const Validated: Story = {
  args: { status: "validated", initial: ["s1", "m1", "j1", null] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("status")).toHaveTextContent(text.validated);
    await expect(canvas.getByRole("button", { name: text.validate })).toBeEnabled();
  },
};

/** Locked: the stadium reads only. */
export const Locked: Story = {
  args: { status: "locked", initial: ["s1", "m1", "j1", null] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("status")).toHaveTextContent(text.locked);
    await expect(canvas.queryByRole("button")).toBeNull();
    await expect(canvas.getByText(text.lockedPlace("Sprint", "Léa Fictive"))).toBeInTheDocument();
    await expect(canvas.getByText(text.unfillablePlace("Lancers"))).toBeInTheDocument();
    // The place nobody can fill says why, not « Personne » (#936).
    await expect(canvas.getByText(text.nobody)).toBeVisible();
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

/** No athlete in the team: every place is grey, the bench says so, nothing to validate. */
export const Empty: Story = {
  args: { athletes: [], fillable: [false, false, false, false] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(text.noTeam)).toBeVisible();
    await expect(canvas.queryByRole("button", { name: text.validate })).toBeNull();
  },
};

/**
 * The default rules (two places per family, #1017): the same stadium and places as a
 * head-to-head, a « + » on each empty one. Picking an athlete placed elsewhere swaps the two.
 */
export const DefaultRules: Story = {
  args: {
    places: ["sprint", "sprint", "distance", "distance", "jumps", "jumps", "throws", "throws"],
    fillable: [true, true, true, true, true, true, true, true],
    athletes: [
      ...team.slice(0, 3),
      athlete("t2", "Bea Démo", "Javelot", "throws"),
      athlete("t3", "Lou Démo", "Disque", "throws"),
      athlete("j2", "Hana Démo", "Hauteur", "vertical_jumps"),
      athlete("m2", "Eva Fictive", "5000 m", "long"),
      athlete("s2", "Quia Fictive", "400 m", "sprint"),
    ],
    initial: ["s1", "s2", "m1", "m2", "j1", "j2", null, null],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const page = within(canvasElement.ownerDocument.body);
    await expect(canvas.getByText("6/8 places")).toBeVisible();
    await expect(canvas.getAllByRole("button", { name: text.emptyPlace("Lancers") })).toHaveLength(
      2,
    );
    await userEvent.click(
      canvas.getByRole("button", { name: text.takenPlace("Sprint", "Léa Fictive") }),
    );
    await userEvent.click(
      within(page.getByRole("dialog")).getByRole("button", { name: /Quia Fictive/ }),
    );
    await expect(
      canvas
        .getAllByRole("button", { name: /^Place Sprint/ })
        .map((b) => b.getAttribute("aria-label")),
    ).toEqual([
      text.takenPlace("Sprint", "Quia Fictive"),
      text.takenPlace("Sprint", "Léa Fictive"),
    ]);
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
