import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HorarioEdu",
  description: "Generador automático de horarios escolares",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
