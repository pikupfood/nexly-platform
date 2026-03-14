import type { Metadata } from 'next'
import SupportChat from '@/components/SupportChat'

export const metadata: Metadata = {
  title: 'Nexly Hub — Plateforme de gestion hôtelière',
  description: 'La solution complète pour gérer votre hôtel, restaurant, spa et padel',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Cal+Sans&display=swap" rel="stylesheet" />
      </head>
      <body style={{ margin:0, padding:0, fontFamily:"'Inter', system-ui, sans-serif", background:'#f8f7f5', color:'#1a1a1a' }}>
        <style>{`
          *, *::before, *::after { box-sizing: border-box; }
          a { color: inherit; text-decoration: none; }
          ::selection { background: #1a1a1a20; }
          input, textarea, select, button { font-family: inherit; }
          input::placeholder, textarea::placeholder { color: #b0aca6; }
          input:focus, textarea:focus, select:focus { outline: none; border-color: #1a1a1a !important; }

          .btn { display:inline-flex; align-items:center; justify-content:center; gap:8px; padding:11px 20px; border-radius:8px; font-size:14px; font-weight:500; cursor:pointer; border:none; transition:all 0.15s; }
          .btn-primary { background:#1a1a1a; color:white; }
          .btn-primary:hover:not(:disabled) { background:#333; transform:translateY(-1px); }
          .btn-primary:disabled { background:#d0d0d0; color:#888; cursor:not-allowed; }
          .btn-secondary { background:white; color:#1a1a1a; border:1px solid #e0ddd8 !important; }
          .btn-secondary:hover { border-color:#1a1a1a !important; }
          .btn-danger { background:#fee2e2; color:#dc2626; }
          .btn-danger:hover { background:#fecaca; }

          .card { background:white; border:1px solid #e8e6e1; border-radius:12px; padding:24px; }
          .input { width:100%; padding:10px 14px; background:white; border:1px solid #d8d5d0; border-radius:8px; color:#1a1a1a; font-size:14px; transition:border-color 0.15s; }
          .label { display:block; font-size:12px; font-weight:500; color:#6b6760; margin-bottom:6px; }

          @keyframes fadeUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
          .anim { animation:fadeUp 0.4s ease both; }
          .anim-2 { animation:fadeUp 0.4s ease 0.06s both; }
          .anim-3 { animation:fadeUp 0.4s ease 0.12s both; }
          .anim-4 { animation:fadeUp 0.4s ease 0.18s both; }
          .anim-5 { animation:fadeUp 0.4s ease 0.24s both; }

          @media(max-width:768px){
            .hide-mobile { display:none !important; }
            .mobile-full { width:100% !important; }
          }
        `}</style>
        {children}
        <SupportChat />
      </body>
    </html>
  )
}
