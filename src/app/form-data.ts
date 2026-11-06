/** Text value of a form field; an absent or non-text field counts as empty. */
export function formText(data: FormData, name: string): string {
  const value = data.get(name);
  return typeof value === "string" ? value : "";
}
