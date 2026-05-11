import type { Metadata } from "next";
import { Space_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { UserProvider } from "@/contexts/UserContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import Footer from "@/components/Footer";
import InstallationChecker from "@/components/InstallationChecker";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  weight: ["400", "500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Nextlog - Amateur Radio Logging",
  description: "Modern amateur radio contact logging and station management",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`dark ${spaceGrotesk.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var theme = localStorage.getItem('theme') || 'dark';
                  var actualTheme = theme;

                  if (theme === 'system') {
                    actualTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
                  }

                  var root = document.documentElement;
                  root.classList.remove('light', 'dark');
                  root.classList.add(actualTheme);
                } catch (e) {
                  // Fallback already set with className="dark"
                }
              })();
            `,
          }}
        />
      </head>
      <body className="font-sans antialiased">
        <ThemeProvider>
          <UserProvider>
            <InstallationChecker>
              <div className="flex flex-col min-h-screen">
                {children}
                <Footer />
              </div>
            </InstallationChecker>
          </UserProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
