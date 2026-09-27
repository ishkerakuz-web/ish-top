import React from "react";
import { useData } from "vike-react/useData";
import type { data } from "./+data.js";
import { ContactView } from "../../components/contact/ContactView.js";

/** `/contact` — Biz bilan bog'laning (mavjud `POST /api/support`, kanallar `GET /api/support/contacts`). */
export default function Page() {
  const { contacts } = useData<Awaited<ReturnType<typeof data>>>();
  return <ContactView initial={contacts} />;
}
