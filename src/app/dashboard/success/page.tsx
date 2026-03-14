'use client'
import { useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

function SuccessContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const success = searchParams.get('success')

  useEffect(() => {
    if (success) {
      // Redirect to dashboard after 3 seconds
      setTimeout(() => router.replace('/dashboard'), 3000)
    }
  }, [success])

  if (!success) { router.replace('/dashboard'); return null }

  return (
    <main style={{ minHeight:'100vh', background:'#fafaf9', display:'flex', alignItems:'center', justifyContent:'center', padding:'24px' }}>
      <div className="anim" style={{ textAlign:'center', maxWidth:'420px' }}>
        <div style={{ width:'64px', height:'64px', background:'#f0fdf4', border:'2px solid #bbf7d0', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'28px', margin:'0 auto 24px' }}>🎉</div>
        <h1 style={{ fontSize:'24px', fontWeight:'700', margin:'0 0 10px', letterSpacing:'-0.02em' }}>Abonnement activé !</h1>
        <p style={{ color:'#6b6760', fontSize:'14px', lineHeight:1.6, marginBottom:'28px' }}>
          Bienvenue sur Nexly Hub. Votre compte est maintenant actif.<br/>
          Vous allez être redirigé vers votre tableau de bord...
        </p>
        <Link href="/dashboard" className="btn btn-primary" style={{ padding:'12px 28px', fontSize:'14px' }}>
          Accéder à mon dashboard →
        </Link>
      </div>
    </main>
  )
}

export default function DashboardRootPage() {
  return <Suspense><SuccessContent /></Suspense>
}
