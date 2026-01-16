import { Inter } from 'next/font/google'
import Script from 'next/script'
import { GoogleAnalytics } from '@next/third-parties/google'
import type { Metadata, Viewport } from "next";
import "./globals.css";
import { CookieConsentBanner } from "@/components/cookie-consent"
import { ThemeProvider } from "@/components/theme-provider";
import { GA_MEASUREMENT_ID } from "@/lib/analytics"

const inter = Inter({ subsets: ["latin"] });

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#000000' }
  ],
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
};

// Get base path from environment (set by next.config.js)
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

export const metadata: Metadata = {
  title: "GIF.new",
  description: "Instantly capture and create personal response GIFs.",
  manifest: `${basePath}/site.webmanifest`,
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'GIF.new',
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    type: 'website',
    siteName: 'GIF.new',
    title: {
      default: 'GIF.new',
      template: '%s | GIF.new'
    },
    description: 'Instantly capture and create personal response GIFs.',
  },
  twitter: {
    card: 'summary',
    title: {
      default: 'GIF.new',
      template: '%s | GIF.new'
    },
    description: 'Instantly capture and create personal response GIFs.',
  },
  icons: {
    icon: [
      {
        media: '(prefers-color-scheme: light)',
        url: `${basePath}/favicon.ico`,
        sizes: 'any'
      },
      {
        media: '(prefers-color-scheme: dark)',
        url: `${basePath}/dark-favicon.ico`,
        sizes: 'any'
      },
      {
        media: '(prefers-color-scheme: light)',
        url: `${basePath}/favicon-16x16.png`,
        sizes: '16x16',
        type: 'image/png'
      },
      {
        media: '(prefers-color-scheme: dark)',
        url: `${basePath}/dark-favicon-16x16.png`,
        sizes: '16x16',
        type: 'image/png'
      },
      {
        media: '(prefers-color-scheme: light)',
        url: `${basePath}/favicon-32x32.png`,
        sizes: '32x32',
        type: 'image/png'
      },
      {
        media: '(prefers-color-scheme: dark)',
        url: `${basePath}/dark-favicon-32x32.png`,
        sizes: '32x32',
        type: 'image/png'
      },
      {
        media: '(prefers-color-scheme: light)',
        url: `${basePath}/favicon.svg`,
        type: 'image/svg+xml',
      },
      {
        media: '(prefers-color-scheme: dark)',
        url: `${basePath}/favicon-dark.svg`,
        type: 'image/svg+xml',
      }
    ],
    apple: [
      {
        media: '(prefers-color-scheme: light)',
        url: `${basePath}/apple-touch-icon.png`,
      },
      {
        media: '(prefers-color-scheme: dark)',
        url: `${basePath}/dark-apple-touch-icon.png`,
      }
    ],
    other: [
      {
        rel: 'mask-icon',
        url: `${basePath}/favicon.svg`,
      }
    ]
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>): React.ReactElement {
  // Inject dynamic font paths for CSS (since CSS can't use env vars directly)
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
  
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Inject dynamic font paths for CSS @font-face */}
        <style
          dangerouslySetInnerHTML={{
            __html: `
              @font-face {
                font-family: 'Impact';
                src: url('${basePath}/fonts/impact.ttf') format('truetype');
                font-weight: normal;
                font-style: normal;
                font-display: swap;
              }
              @font-face {
                font-family: 'Arial';
                src: url('${basePath}/fonts/arial.ttf') format('truetype');
                font-weight: normal;
                font-style: normal;
                font-display: swap;
              }
              @font-face {
                font-family: 'Helvetica';
                src: url('${basePath}/fonts/helvetica.ttf') format('truetype');
                font-weight: normal;
                font-style: normal;
                font-display: swap;
              }
              @font-face {
                font-family: 'Times';
                src: url('${basePath}/fonts/times.ttf') format('truetype');
                font-weight: normal;
                font-style: normal;
                font-display: swap;
              }
              @font-face {
                font-family: 'Courier';
                src: url('${basePath}/fonts/courier.ttf') format('truetype');
                font-weight: normal;
                font-style: normal;
                font-display: swap;
              }
              @font-face {
                font-family: 'Anton';
                src: url('${basePath}/fonts/anton.ttf') format('truetype');
                font-weight: normal;
                font-style: normal;
                font-display: swap;
              }
            `,
          }}
        />
        <Script
          id="gtag-init"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${GA_MEASUREMENT_ID}', {
                page_path: window.location.pathname,
                user_properties: {
                  theme_preference: localStorage.getItem('theme') || 'system',
                }
              });
            `,
          }}
        />
      </head>
      <body className={inter.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <GoogleAnalytics gaId={GA_MEASUREMENT_ID} />
          <CookieConsentBanner />
        </ThemeProvider>
      </body>
    </html>
  );
}
