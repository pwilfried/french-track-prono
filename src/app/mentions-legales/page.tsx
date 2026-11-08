import type { Metadata } from "next";

import { LegalPage } from "@/components/legal/legal-page";

import { messages } from "../messages.fr";

export const metadata: Metadata = { title: messages.legal.notice.title };

export default function LegalNoticePage() {
  return <LegalPage {...messages.legal.notice} />;
}
