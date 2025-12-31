// apps/proselenos-app/src/pages/_app.tsx

import Head from 'next/head';
import { AppProps } from 'next/app';
import { EnvProvider } from '@/context/EnvContext';
import Providers from '@/components/Providers';

import '../styles/globals.css';

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <>
      <Head>
        <meta
          name='viewport'
          content='minimum-scale=1, initial-scale=1, width=device-width, shrink-to-fit=no, user-scalable=no, viewport-fit=cover'
        />
        <meta name='application-name' content='EverythingEbooks' />
        <meta name='apple-mobile-web-app-capable' content='yes' />
        <meta name='apple-mobile-web-app-status-bar-style' content='default' />
        <meta name='apple-mobile-web-app-title' content='EverythingEbooks' />
        <meta
          name='description'
          content='EverythingEbooks is an open-source eBook reader and an AI assistant for editing, writing, and publishing manuscripts.'
        />
        <meta name='format-detection' content='telephone=no' />
        <meta name='mobile-web-app-capable' content='yes' />
        <meta name='theme-color' content='white' />
      </Head>
      <EnvProvider>
        <Providers>
          <Component {...pageProps} />
        </Providers>
      </EnvProvider>
    </>
  );
}

export default MyApp;
