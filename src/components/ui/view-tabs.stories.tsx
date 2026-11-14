import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";

import { ViewTabs } from "./view-tabs";

const meta = {
  title: "UI/ViewTabs",
  component: ViewTabs,
  args: {
    label: "Vue du classement",
    idPrefix: "vue",
    panelId: "panel",
    selected: "soir",
    tabs: [
      { id: "ligue", label: "Ma ligue", href: "/classement?vue=ligue" },
      { id: "soir", label: "Ce soir", href: "/classement?vue=soir" },
      { id: "general", label: "Général", href: "/classement?vue=general" },
    ],
  },
  decorators: [
    (Story) => (
      <div className="max-w-[390px] bg-background p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ViewTabs>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A view switch, not a button row: one tab selected, raised and bold (#708). */
export const Three: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const tabs = canvas.getByRole("tablist", { name: "Vue du classement" });
    await expect(within(tabs).getAllByRole("tab")).toHaveLength(3);
    await expect(canvas.getByRole("tab", { name: "Ce soir" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(canvas.getByRole("tab", { name: "Ma ligue" })).toHaveAttribute(
      "aria-selected",
      "false",
    );
    // Not by colour alone: the selected tab is bold, the others are not.
    await expect(canvas.getByRole("tab", { name: "Ce soir" })).toHaveClass("font-bold");
    await expect(canvas.getByRole("tab", { name: "Général" })).not.toHaveClass("font-bold");
  },
};

/** « Mes ligues · 1 / Découvrir » on the leagues tab, same control (#708). */
export const Two: Story = {
  args: {
    label: "Mes ligues ou découvrir",
    idPrefix: "onglet",
    selected: "mes-ligues",
    tabs: [
      { id: "mes-ligues", label: "Mes ligues · 1", href: "/ligues" },
      { id: "decouvrir", label: "Découvrir", href: "/ligues?onglet=decouvrir" },
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("tab", { name: "Mes ligues · 1" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  },
};

/** A long label stays on one line, cut with an ellipsis rather than overflowing at 320 px. */
export const LongText: Story = {
  args: {
    selected: "a",
    tabs: [
      { id: "a", label: "Mes ligues privées et publiques · 12", href: "/a" },
      { id: "b", label: "Découvrir les ligues publiques", href: "/b" },
    ],
  },
  decorators: [
    (Story) => (
      <div className="max-w-[320px]">
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("tab", { name: /Découvrir/ })).toBeVisible();
    await expect(canvasElement.scrollWidth).toBeLessThanOrEqual(canvasElement.clientWidth);
  },
};
