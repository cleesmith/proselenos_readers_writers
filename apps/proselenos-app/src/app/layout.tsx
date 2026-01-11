// apps/proselenos-app/src/app/layout.tsx

import * as React from 'react';
import { EnvProvider } from '@/context/EnvContext';
import Providers from '@/components/Providers';
import { ServiceWorkerRegistration } from '@/components/ServiceWorkerRegistration';

import '../styles/globals.css';

const title = 'EverythingEbooks — Read and Write';
const url = 'https://everythingebooks.org';
const description =
  'EverythingEbooks is an ebook reader for EPUB files with text-to-speech read-aloud, highlighting, notes, and access to a ebooks store. ' +
  'Authors and Writers offers AI chat, AI Writing for brainstorming, outlining, world-building, and chapter writing, AI editing tools, and an editor with read-aloud. ' +
  'Generate EPUBs.';

export const metadata = {
  title,
  description,
  generator: 'Next.js',
  keywords: ['epub', 'ebook', 'reader', 'writing', 'publishing', 'AI'],
  authors: [
    {
      name: 'EverythingEbooks',
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
        <link rel='apple-touch-icon' sizes='180x180' href='/icon_180x180.png' />
        <link rel='icon' href='/favicon.ico' />
        <link rel="preload" href="/fonts/EBGaramond-Regular.ttf" as="font" type="font/ttf" crossOrigin="anonymous" />
        <link rel="preload" href="/fonts/EBGaramond-Bold.ttf" as="font" type="font/ttf" crossOrigin="anonymous" />
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
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
