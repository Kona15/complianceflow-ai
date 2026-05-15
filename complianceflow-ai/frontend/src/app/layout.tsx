import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { SupabaseProvider } from "@/components/ui/supabase-provider";
import { Toaster } from "@/components/ui/toaster";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "ComplianceFlow AI — Agentic Document Verification",
  description: "Autonomous multi-agent compliance orchestration powered by Kimi K2.6 Agent Swarm",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} font-sans antialiased`}>
        <SupabaseProvider>
          {children}
          <Toaster />
        </SupabaseProvider>
      </body>
    </html>
  );
}