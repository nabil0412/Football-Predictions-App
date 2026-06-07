import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { NavBar } from "@/components/NavBar";

export const metadata: Metadata = {
  title: "Football Predictions 2026",
  description: "Predict 2026 football matches, earn points, compete with friends.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body>
          <NavBar />
          <main style={{ minHeight: "calc(100vh - 56px)" }}>{children}</main>
          <Toaster />
        </body>
      </html>
    </ClerkProvider>
  );
}
