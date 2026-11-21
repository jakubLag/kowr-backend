import type { Metadata } from "next";
import "leaflet/dist/leaflet.css";
import "./globals.css";

export const metadata: Metadata = {
  title:
    "System wsparcia gospodarowania wodą w rolnictwie — Krajowy Ośrodek Wsparcia Rolnictwa (KOWR)",
  description:
    "Publiczna e-usługa doradztwa wodnego i retencyjnego dla rolników. Ocena ryzyka suszy, wytyczne retencyjne oraz kalkulacja dawek nawadniania dla działek ewidencyjnych.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pl">
      <body className="font-sans antialiased min-h-screen flex flex-col bg-white text-gov-text">
        {children}
      </body>
    </html>
  );
}
