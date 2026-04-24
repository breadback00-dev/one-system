import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";
import "./marketing.css";

export const metadata: Metadata = {
  title: "One System — Operator platform for appointment businesses",
  description:
    "One System captures, nurtures, and reactivates customers for appointment-based businesses. Five modules, one platform.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body>{children}</body>
      </html>
    </ClerkProvider>
  );
}
