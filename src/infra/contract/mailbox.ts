// Reads sign-in codes from the local test mailbox (Mailpit), for tests against local Supabase.
const mailbox = process.env.SUPABASE_MAILBOX_URL ?? "http://127.0.0.1:54324";

/** Reads the 6-digit code of the latest message sent to an address in the local test mailbox. */
export async function latestCodeFromMailbox(email: string): Promise<string> {
  let seen = "no message";
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const search = await fetch(
      `${mailbox}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`,
    );
    const { messages } = (await search.json()) as { messages?: { ID: string }[] };
    const id = messages?.[0]?.ID;
    if (id) {
      const message = (await (await fetch(`${mailbox}/api/v1/message/${id}`)).json()) as {
        Text?: string;
        HTML?: string;
        Subject?: string;
      };
      // The template is HTML: read the text part when there is one, else the HTML without tags.
      const body = message.Text || (message.HTML ?? "").replace(/<[^>]+>/g, " ");
      // Mailpit may render the bold code with markers around it: allow a few non-digits before it.
      const match = /Code de (?:connexion|confirmation)\D{0,20}(\d{6})/.exec(body);
      if (match?.[1]) return match[1];
      seen = `message "${message.Subject}" without the code, start of body: ${body.replace(/\s+/g, " ").slice(0, 600)}`;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`no sign-in code found for ${email} in ${mailbox} (${seen})`);
}

/** Deletes the messages sent to an address, so the next code read is the one asked for next. */
export async function clearMailbox(email: string): Promise<void> {
  await fetch(`${mailbox}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`, {
    method: "DELETE",
  });
}
