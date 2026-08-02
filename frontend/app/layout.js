import './globals.css'

export const metadata = {
  title: 'V1 Auto Captions',
  description: 'Generate subtitles from videos',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}