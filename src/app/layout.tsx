import type { Metadata } from "next";
// import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { UserProvider } from "@/contexts/UserContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import Footer from "@/components/Footer";
import InstallationChecker from "@/components/InstallationChecker";

// const geistSans = Geist({
//   variable: "--font-geist-sans",
//   subsets: ["latin"],
// });

// const geistMono = Geist_Mono({
//   variable: "--font-geist-mono",
//   subsets: ["latin"],
// });

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
    <html lang="en" className="light" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var theme = localStorage.getItem('theme') || 'light';
                  var actualTheme = theme;
                  
                  if (theme === 'system') {
                    actualTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
                  }
                  
                  if (actualTheme !== 'light') {
                    document.documentElement.classList.remove('light');
                    document.documentElement.classList.add(actualTheme);
                  }
                } catch (e) {
                  // Fallback already set with className="light"
                }
              })();
            `,
          }}
        />
      </head>
      <body
        className="antialiased"
      >
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
