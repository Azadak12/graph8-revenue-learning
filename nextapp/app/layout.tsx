import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "Graph8 Revenue Learning",
  description: "Win/Loss Intelligence for Graph8 revenue teams",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
