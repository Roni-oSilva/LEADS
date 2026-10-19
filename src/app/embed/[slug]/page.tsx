import type { Metadata } from "next";
import { PublicForm } from "@/components/forms/public-form";
import { loadPublicForm } from "@/lib/forms/public";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false } };

export default async function EmbedFormPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { form, fields } = await loadPublicForm(slug);
  return <PublicForm embedded slug={form.slug} title={form.title} description={form.description} privacyNotice={form.privacy_notice} collectPrefs={form.collect_comm_preferences} fields={fields} />;
}
