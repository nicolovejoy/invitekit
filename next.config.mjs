/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_BUILD_TIME: new Date().toLocaleString('en-US', {
      timeZone: 'America/Los_Angeles',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false,
    }).replace(',', ''),
  },
  async rewrites() {
    return [
      {
        source: '/__/auth/:path*',
        destination: 'https://free-vite.firebaseapp.com/__/auth/:path*',
      },
    ]
  },
}

export default nextConfig
