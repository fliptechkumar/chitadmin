/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      // Public sign-up was removed: accounts are created by a Super Admin or,
      // within their branches, by a Chit Admin.
      { source: "/register", destination: "/login", permanent: false },
    ]
  },
}

export default nextConfig
