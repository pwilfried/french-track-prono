/** A club average with one decimal at most, French style (« 12,5 »). Shared by server and client. */
export const decimal = (n: number) => n.toLocaleString("fr-FR", { maximumFractionDigits: 1 });
