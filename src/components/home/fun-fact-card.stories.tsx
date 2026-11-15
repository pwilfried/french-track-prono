import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";

import { messages } from "@/app/messages.fr";
import type { FunFact } from "@/domain/fun-facts";

import { FUN_FACT_CLOSED_KEY, FunFactCard } from "./fun-fact-card";

const text = messages.funFacts;
const TODAY = "2027-06-11";

const fact = (id: string, change: Partial<FunFact> = {}): FunFact => ({
  id,
  title: "Le saut du siècle",
  body: "Aux Jeux de Mexico 1968, Bob Beamon a sauté 8,90 m en longueur : 55 cm de plus que l'ancien record du monde.",
  tag: "bar",
  competitionSlug: null,
  discipline: null,
  startsOn: null,
  endsOn: null,
  ...change,
});

const facts = [
  fact("a"),
  fact("b", {
    title: "Le podium parfait",
    body: "Les trois athlètes à la bonne place : 12 points pour une seule épreuve.",
    tag: "predictions",
  }),
  fact("c", {
    title: "Pieds nus à Rome",
    body: "Abebe Bikila a gagné le marathon des Jeux de Rome 1960 pieds nus.",
    tag: "oddity",
  }),
];

function decorator(className: string) {
  return function Frame(Story: () => React.ReactNode) {
    return (
      <div className={`max-w-[390px] p-4 ${className}`}>
        <Story />
      </div>
    );
  };
}

const meta = {
  title: "Home/FunFactCard",
  component: FunFactCard,
  args: { facts, today: TODAY },
  decorators: [decorator("bg-background")],
  beforeEach: () => {
    localStorage.removeItem(FUN_FACT_CLOSED_KEY);
  },
} satisfies Meta<typeof FunFactCard>;

export default meta;
type Story = StoryObj<typeof meta>;

/** One fact, its tag, « Un autre » shows the next one. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole("heading", { name: text.heading })).toBeVisible();
    // The fact fades in (motion allowed): wait for the end of it.
    await waitFor(() => expect(canvas.getByText(text.tag.bar)).toBeVisible());
    await userEvent.click(canvas.getByRole("button", { name: text.another }));
    await waitFor(() =>
      expect(canvas.getByRole("heading", { name: "Le podium parfait" })).toBeVisible(),
    );
    await waitFor(() => expect(canvas.getByText(text.tag.predictions)).toBeVisible());
  },
};

/** × closes the card until the next day. */
export const Closed: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole("button", { name: text.close }));
    await waitFor(() => expect(canvas.queryByRole("heading", { name: text.heading })).toBeNull());
    await expect(localStorage.getItem(FUN_FACT_CLOSED_KEY)).toBe(TODAY);
  },
};

/** Closed yesterday: the card is back. */
export const BackTheNextDay: Story = {
  beforeEach: () => {
    localStorage.setItem(FUN_FACT_CLOSED_KEY, "2027-06-10");
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole("heading", { name: text.heading })).toBeVisible();
  },
};

/** An empty bank, an error or the card switched off: nothing at all. */
export const EmptyBank: Story = {
  args: { facts: [] },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByRole("heading", { name: text.heading })).toBeNull();
  },
};

/** One fact only: no « Un autre ». */
export const OneFact: Story = {
  args: { facts: [fact("a")] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole("heading", { name: text.heading });
    await expect(canvas.queryByRole("button", { name: text.another })).toBeNull();
  },
};

/** The longest title and text the back-office allows still fit at 320 px. */
export const LongText: Story = {
  args: {
    facts: [
      fact("long", {
        title: "Un titre très long qui remplit les soixante caractères permis",
        body: "Un texte qui va jusqu'au bout des deux cent quatre-vingts caractères permis par le back-office, pour vérifier que la carte reste lisible sur un petit téléphone, sans rien qui déborde ni qui se coupe au milieu, et que le bouton pour fermer reste bien à sa place en haut à droite de la carte.",
        tag: "oddity",
      }),
    ],
  },
  decorators: [decorator("w-[320px] bg-background")],
  play: async ({ canvasElement }) => {
    const card = (await within(canvasElement).findByRole("region")) as HTMLElement;
    await expect(card.scrollWidth).toBeLessThanOrEqual(card.clientWidth);
  },
};

/** On the night background of the dark theme. */
export const Dark: Story = {
  decorators: [decorator("dark bg-background text-foreground")],
  play: async ({ canvasElement }) => {
    await expect(
      await within(canvasElement).findByRole("heading", { name: text.heading }),
    ).toBeVisible();
  },
};
