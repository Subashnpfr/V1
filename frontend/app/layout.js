import './globals.css';
import Providers from './providers';

export const metadata = {
  title: 'V1 Captions — Offline AI Subtitle Studio',
  description: 'Generate, edit, style, translate, and burn captions locally. Built for YouTube, Shorts, Reels, and Nepali creators.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Hind:wght@400;500;600;700&family=Inter:wght@400;500;600;700;800&family=Kalam:wght@400;700&family=Lato:wght@400;700&family=Montserrat:wght@400;600;700&family=Mukta:wght@400;500;600;700;800&family=Noto+Sans+Devanagari:wght@400;500;600;700;900&family=Nunito:wght@400;600;700&family=Open+Sans:wght@400;600;700&family=Playfair+Display:wght@400;700&family=Poppins:wght@400;600;700&family=Roboto:wght@400;500;700&family=Teko:wght@500;600;700&display=swap" rel="stylesheet" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var saved = localStorage.getItem('theme');
                  document.documentElement.setAttribute('data-theme', saved === 'light' ? 'light' : 'dark');
                } catch (e) {
                  document.documentElement.setAttribute('data-theme', 'dark');
                }
              })();
            `
          }}
        />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}