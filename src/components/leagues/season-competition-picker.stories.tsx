import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";

import { messages } from "@/app/messages.fr";
import { ErrorNotice } from "@/components/error-notice";
import type { PickableCompetition } from "@/domain/season-picker";

import {
  SeasonCompetitionPicker,
  SeasonCompetitionPickerSkeleton,
} from "./season-competition-picker";

const text = messages.seasonPicker;
const manager = messages.manager;

const LEVELS = [
  "diamond-league",
  "world-indoor-tour-gold",
  "continental-tour-gold",
  "continental-tour-silver",
  "championnat",
  null,
];

/**
 * `count` invented competitions, two a week from January 2027: every level, a few indoor, a few
 * French, and one name out of ten very long.
 */
function season(count: number): PickableCompetition[] {
  return Array.from({ length: count }, (_, i) => {
    const level = LEVELS[i % LEVELS.length]!;
    return {
      id: `c${i + 1}`,
      name:
        i % 10 === 9
          ? `Meeting international de la Ville Imaginaire et de sa Grande Agglomération ${i + 1}`
          : `Meeting ${i + 1}`,
      firstEventAt: new Date(Date.UTC(2027, 0, 4) + i * 3.5 * 86_400_000).toISOString(),
      city: i % 4 === 0 ? null : `Ville ${i + 1}`,
      scope: i % 7 === 3 ? "france" : "international",
      venue: level === "world-indoor-tour-gold" || i % 9 === 0 ? "indoor" : "outdoor",
      level,
    };
  });
}

const meta = {
  title: "Leagues/SeasonCompetitionPicker",
  component: SeasonCompetitionPicker,
  args: {
    competitions: season(20),
    chosen: [],
    name: "competitions",
    minimum: 6,
    withFormat: true,
    label: manager.competitionsLabel,
    hint: manager.competitionsHint,
    empty: manager.competitionsNone,
    submitLabel: manager.submit,
    pendingLabel: manager.creating,
  },
  decorators: [
    (Story) => (
      <form className="max-w-[390px] bg-background p-4" onSubmit={(e) => e.preventDefault()}>
        <Story />
      </form>
    ),
  ],
} satisfies Meta<typeof SeasonCompetitionPicker>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A Manager league: a quick selection replaces the ticks, the format and the advice follow. */
export const Manager: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const submit = canvas.getByRole("button", { name: manager.submit });
    await expect(submit).toBeDisabled();
    await expect(canvas.getByText(manager.seasonTooFew(0))).toBeVisible();

    await userEvent.click(
      canvas.getByRole("button", { name: text.quickLabel(text.quick.season, 20) }),
    );
    await expect(canvas.getByText(manager.seasonFormat(20, 10, 18, 2))).toBeVisible();
    await expect(canvas.getByText(/Retires-en 2/)).toBeVisible();
    await expect(submit).toBeEnabled();

    // Another quick selection replaces the first one.
    await userEvent.click(canvas.getByRole("button", { name: "Diamond League · 4" }));
    await expect(canvas.getByText(manager.seasonTooFew(4))).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Diamond League · 4" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(submit).toBeDisabled();
  },
};

/**
 * Many quick selections scroll sideways inside their row: the picker keeps the width of a phone,
 * so the page does not scroll sideways (a fieldset grows to its content by default).
 */
export const NarrowScreen: Story = {
  play: async ({ canvasElement }) => {
    const form = canvasElement.querySelector("form")!;
    const fieldset = canvasElement.querySelector("fieldset")!;
    const row = within(canvasElement).getByRole("group", { name: text.quickTitle });
    await expect(row.scrollWidth).toBeGreaterThan(row.clientWidth);
    await expect(fieldset.getBoundingClientRect().width).toBeLessThanOrEqual(form.clientWidth);
    await expect(form.scrollWidth).toBeLessThanOrEqual(form.clientWidth);
  },
};

