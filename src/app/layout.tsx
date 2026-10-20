import type { Metadata } from "next";
import { Noto_Sans_Georgian, Inter } from "next/font/google";
import "./globals.css";

const notoGeorgian = Noto_Sans_Georgian({
  variable: "--font-georgian",
  subsets: ["georgian", "latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "meminda (მემინდა) — სურვილებისა და საჩუქრების პლატფორმა",
  description:
    "შექმენი შენი სურვილების სია, გაუზიარე მეგობრებს და დაჯავშნე სასურველი საჩუქარი.",
  icons: {
    icon: "/meminda.svg",
    shortcut: "/meminda.svg",
    apple: "/meminda.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ka"
      className={`${notoGeorgian.variable} ${inter.variable} h-full antialiased`}
    >
      <body
        style={{ fontFamily: "var(--font-georgian), var(--font-inter), sans-serif" }}
        className="min-h-full flex flex-col"
      >
        {children}
      </body>
    </html>
  );
}
