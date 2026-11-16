import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";

import { messages } from "@/app/messages.fr";

import { LineupBoard, type BoardAthlete } from "./lineup-board";

const text = messages.lineup;
/** The text as the queries read it: units keep a non-breaking space, the queries a plain one. */
const plain = (s: string) => s.replace(/\s+/g, " ");

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
    await expect(canvas.getByLabelText(text.placesLabel(0, 4))).toBeVisible();
    await expect(canvas.getByRole("button", { name: text.validate })).toBeDisabled();
    await expect(canvas.getByText("À remplir : Sprint, Demi-fond et fond, Sauts")).toBeVisible();
    await expect(canvas.getByText(text.unfillable(1))).toBeVisible();
    // The bar sits right under the stadium, never over it (#929): not stuck to the screen's bottom.
    const validate = canvas.getByRole("button", { name: text.validate });
    await expect(getComputedStyle(validate.parentElement!).position).not.toBe("sticky");
    // Under the stadium, the substitutes, then the bar at the bottom of the sheet (#1035).
    const stadium = canvas.getByRole("list", { name: text.stadium });
    const bench = canvas.getByRole("heading", { name: text.bench });
    await expect(
      stadium.compareDocumentPosition(bench) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    await expect(
      bench.compareDocumentPosition(validate) & Node.DOCUMENT_POSITION_FOLLOWING,
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

    await expect(canvas.getByLabelText(text.placesLabel(3, 4))).toBeVisible();
    await expect(canvas.getByText(text.fullOfEntered)).toBeVisible();
    await userEvent.click(validate);
    await waitFor(() =>
      expect(args.onValidate).toHaveBeenCalledWith({
        starters: [{ athleteId: "s1" }, { athleteId: "m1" }, { athleteId: "j1" }],
        bench: [],
      }),
    );
    // The confirmation shows as soon as the save succeeds, without waiting for the page (#874).
    await expect(await canvas.findByRole("status")).toHaveTextContent(text.validated);

    // « Retirer de cette place » sends the athlete back to the reserve.
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
    await expect(canvas.getByLabelText(text.placesLabel(1, 4))).toBeVisible();
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
    await expect(canvas.getByLabelText(text.placesLabel(3, 3))).toBeVisible();
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
    await expect(canvas.getByLabelText(text.placesLabel(0, 4))).toBeVisible();
    await expect(canvas.getByText(text.nobodyEntered)).toBeVisible();
    await expect(canvas.queryByText(text.full)).toBeNull();
    await expect(canvas.queryByText(text.legend)).toBeNull();
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
    await expect(canvas.queryByRole("button", { name: text.validate })).toBeNull();
    await expect(canvas.queryAllByRole("button", { name: /^Place / })).toHaveLength(0);
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
    await expect(canvas.getByLabelText(text.placesLabel(6, 8))).toBeVisible();
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
    initial: ["s1", "m1", null, null],
  },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText("Marie-Clémentine B.")).toBeVisible();
  },
};

const d = (name: string, family: BoardAthlete["family"], unit: "time" | "distance" = "time") => ({
  name,
  family,
  unit,
});

/** A full team of the default rules (#1017): two per family on the stadium, four on the bench. */
const squad: BoardAthlete[] = [
  {
    ...athlete("s1", "Léa Fictive", "100 m", "sprint"),
    disciplines: [d("100 m", "sprint"), d("200 m", "sprint")],
    pb: "11,02",
    sb: "11,20",
  },
  { ...athlete("s2", "Quia Fictive", "400 m", "sprint"), disciplines: [d("400 m", "sprint")] },
  athlete("m1", "Inès Démo", "800 m", "middle"),
  athlete("m2", "Eva Fictive", "5000 m", "long"),
  athlete("j1", "Zoé Exemple", "Saut en longueur", "horizontal_jumps"),
  athlete("j2", "Hana Démo", "Saut en hauteur", "vertical_jumps"),
  athlete("t1", "Bea Démo", "Javelot", "throws"),
  athlete("t2", "Lou Démo", "Lancer du disque", "throws"),
  {
    ...athlete("s3", "Nina Fictive", "100 m haies", "hurdles"),
    disciplines: [d("100 m haies", "hurdles")],
  },
  athlete("m3", "Ada Démo", "1500 m", "middle"),
  athlete("j3", "Mia Exemple", "Triple saut", "horizontal_jumps"),
  athlete("t3", "Ève Modèle", "Lancer du poids", "throws"),
  { ...athlete("s4", "Lina Fictive", "200 m", "sprint"), disciplines: [d("200 m", "sprint")] },
  athlete("t4", "Iris Absente", "Lancer du marteau", "throws", false),
];

