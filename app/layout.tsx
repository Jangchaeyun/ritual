import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono } from "next/font/google";
import { AccountProvider } from "@/components/account-provider";
import { AppGate } from "@/components/auth/app-gate";
import { AuthProvider } from "@/components/auth-provider";
import { ThemeBoot } from "@/components/layout/theme-toggle";
import { RoutineProvider } from "@/components/routine-provider";
import "./globals.css";

const plexMono = IBM_Plex_Mono({
  weight: ["400", "500"],
  subsets: ["latin"],
  variable: "--font-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "RITUAL · 라이프·업무 루틴",
    template: "%s · RITUAL",
  },
  description: "습관, 할 일, 공부와 근무 시간을 한 화면에서 이어가는 개인화 루틴 트래커",
  applicationName: "RITUAL",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "RITUAL",
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f3f0ea",
  colorScheme: "light dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className={`${plexMono.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
      </head>
      <body className="min-h-full bg-paper font-sans text-ink">
        <script
          dangerouslySetInnerHTML={{
            __html:
              'try{if(localStorage.getItem("ritual:theme")==="dark"){document.documentElement.dataset.theme="dark";document.documentElement.style.colorScheme="dark"}}catch(e){}',
          }}
        />
        <ThemeBoot />
        <AuthProvider>
          <AccountProvider>
            <RoutineProvider>
              <AppGate>{children}</AppGate>
            </RoutineProvider>
          </AccountProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
