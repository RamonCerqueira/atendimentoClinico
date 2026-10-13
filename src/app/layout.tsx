import type { Metadata, Viewport } from 'next'
import './styles.css'
import './patient-details.css'
import './reports.css'
import './premium.css'

export const metadata: Metadata = {
  title: 'Atendimento Clínico · Cuida Amor',
  description: 'Agenda de visitas e evolução clínica Cuida Amor',
  manifest: '/manifest.json',
  icons: {
    icon: '/logo01.svg',
    shortcut: '/logo01.svg',
    apple: '/logo01.svg',
  },
}
export const viewport: Viewport = { themeColor: '#a65376' }

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}</body></html>
}
