import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";

import { AdminBanner } from "./admin-banner";

const meta = {
  title: "Admin/AdminBanner",
  component: AdminBanner,
  decorators: [
    (Story) => (
      <div className="w-80 bg-background">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof AdminBanner>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithAdminName: Story = {
  args: { adminName: "admin: p.wilfried" },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText(/Back-office/)).toBeInTheDocument();
  },
};

export const WithView: Story = {
  args: { view: "saisie startlist" },
};

export const BareMinimum: Story = {
  args: {},
};
