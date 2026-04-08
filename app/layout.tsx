import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tucker Medical — Share Oura Data",
  description: "Share your Oura Ring health data with your Tucker Medical care team",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
