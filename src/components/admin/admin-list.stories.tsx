import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";

import { AdminList, type AdminListProps } from "./admin-list";

type Club = { id: string; name: string; city: string; players: number; validated: boolean };

const clubs: Club[] = [
  { id: "1", name: "Étoile de Sceaux", city: "Sceaux", players: 3, validated: false },
  { id: "2", name: "Athlé Club des Tests", city: "Testville", players: 12, validated: true },
  { id: "3", name: "Foulées de Fictiville", city: "Fictiville", players: 0, validated: false },
  { id: "4", name: "Running Club Songeville", city: "Songeville", players: 1, validated: true },
];

const props: AdminListProps<Club> = {
  label: "Clubs",
  items: clubs,
  getId: (c) => c.id,
  getLabel: (c) => c.name,
  searchText: (c) => `${c.name} ${c.city}`,
  searchLabel: "Chercher un club",
  searchPlaceholder: "Nom ou ville",
  columns: [
    {
      key: "name",
      label: "Nom",
      cell: (c) => c.name,
      sort: (a, b) => a.name.localeCompare(b.name),
    },
    { key: "city", label: "Ville", cell: (c) => c.city },
    {
      key: "players",
      label: "Joueurs",
      cell: (c) => c.players,
      numeric: true,
      sort: (a, b) => a.players - b.players,
    },
  ],
  filters: [
    { key: "all", label: "Tous", test: () => true },
    { key: "pending", label: "À valider", test: (c) => !c.validated },
  ],
  bulkActions: [
    {
      key: "validate",
      label: "Valider",
      run: async (ids) => ({ message: `${ids.length} validés`, undo: () => {} }),
    },
    {
      key: "delete",
      label: "Supprimer",
      danger: true,
      confirm: (count) => ({
        title: "Supprimer ces clubs ?",
        body: `${count} clubs seront supprimés.`,
        submit: "Supprimer",
      }),
      run: async (ids) => ({ message: `${ids.length} supprimés` }),
    },
  ],
  renderDetail: (club, { close }) => (
    <div className="flex flex-col gap-2">
      <p>{club.city}</p>
      <button type="button" onClick={close} className="min-h-11 font-bold underline">
        Terminé
      </button>
    </div>
  ),
};

const meta = {
  title: "Admin/AdminList",
  component: AdminList<Club>,
  args: props,
  decorators: [
    (Story) => (
      <div className="bg-background p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof AdminList<Club>>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Search without accents, filter chips with counts, sort, and the detail panel. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("button", { name: "À valider · 2" })).toBeInTheDocument();
    await userEvent.type(canvas.getByLabelText("Chercher un club"), "etoile");
    await expect(canvas.getByText("1–1 sur 1")).toBeInTheDocument();
    await userEvent.clear(canvas.getByLabelText("Chercher un club"));
    await userEvent.click(canvas.getByRole("button", { name: "À valider · 2" }));
    await expect(canvas.getByText("1–2 sur 2")).toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "Ouvrir Foulées de Fictiville" }));
    const panel = canvas.getByRole("complementary", { name: "Foulées de Fictiville" });
    await expect(panel).toHaveTextContent("Fictiville");
    await userEvent.keyboard("{Escape}");
    await expect(canvas.queryByRole("complementary")).not.toBeInTheDocument();
  },
};

/** Two rows selected: grouped actions, a real confirmation for deleting, then the message. */
export const BulkActions: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const page = within(canvasElement.ownerDocument.body);
    await userEvent.click(canvas.getByRole("checkbox", { name: "Sélectionner Étoile de Sceaux" }));
    await userEvent.click(
      canvas.getByRole("checkbox", { name: "Sélectionner Foulées de Fictiville" }),
    );
    await expect(canvas.getByText("2 sélectionnés")).toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "Supprimer" }));
    const dialog = page.getByRole("dialog", { name: "Supprimer ces clubs ?" });
    await expect(dialog).toHaveTextContent("2 clubs seront supprimés.");
    await userEvent.click(within(dialog).getByRole("button", { name: "Supprimer" }));
    await waitFor(() => expect(canvas.getByRole("status")).toHaveTextContent("2 supprimés"));
    await expect(canvas.queryByText("2 sélectionnés")).not.toBeInTheDocument();
  },
};

/** An action that can be undone shows Annuler in its message. */
export const Undo: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("checkbox", { name: "Sélectionner Étoile de Sceaux" }));
    await userEvent.click(canvas.getByRole("button", { name: "Valider" }));
    await waitFor(() => expect(canvas.getByRole("status")).toHaveTextContent("1 validés"));
    await userEvent.click(canvas.getByRole("button", { name: "Annuler" }));
    await waitFor(() => expect(canvas.getByRole("status")).toHaveTextContent("Action annulée."));
  },
};

/** Many rows are cut into pages. */
export const Pages: Story = {
  args: {
    pageSize: 2,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("1–2 sur 4")).toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "Page suivante" }));
    await expect(canvas.getByText("3–4 sur 4")).toBeInTheDocument();
  },
};

export const Empty: Story = {
  args: { items: [], emptyText: "Aucun club pour l'instant." },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText("Aucun club pour l'instant.")).toBeInTheDocument();
  },
};

export const Loading: Story = {
  args: { status: "loading" },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText("Chargement…")).toBeInTheDocument();
  },
};

export const ErrorState: Story = {
  args: { status: "error", errorText: "Les clubs ne se chargent pas." },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("alert")).toHaveTextContent(
      "Les clubs ne se chargent pas.",
    );
  },
};

export const LongText: Story = {
  args: {
    items: [
      {
        id: "x",
        name: "Association Sportive Athlétique Intercommunale des Coureurs de Fond et de Demi-Fond",
        city: "Saint-Rémy-lès-Chevreuse-sur-Yvette",
        players: 1234,
        validated: false,
      },
    ],
  },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText("1–1 sur 1")).toBeInTheDocument();
  },
};
