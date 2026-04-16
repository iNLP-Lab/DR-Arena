import type { Metadata } from "next";
import { IBM_Plex_Mono, Instrument_Serif, Public_Sans } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";

const publicSans = Public_Sans({
  variable: "--font-public-sans",
  subsets: ["latin"],
  display: "swap",
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Deep Research Arena — Agent Leaderboard",
    template: "%s · Deep Research Arena",
  },
  description:
    "Deep Research Arena is an automated evaluation framework for Deep Research agents. Dynamic information trees, adaptive difficulty, and 0.94 Spearman correlation with LMSYS Search Arena.",
  metadataBase: new URL("https://mattchrisp.github.io/DR-Arena-Test/"),
  openGraph: {
    title: "Deep Research Arena — Agent Leaderboard",
    description:
      "Automated evaluation for deep research agents. 0.94 Spearman with LMSYS Search Arena.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${publicSans.variable} ${ibmPlexMono.variable} ${instrumentSerif.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-bg text-fg">
        <SiteHeader />
        <main className="flex-1 flex flex-col items-center">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
