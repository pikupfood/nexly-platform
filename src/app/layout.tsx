import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Nexly Hub 2.0',
  description: 'Hotel · Spa · Padel · Ristorante',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <body>{children}</body>
    </html>
  )
}
