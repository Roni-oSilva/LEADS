import { LoginForm } from "@/components/auth/auth-forms";

export const metadata = { title: "Entrar" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const sp = await searchParams;
  return (
    <>
      {sp.error && <p className="mb-4 rounded-lg border border-danger/30 bg-danger/10 p-3 text-xs text-danger">{sp.error}</p>}
      <LoginForm next={sp.next} />
    </>
  );
}
