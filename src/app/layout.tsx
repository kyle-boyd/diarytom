import type { Metadata } from "next";
import { Fraunces } from "next/font/google";
import "./globals.css";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Tom Riddle's Diary",
  description: "A diary that thinks for itself.",
  icons: {
    icon: "/trlogo.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="overflow-hidden">
      <body
        className={`${fraunces.variable} font-serif antialiased bg-parchment text-ink min-h-screen overflow-hidden`}
      >
        {children}
      </body>
    </html>
  );
}
