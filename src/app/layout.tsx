import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Laboratório LAC",
  description: "Conferência de exames autorizados pela Unimed",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