const fullRules = {
  places: ["sprint", "sprint", "distance", "distance", "jumps", "jumps", "throws", "throws"],
  fillable: [true, true, true, true, true, true, true, true],
  athletes: squad,
  initial: ["s1", "s2", "m1", "m2", "j1", "j2", "t1", "t2"],
  benchSize: 4,
  initialPlan: {
    bench: ["s3", "m3", "j3", "t3"],
    settings: {
      s1: { discipline: "100 m", substituteId: "s3", threshold: 11.5 },
      m1: { substituteId: "m3" },
    },
  },
} satisfies Partial<Story["args"]>;

/**
 * The match sheet of the default rules (#1035): eight starters, the substitute and the threshold
 * under a card, four substitutes in the order they come in, the reserve folded. The order changes
 * with the buttons; a substitute goes back to the reserve and a reservist onto the bench.
 */
export const WithSubstitutes: Story = {
  args: fullRules,
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByLabelText(text.placesLabel(8, 8))).toBeVisible();
    await expect(
      canvas.getByText(plain(text.spotNote("Nina F.", messages.picker.rangeMark(11.5, "time")))),
    ).toBeVisible();
    await expect(canvas.getByText(text.legend)).toBeVisible();
    const bench = () => within(canvas.getByRole("list", { name: text.bench }));
    const order = () =>
      bench()
        .getAllByRole("listitem")
        .map((li) => li.textContent ?? "");
    await expect(
      bench().getByText(
        plain(
          text.role({
            kind: "threshold",
            starter: "Léa Fictive",
            threshold: messages.picker.rangeMark(11.5, "time"),
            sense: "slower",
          }),
        ),
      ),
    ).toBeVisible();
    await expect(
      bench().getByText(text.role({ kind: "absent", starter: "Inès Démo" })),
    ).toBeVisible();
    await expect(bench().getAllByText(text.role({ kind: "bench" }))).toHaveLength(2);
    await expect(canvas.getByText(text.summary(8, 4, 1))).toBeVisible();

    // Ada comes in before Nina, then Ève goes back to the reserve and Lina takes her seat.
    await userEvent.click(canvas.getByRole("button", { name: text.moveUp("Ada Démo") }));
    await expect(order()[0]).toContain("Ada Démo");
    await expect(order()[1]).toContain("Nina Fictive");
    // The reserve opens on a touch; the bench is full, nobody goes on it.
    await userEvent.click(canvas.getByText(text.reserve(2)));
    await expect(canvas.getByText(text.reserveHint)).toBeVisible();
    await expect(
      canvas.getByRole("button", { name: text.toBenchLabel("Lina Fictive") }),
    ).toBeDisabled();
    await userEvent.click(canvas.getByRole("button", { name: text.toReserve("Ève Modèle") }));
    await expect(canvas.getByText(text.reserve(3))).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: text.toBenchLabel("Lina Fictive") }));
    await expect(order()[3]).toContain("Lina Fictive");

    await userEvent.click(canvas.getByRole("button", { name: text.validate }));
    await waitFor(() =>
      expect(args.onValidate).toHaveBeenCalledWith({
        starters: [
          { athleteId: "s1", discipline: "100 m", substituteId: "s3", threshold: 11.5 },
          { athleteId: "s2" },
          { athleteId: "m1", substituteId: "m3" },
          { athleteId: "m2" },
          { athleteId: "j1" },
          { athleteId: "j2" },
          { athleteId: "t1" },
          { athleteId: "t2" },
        ],
        bench: [{ athleteId: "m3" }, { athleteId: "s3" }, { athleteId: "j3" }, { athleteId: "s4" }],
      }),
    );
  },
};

