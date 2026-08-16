import './globals.css';
import Providers from './providers';

export const metadata = {
  title: 'V1 Captions — Local AI Subtitle Studio',
  description: 'Generate, edit, style, and burn captions locally. Optional Google Translate requires internet.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
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