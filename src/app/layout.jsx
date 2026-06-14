import { Geist } from 'next/font/google'
import Header from '@/components/Header'
import { BRAND } from '@/lib/constants'
import './globals.css'

const geist = Geist({ subsets: ['latin'], variable: '--font-geist' })

export const metadata = {
  title: BRAND.name,
  description: BRAND.description,
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${geist.variable} font-sans antialiased`}>
        <Header />
        {children}
      </body>
    </html>
  )
}
