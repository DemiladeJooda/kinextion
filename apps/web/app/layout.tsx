import type { Metadata, Viewport } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kinextion — Your System for Becoming",
  description:
    "Kinextion is a personal growth operating system that helps you achieve complete wellness through AI-powered guidance and behavioral systems. Consistency, not motivation.",
  keywords: [
    "wellness",
    "fitness",
    "AI coach",
    "habit tracking",
    "mental health",
    "personal growth",
    "consistency",
  ],
  openGraph: {
    title: "Kinextion — Your System for Becoming",
    description:
      "AI-powered wellness that adapts to your life. Build consistency across body, mind, emotion, and spirit.",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Kinextion — Your System for Becoming",
    description:
      "AI-powered wellness that adapts to your life. Build consistency across body, mind, emotion, and spirit.",
  },
};

export const viewport: Viewport = {
  themeColor: "#F5FBFA",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body>{children}</body>
      </html>
    </ClerkProvider>
  );
}
