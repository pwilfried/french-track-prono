/** Text value of a form field; an absent or non-text field counts as empty. */
export function formText(data: FormData, name: string): string {
  const value = data.get(name);
  return typeof value === "string" ? value : "";
}

/** Text values of a field sent several times (ticked boxes); non-text values are left out. */
export function formTexts(data: FormData, name: string): string[] {
  return data.getAll(name).filter((value): value is string => typeof value === "string");
}
