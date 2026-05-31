import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "AI Resume Analyzer — ATS Score Checker",
  description:
    "Upload your resume and get an instant ATS score, find critical issues, and get exact fixes to land more interviews.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className} style={{ background: "#0a0a0a" }}>
        {children}
      </body>
    </html>
  );
}
