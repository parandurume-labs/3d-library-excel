import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Durume 3D Library",
  description: "A lightweight Excel-backed 3D library with a clearly marked local demo mode.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
