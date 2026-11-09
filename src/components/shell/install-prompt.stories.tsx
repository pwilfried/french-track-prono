import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";

import {
  DISMISSED_KEY,
  InstallBanner,
  InstallEntry,
  InstallPrompt,
  SESSIONS_KEY,
} from "./install-prompt";

const meta = {
  title: "Shell/InstallPrompt",
  component: InstallBanner,
  args: { way: "browser", onInstall: fn(), onDismiss: fn() },
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

const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1";
const INSTAGRAM =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 357.0.0.25.101 (iPhone15,2; iOS 18_1; fr_FR; fr; scale=3.00; 1179x2556; 658245390)";

/** Pretends to be another device for one story; the cleanup brings the real user agent back. */
const asDevice = (userAgent: string) => () => {
  Object.defineProperty(navigator, "userAgent", { value: userAgent, configurable: true });
  return () => {
    Reflect.deleteProperty(navigator, "userAgent");
  };
};

/** Fires the browser's install event, as Chrome does once the page is installable. */
const offerFromBrowser = () => {
  const prompt = fn(async () => undefined);
  const event = Object.assign(new Event("beforeinstallprompt", { cancelable: true }), { prompt });
  window.dispatchEvent(event);
  return prompt;
};

const freshVisit = (sessionsBefore: string) => {
  localStorage.setItem(SESSIONS_KEY, sessionsBefore);
  localStorage.removeItem(DISMISSED_KEY);
  sessionStorage.clear();
};

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

/** iPhone: Safari has no install button, the banner gives the two steps instead. */
export const IPhone: Story = {
  args: { way: "ios" },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/Partager, puis «\sSur l'écran d'accueil\s»/)).toBeVisible();
    await expect(canvas.queryByRole("button", { name: "Installer" })).toBeNull();
    await userEvent.click(canvas.getByRole("button", { name: "Fermer, ne plus proposer" }));
    await expect(args.onDismiss).toHaveBeenCalled();
  },
};

/** In-app browser (Instagram…): nothing can be installed there, so it says how to leave it. The longest text. */
export const InAppBrowser: Story = {
  args: { way: "in-app" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/Ouvrir dans le navigateur/)).toBeVisible();
    await expect(canvas.queryByRole("button", { name: "Installer" })).toBeNull();
  },
};

/** Second visit of a player who predicted: the browser allows the install, the banner shows. */
export const SecondVisit: Story = {
  render: () => <InstallPrompt signedIn hasPredicted />,
  beforeEach: () => freshVisit("1"),
  play: async ({ canvasElement }) => {
    offerFromBrowser();
    await waitFor(() => expect(within(canvasElement).getByText(/Installe l'appli/)).toBeVisible());
  },
};

/** iPhone, first visit after a prediction: the steps show at once, no browser event needed. */
export const IPhoneFirstVisit: Story = {
  render: () => <InstallPrompt signedIn hasPredicted />,
  beforeEach: () => {
    freshVisit("0");
    return asDevice(IPHONE)();
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(canvas.getByText(/Sur l'écran d'accueil/)).toBeVisible());
    await userEvent.click(canvas.getByRole("button", { name: "Fermer, ne plus proposer" }));
    await expect(canvas.queryByText(/Sur l'écran d'accueil/)).toBeNull();
    await expect(localStorage.getItem(DISMISSED_KEY)).toBe("1");
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

const inProfile = () => (
  <div className="mx-auto flex max-w-md flex-col gap-2 p-4">
    <InstallEntry />
  </div>
);

/** Profile, iPhone: the row opens on the two steps. */
export const ProfileIPhone: Story = {
  render: inProfile,
  beforeEach: asDevice(IPHONE),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByText("Installer l'appli"));
    await expect(canvas.getByText(/Sur l'écran d'accueil/)).toBeVisible();
  },
};

/** Profile, Instagram's browser: the row says how to open the real browser. */
export const ProfileInAppBrowser: Story = {
  render: inProfile,
  beforeEach: asDevice(INSTAGRAM),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByText("Installer l'appli"));
    await expect(canvas.getByText(/Ouvrir dans le navigateur/)).toBeVisible();
  },
};

/** Profile, Chrome: the row appears once the browser allows the install, and opens its prompt. */
export const ProfileBrowser: Story = {
  render: inProfile,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByText("Installer l'appli")).toBeNull();
    const prompt = offerFromBrowser();
    await userEvent.click(await canvas.findByRole("button", { name: "Installer l'appli" }));
    await expect(prompt).toHaveBeenCalled();
    await expect(canvas.queryByText("Installer l'appli")).toBeNull();
  },
};
