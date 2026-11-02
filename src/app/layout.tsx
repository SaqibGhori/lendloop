import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";
import { Providers } from "./providers";
import { Nav } from "@/components/Nav";
import { ErrorBoundary } from "@/components/ErrorBoundary";

export const metadata: Metadata = {
  title: "LendLoop",
  description: "Borrow what you need. Lend what you don't.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-stone-50 text-stone-900 antialiased">
        <ClerkProvider>
          <Providers>
            <Nav />
            <main className="mx-auto max-w-5xl px-4 pb-16 pt-6">
              <ErrorBoundary>{children}</ErrorBoundary>
            </main>
          </Providers>
        </ClerkProvider>
      </body>
    </html>
  );
}
