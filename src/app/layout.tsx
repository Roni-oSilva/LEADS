import type { Metadata, Viewport } from "next";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "LeadFinder Pro", template: "%s · LeadFinder Pro" },
  description: "Encontre, qualifique e gerencie leads com dados reais, CRM integrado e prospecção responsável (LGPD).",
};
export const viewport: Viewport = { themeColor: "#0d0e12", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="dark">
      <body className="min-h-dvh antialiased">
        {children}
        <Toaster theme="dark" position="top-right" richColors closeButton toastOptions={{ style: { background: "#14161c", border: "1px solid #262a34" } }} />
      </body>
    </html>
  );
}
