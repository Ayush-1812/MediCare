import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import AppContextProvider from "@/context/AppContext";
import AppChrome from "@/components/AppChrome";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Medicare - Book Trusted Doctors",
  description: "Book appointments with top-rated doctors across various specialties.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <AppContextProvider>
          <ToastContainer />
          <AppChrome>{children}</AppChrome>
        </AppContextProvider>
      </body>
    </html>
  );
}
