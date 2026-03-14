import Link from 'next/link'
import { PLANS } from '@/lib/supabase'

export default function LandingPage() {
  return (
    <main style={{ minHeight:'100vh', background:'#fafaf9' }}>
      <style>{`
        .plan-card { transition: transform 0.15s, box-shadow 0.15s; }
        .plan-card:hover { transform: translateY(-3px); box-shadow: 0 8px 32px rgba(0,0,0,0.08); }
        .plan-card.highlight { border-color: #1a1a1a !important; }
        .nav-link { font-size:14px; color:#6b6760; transition:color 0.15s; }
        .nav-link:hover { color:#1a1a1a; }
        .feature-item::before { content:'✓'; margin-right:8px; color:#059669; font-weight:600; }
      `}</style>

      {/* Nav */}
      <nav style={{ position:'sticky', top:0, zIndex:50, background:'rgba(250,250,249,0.9)', backdropFilter:'blur(8px)', borderBottom:'1px solid #e8e6e1', padding:'0 48px', height:'60px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
          <div style={{ width:'28px', height:'28px', background:'#1a1a1a', borderRadius:'6px', display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontSize:'14px', fontWeight:'700' }}>N</div>
          <span style={{ fontWeight:'600', fontSize:'16px', color:'#1a1a1a' }}>Nexly Hub</span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:'24px' }}>
          <a href="#pricing" className="nav-link">Tarifs</a>
          <a href="#features" className="nav-link">Fonctionnalités</a>
          <Link href="/auth/login" className="nav-link">Connexion</Link>
          <Link href="/auth/register" className="btn btn-primary" style={{ padding:'8px 18px', fontSize:'13px' }}>
            Commencer — 14j gratuits
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section style={{ padding:'96px 48px 80px', textAlign:'center', maxWidth:'800px', margin:'0 auto' }}>
        <div className="anim" style={{ display:'inline-flex', alignItems:'center', gap:'6px', background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:'20px', padding:'4px 12px', fontSize:'12px', color:'#059669', fontWeight:'500', marginBottom:'24px' }}>
          ✨ Essai gratuit 14 jours — sans carte bancaire
        </div>
        <h1 className="anim-2" style={{ fontSize:'clamp(36px,6vw,64px)', fontWeight:'700', lineHeight:1.1, letterSpacing:'-0.03em', color:'#1a1a1a', margin:'0 0 20px' }}>
          Gérez votre établissement<br />
          <span style={{ color:'#6b6760', fontWeight:'400' }}>en un seul endroit</span>
        </h1>
        <p className="anim-3" style={{ fontSize:'18px', color:'#6b6760', lineHeight:1.7, margin:'0 0 36px', maxWidth:'520px', marginLeft:'auto', marginRight:'auto' }}>
          Hôtel, restaurant, spa, padel — une plateforme complète avec portail de réservation intégré pour vos clients.
        </p>
        <div className="anim-4" style={{ display:'flex', gap:'12px', justifyContent:'center', flexWrap:'wrap' }}>
          <Link href="/auth/register" className="btn btn-primary" style={{ padding:'13px 28px', fontSize:'15px' }}>
            Créer mon compte gratuitement →
          </Link>
          <a href="#pricing" className="btn btn-secondary" style={{ padding:'13px 28px', fontSize:'15px' }}>
            Voir les tarifs
          </a>
        </div>
      </section>

      {/* Modules overview */}
      <section id="features" style={{ padding:'0 48px 96px', maxWidth:'1100px', margin:'0 auto' }}>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(220px,1fr))', gap:'16px' }}>
          {[
            { icon:'🏨', name:'Hôtel', items:['Chambres & types','Check-in / Check-out','Agenda & planning','Réservations client'] },
            { icon:'🍽️', name:'Restaurant', items:['Plan de salle','Commandes & menu','Réservations en ligne','Facturation auto'] },
            { icon:'💆', name:'Spa & Wellness', items:['Agenda des soins','Piscine & jacuzzi','Gestion du staff','Réservations client'] },
            { icon:'🎾', name:'Padel', items:['Gestion des terrains','Créneaux & planning','Réservations en ligne','Rapports & stats'] },
          ].map(m => (
            <div key={m.name} className="card" style={{ borderRadius:'14px' }}>
              <div style={{ fontSize:'28px', marginBottom:'10px' }}>{m.icon}</div>
              <div style={{ fontWeight:'600', fontSize:'15px', marginBottom:'12px' }}>{m.name}</div>
              {m.items.map(i => (
                <div key={i} className="feature-item" style={{ fontSize:'13px', color:'#6b6760', marginBottom:'6px', display:'flex', alignItems:'center' }}>{i}</div>
              ))}
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" style={{ padding:'80px 48px', background:'white', borderTop:'1px solid #e8e6e1', borderBottom:'1px solid #e8e6e1' }}>
        <div style={{ maxWidth:'1100px', margin:'0 auto' }}>
          <div style={{ textAlign:'center', marginBottom:'56px' }}>
            <h2 style={{ fontSize:'clamp(28px,4vw,42px)', fontWeight:'700', letterSpacing:'-0.02em', margin:'0 0 12px' }}>
              Tarifs simples et transparents
            </h2>
            <p style={{ color:'#6b6760', fontSize:'16px', margin:0 }}>Payez uniquement les modules dont vous avez besoin. Annulez à tout moment.</p>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(200px,1fr))', gap:'16px' }}>
            {PLANS.map(plan => (
              <div key={plan.slug} className={`card plan-card${plan.highlight ? ' highlight' : ''}`} style={{ borderRadius:'14px', position:'relative', padding:'28px 22px' }}>
                {plan.highlight && (
                  <div style={{ position:'absolute', top:'-12px', left:'50%', transform:'translateX(-50%)', background:'#1a1a1a', color:'white', fontSize:'11px', fontWeight:'600', padding:'4px 12px', borderRadius:'20px', whiteSpace:'nowrap' }}>
                    ⭐ Meilleure valeur
                  </div>
                )}
                <div style={{ fontSize:'28px', marginBottom:'10px' }}>{plan.icon}</div>
                <div style={{ fontWeight:'600', fontSize:'16px', marginBottom:'4px' }}>{plan.name}</div>
                <div style={{ fontSize:'12px', color:'#8a8680', marginBottom:'20px' }}>{plan.desc}</div>
                <div style={{ marginBottom:'4px' }}>
                  <span style={{ fontSize:'32px', fontWeight:'700', letterSpacing:'-0.02em' }}>€{plan.price_monthly}</span>
                  <span style={{ color:'#8a8680', fontSize:'13px' }}>/mois</span>
                </div>
                <div style={{ fontSize:'12px', color:'#059669', marginBottom:'20px', fontWeight:'500' }}>
                  ou €{plan.price_yearly}/an <span style={{ color:'#8a8680', fontWeight:'400' }}>(économisez {Math.round(100 - plan.price_yearly / (plan.price_monthly * 12) * 100)}%)</span>
                </div>
                {plan.features.map(f => (
                  <div key={f} className="feature-item" style={{ fontSize:'12px', color:'#6b6760', marginBottom:'6px', display:'flex', alignItems:'flex-start' }}>{f}</div>
                ))}
                <Link href={`/auth/register?plan=${plan.slug}`} className="btn btn-primary" style={{ width:'100%', marginTop:'20px', fontSize:'13px', background: plan.highlight ? '#1a1a1a' : 'transparent', color: plan.highlight ? 'white' : '#1a1a1a', border:`1px solid ${plan.highlight ? 'transparent' : '#d8d5d0'}` }}>
                  Essayer gratuitement
                </Link>
              </div>
            ))}
          </div>
          <p style={{ textAlign:'center', fontSize:'13px', color:'#9a9690', marginTop:'32px' }}>
            ✓ 14 jours d'essai gratuit · ✓ Sans carte bancaire · ✓ Annulation à tout moment
          </p>
        </div>
      </section>

      {/* CTA finale */}
      <section style={{ padding:'96px 48px', textAlign:'center', maxWidth:'600px', margin:'0 auto' }}>
        <h2 style={{ fontSize:'clamp(24px,4vw,40px)', fontWeight:'700', letterSpacing:'-0.02em', margin:'0 0 16px' }}>
          Prêt à simplifier votre gestion ?
        </h2>
        <p style={{ color:'#6b6760', fontSize:'16px', marginBottom:'32px' }}>
          Rejoignez des centaines d'établissements qui font confiance à Nexly Hub.
        </p>
        <Link href="/auth/register" className="btn btn-primary" style={{ padding:'14px 32px', fontSize:'15px' }}>
          Créer mon compte — c'est gratuit →
        </Link>
      </section>

      {/* Footer */}
      <footer style={{ borderTop:'1px solid #e8e6e1', padding:'24px 48px', display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:'12px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
          <div style={{ width:'22px', height:'22px', background:'#1a1a1a', borderRadius:'5px', display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontSize:'11px', fontWeight:'700' }}>N</div>
          <span style={{ fontWeight:'600', fontSize:'14px' }}>Nexly Hub</span>
        </div>
        <div style={{ fontSize:'12px', color:'#9a9690' }}>© {new Date().getFullYear()} Nexly Hub SAS — Tous droits réservés</div>
      </footer>
    </main>
  )
}
