import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Project S.C.A.L.E. // Mission Control",
  description: "Swarm Capture & Autonomous LEO Extraction"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
