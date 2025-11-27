// apps/proselenos-app/src/app/layout.tsx

import * as React from 'react';
import { EnvProvider } from '@/context/EnvContext';
import Providers from '@/components/Providers';

import '../styles/globals.css';

const title = 'Proselenos — Read and Write';
const url = 'https://proselenos.com';
const description =
  'Proselenos is an ebook reader for EPUB files with text-to-speech read-aloud, highlighting, notes, and access to a bookstore. ' +
  'Authors and Writers offers AI chat, a Writing Assistant for brainstorming, outlining, world-building, and chapter writing, AI editing tools, and an editor with read-aloud. ' +
  'The Publishing Assistant converts a manuscript text file into HTML, EPUB, and PDF, with options to add the EPUB to your ereader library or list it in the bookstore.';

export const metadata = {
  title,
  description,
  generator: 'Next.js',
  keywords: ['epub', 'ebook', 'reader', 'writing', 'publishing', 'AI'],
  authors: [
    {
      name: 'proselenos',
      url: 'https://github.com/cleesmith/proselenos_readers_writers',
    },
  ],
  icons: [
    { rel: 'apple-touch-icon', url: '/icon_180x180.png' },
    { rel: 'icon', url: '/icon.png' },
  ],
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang='en'>
      <head>
        <title>{title}</title>
        <meta
          name='viewport'
          content='minimum-scale=1, initial-scale=1, width=device-width, shrink-to-fit=no, user-scalable=no, viewport-fit=cover'
        />
        <meta name='mobile-web-app-capable' content='yes' />
        <meta name='apple-mobile-web-app-capable' content='yes' />
        <meta name='apple-mobile-web-app-status-bar-style' content='default' />
        <meta name='apple-mobile-web-app-title' content='Proselenos' />
        <link rel='apple-touch-icon' sizes='180x180' href='/icon_180x180.png' />
        <link rel='icon' href='/favicon.ico' />
        <meta name='description' content={description} />
        <meta property='og:url' content={url} />
        <meta property='og:type' content='website' />
        <meta property='og:title' content={title} />
        <meta property='og:description' content={description} />
      </head>
      <body>
        <EnvProvider>
          <Providers>{children}</Providers>
        </EnvProvider>
      </body>
    </html>
  );
}
