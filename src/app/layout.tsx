import type { Metadata } from 'next'
import './globals.css'
import SupportChat from '@/components/SupportChat'
import { I18nProvider } from '@/lib/i18n-context'

export const metadata: Metadata = {
  title: 'Nexly Hub 2.0',
  description: 'Hotel · Spa · Padel · Ristorante',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>
        <I18nProvider>
          {children}
          <SupportChat />
        </I18nProvider>
      </body>
    </html>
  )
}
