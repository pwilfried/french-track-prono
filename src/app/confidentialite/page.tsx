import type { Metadata } from "next";

import { LegalPage } from "@/components/legal/legal-page";

import { messages } from "../messages.fr";

export const metadata: Metadata = { title: messages.legal.privacy.title };

export default function PrivacyPage() {
  return <LegalPage {...messages.legal.privacy} />;
}
