import type { Metadata } from 'next'
import { AppSignIn } from '@/components/AppSignIn'
import { PageHead } from '@/components/Shell'

export const metadata: Metadata = {
  title: 'Sign in to X Orbit',
  robots: { index: false, follow: false },
}

export default function Page() {
  return (
    <>
      <PageHead n="★" label="ACCOUNT" title="SIGN IN" />
      <div className="container" style={{ marginTop: 40, marginBottom: 80 }}>
        <AppSignIn />
      </div>
    </>
  )
}