/**
 * The sheet of a place: the discipline that counts, the substitute, a tactical threshold bounded
 * by what is plausible, with its points; « Retour » keeps the draft, « Enregistrer » applies it.
 */
export const PlaceSheet: Story = {
  args: fullRules,
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const page = within(canvasElement.ownerDocument.body);
    const sheet = () => within(page.getByRole("dialog", { name: text.starterTitle("Sprint") }));
    const open = () =>
      userEvent.click(
        canvas.getByRole("button", { name: text.takenPlace("Sprint", "Léa Fictive") }),
      );

    await open();
    await expect(sheet().getByText("RP 11,02 · MPS 11,20")).toBeVisible();
    await userEvent.click(sheet().getByRole("radio", { name: "200 m" }));
    await expect(sheet().getByText(text.onlyDiscipline("200 m"))).toBeVisible();
    await expect(sheet().getByRole("radio", { name: /Nina Fictive/ })).toBeChecked();
    // The bench is full: Lina, in reserve, cannot be chosen.
    await expect(sheet().getByRole("radio", { name: /Lina Fictive/ })).toBeDisabled();
    await expect(sheet().getByRole("switch", { name: text.tacticalToggle })).toBeChecked();
    const threshold = sheet().getByLabelText(
      text.tacticalRule("Nina Fictive", "Léa Fictive", "slower"),
    );
    await expect(threshold).toHaveAttribute("maxlength", "12");
    await userEvent.type(threshold, "8");
    await userEvent.click(sheet().getByRole("button", { name: text.save }));
    await expect(sheet().getByRole("alert")).toBeVisible();
    await userEvent.clear(threshold);
    await userEvent.type(threshold, "23,00");
    await expect(sheet().getByText(/pts au barème/)).toBeVisible();
    await userEvent.click(sheet().getByRole("button", { name: text.save }));
    await waitFor(() => expect(page.queryByRole("dialog")).toBeNull());
    await expect(
      canvas.getByText(plain(text.spotNote("Nina F.", messages.picker.rangeMark(23, "time")))),
    ).toBeVisible();

    // « Retour » keeps what was started: the choice is still there when the sheet opens again.
    await open();
    await userEvent.click(sheet().getByRole("radio", { name: new RegExp(text.noSubstitute) }));
    await userEvent.click(sheet().getByRole("button", { name: text.back }));
    await open();
    await expect(sheet().getByRole("radio", { name: new RegExp(text.noSubstitute) })).toBeChecked();
    await expect(sheet().getByRole("switch", { name: text.tacticalToggle })).toBeDisabled();
    await userEvent.click(sheet().getByRole("button", { name: text.save }));
    await expect(canvas.getByText(text.summary(8, 4, 0))).toBeVisible();

    // A starter on one start list only: no choice of discipline.
    await userEvent.click(
      canvas.getByRole("button", { name: text.takenPlace("Sprint", "Quia Fictive") }),
    );
    await expect(sheet().queryByRole("radiogroup")).toBeNull();
    await expect(sheet().getByText(text.onlyDiscipline("400 m"))).toBeVisible();
    await userEvent.click(sheet().getByRole("button", { name: text.back }));

    await userEvent.click(canvas.getByRole("button", { name: text.validate }));
    await waitFor(() =>
      expect(args.onValidate).toHaveBeenCalledWith(
        expect.objectContaining({
          starters: expect.arrayContaining([{ athleteId: "s1", discipline: "200 m" }]),
        }),
      ),
    );
  },
};

/** A bench of four, nobody on it yet: the reserve holds everyone who does not start. */
export const EmptyBench: Story = {
  args: { ...fullRules, initialPlan: { bench: [], settings: {} } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(text.benchEmpty)).toBeVisible();
    await expect(canvas.getByText(text.reserve(6))).toBeVisible();
    await expect(canvas.getByText(text.summary(8, 0, 0))).toBeVisible();
  },
};

/** Everyone starts or sits on the bench: the reserve, once opened, says so. */
export const EmptyReserve: Story = {
  args: { ...fullRules, athletes: squad.slice(0, 12) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByText(text.reserve(0)));
    await expect(canvas.getByText(text.reserveEmpty)).toBeVisible();
  },
};
