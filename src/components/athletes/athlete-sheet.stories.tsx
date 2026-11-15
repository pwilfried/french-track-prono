import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";

import type { AthleteSheet, SheetRecord } from "@/domain/athlete";

import { AthleteSheetView } from "./athlete-sheet";

const record = (
  discipline: string,
  kind: "pr" | "sb",
  mark: string,
  date: string,
  meeting: string | null = "Meeting de démo",
  verified = true,
): SheetRecord => ({ discipline, kind, mark, date, meeting, verified });

// A fictitious athlete: no real name in the stories.
const sheet: AthleteSheet = {
  athleteId: "a1",
  slug: "lea-fictive",
  name: "Léa Fictive",
  countryCode: "FRA",
  gender: "F",
  disciplines: ["100 m"],
  managerPrice: 18,
  records: [
    record("100 m", "pr", "10.95", "2025-07-14", "Meeting de démo"),
    record("100 m", "sb", "11.02", "2026-06-20", "Championnats de démo"),
  ],
};

const meta = {
  title: "Athletes/AthleteSheet",
  component: AthleteSheetView,
  args: { sheet, season: 2026, retryHref: "/athletes/lea-fictive" },
  decorators: [
    (Story) => (
      <div className="max-w-md bg-background p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof AthleteSheetView>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Header with initials, the Manager price and the block of the main discipline. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("heading", { level: 1 })).toHaveTextContent("Léa Fictive");
    await expect(canvas.getByText("LF")).toBeVisible();
    const key = canvas.getByRole("region", { name: "Chiffres clés" });
    await expect(within(key).getByText("18 cr.")).toBeVisible();
    // Each record shows once, in its discipline block (#938).
    await expect(canvas.getAllByText("10.95")).toHaveLength(1);
    await expect(canvas.getByText("Source : World Athletics")).toBeVisible();
    await expect(canvas.queryByText("? : marque à vérifier")).toBeNull();
  },
};

/** Several disciplines: the main one first, then the others. */
export const SeveralDisciplines: Story = {
  args: {
    sheet: {
      ...sheet,
      disciplines: ["200 m", "100 m", "Relais 4 × 100 m"],
      records: [
        ...sheet.records,
        record("200 m", "pr", "22.30", "2024-08-02"),
        record("200 m", "sb", "22.41", "2026-07-10"),
        record("400 m", "pr", "51.20", "2023-05-01", null),
      ],
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const blocks = canvas.getAllByRole("heading", { level: 3 });
    await expect(blocks.map((b) => b.textContent)).toEqual(["200 m", "100 m", "400 m"]);
  },
};

/** A mark not verified yet carries « ? » and the legend shows. */
export const Unverified: Story = {
  args: {
    sheet: {
      ...sheet,
      records: [
        record("100 m", "pr", "10.95", "2025-07-14", "Meeting de démo", false),
        sheet.records[1]!,
      ],
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("? : marque à vérifier")).toBeVisible();
    await expect(canvas.getAllByText("(marque à vérifier)", { exact: false }).length).toBe(1);
  },
};

/** A personal best set this season: one mark, one « ? », one legend (#938). */
export const PersonalBestThisSeason: Story = {
  args: {
    sheet: {
      ...sheet,
      records: [
        record("100 m", "pr", "10.95", "2026-07-14", "Meeting de démo", false),
        record("100 m", "sb", "10.95", "2026-07-14", "Meeting de démo", false),
      ],
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getAllByText("10.95")).toHaveLength(1);
    await expect(canvas.getAllByText("?")).toHaveLength(1);
    await expect(canvas.getAllByText("? : marque à vérifier")).toHaveLength(1);
    await expect(canvas.queryByText("Saison 2026")).toBeNull();
  },
};

/** No record yet: the page says so; no Manager price, no key figure. */
export const Empty: Story = {
  args: { sheet: { ...sheet, managerPrice: null, records: [] } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Pas encore de record enregistré.")).toBeVisible();
    await expect(canvas.queryByRole("region", { name: "Chiffres clés" })).toBeNull();
  },
};

export const Loading: Story = {
  args: { sheet: undefined, status: "loading" },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("status")).toHaveAccessibleName(
      "Chargement de la fiche…",
    );
  },
};

export const Error: Story = {
  args: { sheet: undefined, status: "error" },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("alert")).toHaveTextContent("fiche athlète");
  },
};

/** A long name, long disciplines and a long meeting wrap instead of overflowing. */
export const LongText: Story = {
  args: {
    sheet: {
      ...sheet,
      name: "Marie-Josée Fictive-Démonstration de la Grande Piste",
      disciplines: ["3000 m steeple", "Semi-marathon"],
      records: [
        record(
          "3000 m steeple",
          "pr",
          "9:05.12",
          "2025-08-30",
          "Meeting international de démonstration de la Grande Piste",
        ),
      ],
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("heading", { level: 1 })).toHaveTextContent("Grande Piste");
    await expect(canvasElement.scrollWidth).toBeLessThanOrEqual(canvasElement.clientWidth + 1);
  },
};
