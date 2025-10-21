import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { PushChainProviders } from "@/providers/PushChainProviders";
import { NotificationProvider } from "@/components/ui/Notification";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Push Launchpad | Universal DEX & Token Launchpad",
  description: "Launch tokens and trade on Push Chain from any blockchain. No bridges, no wrapping.",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <PushChainProviders>
          <NotificationProvider>{children}</NotificationProvider>
        </PushChainProviders>
      </body>
    </html>
  );
}
