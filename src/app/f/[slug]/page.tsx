import type { Metadata } from "next";
import { PublicForm } from "@/components/forms/public-form";
import { loadPublicForm } from "@/lib/forms/public";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false } };

export default async function PublicFormPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { form, fields } = await loadPublicForm(slug);
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <PublicForm slug={form.slug} title={form.title} description={form.description} privacyNotice={form.privacy_notice} collectPrefs={form.collect_comm_preferences} fields={fields} />
    </main>
  );
}
