import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";

import { DISMISSED_KEY, InstallBanner, InstallPrompt, SESSIONS_KEY } from "./install-prompt";

const meta = {
  title: "Shell/InstallPrompt",
  component: InstallBanner,
  args: { onInstall: fn(), onDismiss: fn() },
  decorators: [
    (Story) => (
      <div className="min-h-64 bg-background">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof InstallBanner>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The banner: install, or close for good. */
export const Visible: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/Installe l'appli/)).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Fermer, ne plus proposer" }));
    await expect(args.onDismiss).toHaveBeenCalled();
    await userEvent.click(canvas.getByRole("button", { name: "Installer" }));
    await expect(args.onInstall).toHaveBeenCalled();
  },
};

/** Fires the browser's install event, as Chrome does once the page is installable. */
const offerFromBrowser = () => {
  const event = Object.assign(new Event("beforeinstallprompt", { cancelable: true }), {
    prompt: async () => undefined,
  });
  window.dispatchEvent(event);
};

/** Second visit of a player who predicted: the browser allows the install, the banner shows. */
export const SecondVisit: Story = {
  render: () => <InstallPrompt signedIn hasPredicted />,
  beforeEach: () => {
    localStorage.setItem(SESSIONS_KEY, "1");
    localStorage.removeItem(DISMISSED_KEY);
    sessionStorage.clear();
  },
  play: async ({ canvasElement }) => {
    offerFromBrowser();
    await waitFor(() => expect(within(canvasElement).getByText(/Installe l'appli/)).toBeVisible());
  },
};

/** Closed once before: never shown again, even when the browser allows it. */
export const ClosedBefore: Story = {
  render: () => <InstallPrompt signedIn hasPredicted />,
  beforeEach: () => {
    localStorage.setItem(SESSIONS_KEY, "3");
    localStorage.setItem(DISMISSED_KEY, "1");
  },
  play: async ({ canvasElement }) => {
    offerFromBrowser();
    await new Promise((resolve) => setTimeout(resolve, 100));
    await expect(within(canvasElement).queryByText(/Installe l'appli/)).toBeNull();
  },
};

/** A visitor never sees it. */
export const Visitor: Story = {
  render: () => <InstallPrompt signedIn={false} hasPredicted={false} />,
  beforeEach: () => {
    localStorage.setItem(SESSIONS_KEY, "5");
    localStorage.removeItem(DISMISSED_KEY);
  },
  play: async ({ canvasElement }) => {
    offerFromBrowser();
    await new Promise((resolve) => setTimeout(resolve, 100));
    await expect(within(canvasElement).queryByText(/Installe l'appli/)).toBeNull();
  },
};
