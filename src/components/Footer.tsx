"use client";

import Link from "next/link";
import { Github, Radio } from "lucide-react";

export default function Footer() {
  return (
    <footer className="bg-card border-t py-4 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex flex-col space-y-1">
            <div className="flex items-center space-x-2">
              <Radio className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Nextlog</span>
            </div>
            <span className="text-xs text-muted-foreground">
              © {new Date().getFullYear()} Amateur Radio Logging Software
            </span>
          </div>

          <div className="flex items-center space-x-6">
            <Link
              href="https://github.com/patrickrb/nextlog"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-muted-foreground hover:text-primary flex items-center"
            >
              <Github className="h-4 w-4 mr-1" />
              <span>GitHub Repository</span>
            </Link>

            <Link
              href="https://ks3ckc.radio"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-muted-foreground hover:text-primary flex items-center"
            >
              <Radio className="h-4 w-4 mr-1" />
              <span>ks3ckc.radio</span>
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