/** The filters and « Tout cocher » act on the competitions shown only. */
export const Filters: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: text.scope.france }));
    await expect(canvas.getByText(text.shown(3, 20))).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: text.checkShown }));
    await expect(canvas.getByText(manager.seasonTooFew(3))).toBeVisible();

    await userEvent.click(canvas.getByRole("button", { name: text.scope.all }));
    await userEvent.type(canvas.getByRole("searchbox", { name: text.searchLabel }), "zzz");
    await expect(canvas.getByText(text.noMatch)).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: text.resetFilters }));
    await expect(canvas.getByText(text.shown(20, 20))).toBeVisible();

    await userEvent.click(canvas.getByLabelText(text.onlyChosen));
    await expect(canvas.getByText(text.shown(3, 20))).toBeVisible();
  },
};

/**
 * A predictions league (#721): the same picker as the Manager, no format, valid from one
 * competition; three out of a season of 40 in a few taps, with the search.
 */
export const NormalLeague: Story = {
  args: {
    competitions: season(42),
    withFormat: false,
    minimum: 1,
    name: "competition",
    label: messages.leagues.competitionsTitle,
    hint: messages.leagues.how,
    empty: messages.leagues.createNone,
    submitLabel: messages.leagues.createSubmit,
    pendingLabel: messages.leagues.creating,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const submit = canvas.getByRole("button", { name: messages.leagues.createSubmit });
    await expect(submit).toBeDisabled();
    await expect(canvas.getByText(text.atLeast(1))).toBeVisible();
    await userEvent.click(canvas.getByRole("checkbox", { name: /^Meeting 1 ·/ }));
    await expect(canvas.getByText(text.chosen(1))).toBeVisible();
    await expect(canvas.queryByText(/joueurs ·/)).toBeNull();
    await expect(submit).toBeEnabled();

    // A competition of a closed month, found by its name.
    const search = canvas.getByRole("searchbox", { name: text.searchLabel });
    await userEvent.type(search, "Meeting 38");
    await userEvent.click(canvas.getByRole("checkbox", { name: /^Meeting 38 ·/ }));
    await userEvent.clear(search);
    await expect(canvas.getByText(text.chosen(2))).toBeVisible();
    const fields = canvasElement.querySelectorAll<HTMLInputElement>('input[name="competition"]');
    await expect([...fields].map((f) => f.value)).toEqual(["c1", "c38"]);
  },
};

/** Another part of the form is not ready (no family ticked): the button waits for it. */
export const Blocked: Story = {
  args: { ...NormalLeague.args, chosen: ["c1"], blocked: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(text.chosen(1))).toBeVisible();
    await expect(
      canvas.getByRole("button", { name: messages.leagues.createSubmit }),
    ).toBeDisabled();
  },
};

/** 150 competitions over a year and a half: only the first two months are open. */
export const LongText: Story = {
  args: { competitions: season(150), chosen: ["c1", "c2", "c3"] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(text.shown(150, 150))).toBeVisible();
    const months = canvas.getAllByRole("button", { expanded: true });
    await expect(months).toHaveLength(2);
    const closed = canvas.getAllByRole("button", { expanded: false })[0]!;
    await userEvent.click(closed);
    await expect(closed).toHaveAttribute("aria-expanded", "true");
    // A search opens every month.
    await userEvent.type(canvas.getByRole("searchbox", { name: text.searchLabel }), "meeting");
    await expect(canvas.queryAllByRole("button", { expanded: false })).toHaveLength(0);
  },
};

/** Fewer competitions than the minimum: the message, nothing to tick toward a league. */
export const Empty: Story = {
  args: { competitions: [] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(manager.competitionsNone)).toBeVisible();
    await expect(canvas.queryByRole("searchbox")).toBeNull();
    await expect(canvas.getByRole("button", { name: manager.submit })).toBeDisabled();
  },
};

/** While the competitions load. */
export const Loading: Story = {
  render: () => <SeasonCompetitionPickerSkeleton />,
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText(text.loading)).toBeInTheDocument();
  },
};

/** The competitions could not be read: the page shows the error with a retry link. */
export const Error: Story = {
  render: () => (
    <ErrorNotice retryHref="/manager/creer" message={messages.errors.LEAGUES_UNAVAILABLE} />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("alert")).toHaveTextContent(messages.errors.LEAGUES_UNAVAILABLE);
  },
};
