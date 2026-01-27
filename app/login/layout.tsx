// Force dynamic rendering to avoid prerender issues with Supabase client
export const dynamic = 'force-dynamic'

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
