import { Geist } from 'next/font/google'
import Header from '@/components/Header'
import './globals.css'

const geist = Geist({ subsets: ['latin'], variable: '--font-geist' })

export const metadata = {
  title: 'Freevite',
  description: 'Private event invitations',
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
