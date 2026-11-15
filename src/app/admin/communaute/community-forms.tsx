"use client";

import { useActionState } from "react";

import { messages } from "@/app/messages.fr";
import { SubmitButton } from "@/components/account/submit-button";
import {
  ANNOUNCEMENT_KINDS,
  ANNOUNCEMENT_LINK_MAX,
  ANNOUNCEMENT_SUBTITLE_MAX,
  ANNOUNCEMENT_TITLE_MAX,
  POLL_OPTION_MAX,
  POLL_OPTIONS_MAX,
  POLL_QUESTION_MAX,
} from "@/domain/community";

import { createPollAction, publishAnnouncementAction, type CommunityFormState } from "./actions";

const text = messages.adminCommunity;
const field = "min-h-11 w-full rounded-xl border-2 border-border bg-background px-3 text-base";
const label = "flex flex-col gap-1 text-sm font-semibold";

function Outcome({ state, done }: { state: CommunityFormState; done: string }) {
  if (state.error) {
    return (
      <p role="alert" className="text-sm font-semibold text-accent-text">
        {messages.errors[state.error]}
      </p>
    );
  }
  return state.done ? (
    <p role="status" className="text-sm font-semibold text-success-text">
      {done}
    </p>
  ) : null;
}

/** An announcement: a kind, a short title and subtitle, a link (#673). */
export function AnnouncementForm() {
  const [state, action] = useActionState<CommunityFormState, FormData>(
    publishAnnouncementAction,
    {},
  );
  return (
    <form action={action} className="flex flex-col gap-3">
      <label className={label}>
        {text.kind}
        <select name="kind" defaultValue="episode" className={field}>
          {ANNOUNCEMENT_KINDS.map((kind) => (
            <option key={kind} value={kind}>
              {messages.community.announcement.label[kind]}
            </option>
          ))}
        </select>
      </label>
      <label className={label}>
        {text.titleLabel}
        <input name="title" required maxLength={ANNOUNCEMENT_TITLE_MAX} className={field} />
      </label>
      <label className={label}>
        {text.subtitleLabel}
        <input name="subtitle" maxLength={ANNOUNCEMENT_SUBTITLE_MAX} className={field} />
      </label>
      <label className={label}>
        {text.linkLabel}
        <input
          name="link"
          inputMode="url"
          maxLength={ANNOUNCEMENT_LINK_MAX}
          autoComplete="off"
          className={field}
        />
      </label>
      <SubmitButton pendingLabel={text.publishing}>{text.publish}</SubmitButton>
      <Outcome state={state} done={text.published} />
    </form>
  );
}

/** A poll: a question, 2 to 4 answers, a closing time in Paris time (#673). */
export function PollForm() {
  const [state, action] = useActionState<CommunityFormState, FormData>(createPollAction, {});
  return (
    <form action={action} className="flex flex-col gap-3">
      <label className={label}>
        {text.question}
        <input name="question" required maxLength={POLL_QUESTION_MAX} className={field} />
      </label>
      {Array.from({ length: POLL_OPTIONS_MAX }, (_o, i) => (
        <label key={i} className={label}>
          {text.option(i + 1)}
          <input
            name={`option${i}`}
            required={i < 2}
            maxLength={POLL_OPTION_MAX}
            className={field}
          />
        </label>
      ))}
      <label className={label}>
        {text.closesAt}
        <input type="datetime-local" name="closesAt" required className={field} />
      </label>
      <SubmitButton pendingLabel={text.creating}>{text.create}</SubmitButton>
      <Outcome state={state} done={text.created} />
    </form>
  );
}
