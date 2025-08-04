import type { Metadata } from "next";
import "../globals.css";
import { ThemeProvider } from "@/contexts/ThemeContext";

export const metadata: Metadata = {
  title: "Nextlog Navbar Demo",
  description: "Demo of improved navbar layout",
};

export default function DemoLayout({
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
      <body className="antialiased font-sans">
        <ThemeProvider>
          {/* Bypass InstallationChecker for demo */}
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}