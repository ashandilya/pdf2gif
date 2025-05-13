import type { Metadata } from 'next';
import { Roboto } from 'next/font/google';
import './globals.css';
import type { ReactNode } from 'react';
import { Toaster } from "@/components/ui/toaster"; // Import Toaster

const roboto = Roboto({
  weight: ['400', '500', '700'],
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'PDF2GIF',
  description: 'Convert PDF files to animated GIFs',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={roboto.className}>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
