import type { ReactNode } from "react";

export const metadata = { title: "סינון תכנים לילדים", description: "דשבורד הורים" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="he" dir="rtl">
      <body style={{ fontFamily: "system-ui, sans-serif", margin: 0, padding: 24 }}>{children}</body>
    </html>
  );
}
