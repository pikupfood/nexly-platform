import Link from 'next/link'
import { PLANS } from '@/lib/supabase'

export default function LandingPage() {
  return (
    <main style={{ minHeight:'100vh', background:'#fafbff', fontFamily:'"DM Sans","Helvetica Neue",sans-serif' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;0,9..40,800;1,9..40,400&display=swap');
        * { box-sizing:border-box; }
        .nav-link { font-size:14px; color:#64748b; text-decoration:none; font-weight:500; transition:color 0.15s; }
        .nav-link:hover { color:#0f172a; }
        .plan-card { background:white; border:1px solid #e2e8f0; border-radius:16px; padding:28px 24px; transition:all 0.2s; cursor:pointer; }
        .plan-card:hover { box-shadow:0 8px 32px rgba(37,99,235,0.1); border-color:#bfdbfe; transform:translateY(-2px); }
        .plan-card.featured { border:2px solid #2563eb; background:linear-gradient(135deg,#eff6ff,#f0f9ff); }
        .badge { display:inline-flex; align-items:center; gap:6px; background:#f0f9ff; border:1px solid #bae6fd; border-radius:20px; padding:4px 12px; font-size:12px; color:#0284c7; font-weight:500; }
        .feature-item { display:flex; align-items:center; gap:8px; font-size:14px; color:#475569; }
        .feature-item::before { content:'✓'; color:#059669; font-weight:700; }
        .stat-box { background:white; border:1px solid #e2e8f0; border-radius:12px; padding:20px 24px; text-align:center; }
        .module-chip { background:white; border:1px solid #e2e8f0; border-radius:10px; padding:12px 16px; display:flex; align-items:center; gap:10px; font-size:13px; color:#374151; transition:all 0.15s; }
        .module-chip:hover { border-color:#2563eb; background:#eff6ff; color:#1d4ed8; }
        .testimonial { background:white; border:1px solid #e2e8f0; border-radius:14px; padding:24px; }
      `}</style>

      {/* ── NAVBAR ────────────────────────────────────────────────── */}
      <nav style={{ position:'sticky', top:0, zIndex:50, background:'rgba(250,251,255,0.9)', backdropFilter:'blur(12px)', borderBottom:'1px solid #e2e8f0', padding:'0 48px', height:'64px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
          <div style={{ width:'34px', height:'34px', background:'linear-gradient(135deg,#7c3aed,#2563eb)', borderRadius:'9px', display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontSize:'16px', fontWeight:'800' }}>N</div>
          <span style={{ fontWeight:'700', fontSize:'18px', color:'#0f172a', letterSpacing:'-0.01em' }}>Nexly Hub</span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:'28px' }}>
          <a href="#features" className="nav-link">Fonctionnalités</a>
          <a href="#modules" className="nav-link">Modules</a>
          <a href="#pricing" className="nav-link">Tarifs</a>
          <Link href="/auth/login" className="nav-link">Connexion</Link>
          <Link href="/auth/register" style={{ padding:'9px 20px', background:'linear-gradient(135deg,#7c3aed,#2563eb)', color:'white', borderRadius:'9px', textDecoration:'none', fontSize:'13px', fontWeight:'600', boxShadow:'0 2px 8px rgba(37,99,235,0.3)' }}>
            Essai gratuit 14j →
          </Link>
        </div>
      </nav>

      {/* ── HERO ──────────────────────────────────────────────────── */}
      <section style={{ padding:'100px 48px 80px', textAlign:'center', maxWidth:'860px', margin:'0 auto' }}>
        <div className="badge" style={{ marginBottom:'24px' }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="#0284c7"><circle cx="12" cy="12" r="10"/></svg>
          Nouveau — Module POS restaurant avec KDS intégré
        </div>
        <h1 style={{ fontSize:'clamp(38px,6vw,68px)', fontWeight:'800', lineHeight:1.05, letterSpacing:'-0.04em', color:'#0f172a', margin:'0 0 22px' }}>
          Gérez tout votre<br/>
          <span style={{ background:'linear-gradient(135deg,#7c3aed,#2563eb)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text' }}>établissement</span><br/>
          en un seul endroit
        </h1>
        <p style={{ fontSize:'18px', color:'#64748b', lineHeight:1.7, margin:'0 auto 36px', maxWidth:'520px', fontWeight:'400' }}>
          Hôtel · Restaurant · Spa · Padel — une plateforme unifiée pour piloter votre activité, de la réservation en ligne au rapport financier.
        </p>
        <div style={{ display:'flex', gap:'12px', justifyContent:'center', flexWrap:'wrap' }}>
          <Link href="/auth/register" style={{ padding:'14px 32px', background:'linear-gradient(135deg,#7c3aed,#2563eb)', color:'white', borderRadius:'11px', textDecoration:'none', fontSize:'15px', fontWeight:'700', boxShadow:'0 4px 16px rgba(37,99,235,0.35)', letterSpacing:'-0.01em' }}>
            Commencer gratuitement →
          </Link>
          <a href="#features" style={{ padding:'14px 24px', background:'white', color:'#374151', border:'1px solid #e2e8f0', borderRadius:'11px', textDecoration:'none', fontSize:'15px', fontWeight:'600' }}>
            Voir la démo
          </a>
        </div>
        <div style={{ marginTop:'20px', fontSize:'12px', color:'#94a3b8' }}>Sans carte bancaire · Annulation à tout moment</div>
      </section>

      {/* ── STATS ─────────────────────────────────────────────────── */}
      <section style={{ padding:'0 48px 80px', maxWidth:'900px', margin:'0 auto' }}>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'14px' }}>
          {[
            { value:'2 400+', label:'Établissements actifs' },
            { value:'98%',    label:'Satisfaction client' },
            { value:'5 min',  label:'Pour commencer' },
            { value:'24/7',   label:'Support & IA' },
          ].map(s=>(
            <div key={s.label} className="stat-box">
              <div style={{ fontSize:'28px', fontWeight:'800', color:'#0f172a', letterSpacing:'-0.02em' }}>{s.value}</div>
              <div style={{ fontSize:'12px', color:'#94a3b8', marginTop:'4px', fontWeight:'500' }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── MODULES ───────────────────────────────────────────────── */}
      <section id="modules" style={{ padding:'80px 48px', background:'#f8f9fc', borderTop:'1px solid #e2e8f0', borderBottom:'1px solid #e2e8f0' }}>
        <div style={{ maxWidth:'960px', margin:'0 auto' }}>
          <div style={{ textAlign:'center', marginBottom:'48px' }}>
            <h2 style={{ fontSize:'34px', fontWeight:'800', color:'#0f172a', letterSpacing:'-0.03em', margin:'0 0 12px' }}>Tous vos modules, une seule app</h2>
            <p style={{ fontSize:'16px', color:'#64748b', margin:0 }}>Activez uniquement ce dont vous avez besoin</p>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:'12px' }}>
            {[
              { icon:'🏨', name:'Hôtel',          desc:'Chambres, réservations, check-in/out, planning', color:'#2563eb' },
              { icon:'🍽️', name:'Restaurant',     desc:'POS professionnel, KDS, ordres, mesas',          color:'#059669' },
              { icon:'💆', name:'Spa & Bien-être', desc:'Agenda, services, staff, paiements',             color:'#7c3aed' },
              { icon:'🎾', name:'Padel',           desc:'Terrains, réservations, disponibilité live',     color:'#d97706' },
              { icon:'👥', name:'Clients',         desc:'Fiche client, historique 360°, fidélité',        color:'#db2777' },
              { icon:'🧾', name:'Facturation',     desc:'Factures auto, export CSV, TVA',                 color:'#dc2626' },
              { icon:'📊', name:'Rapports',        desc:'Revenue, KPIs, graphiques par module',           color:'#7c3aed' },
              { icon:'👔', name:'Équipe',          desc:'Comptes staff, rôles, modules accessibles',      color:'#0891b2' },
            ].map(m=>(
              <div key={m.name} className="module-chip" style={{ flexDirection:'column', alignItems:'flex-start', padding:'16px', gap:'8px' }}>
                <div style={{ fontSize:'24px' }}>{m.icon}</div>
                <div style={{ fontSize:'14px', fontWeight:'700', color:'#0f172a' }}>{m.name}</div>
                <div style={{ fontSize:'11px', color:'#94a3b8', lineHeight:1.4 }}>{m.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ───────────────────────────────────────────────── */}
      <section id="pricing" style={{ padding:'80px 48px' }}>
        <div style={{ maxWidth:'1000px', margin:'0 auto' }}>
          <div style={{ textAlign:'center', marginBottom:'48px' }}>
            <h2 style={{ fontSize:'34px', fontWeight:'800', color:'#0f172a', letterSpacing:'-0.03em', margin:'0 0 12px' }}>Tarifs simples et transparents</h2>
            <p style={{ fontSize:'16px', color:'#64748b', margin:0 }}>Choisissez le plan adapté à votre établissement</p>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))', gap:'16px' }}>
            {Object.values(PLANS || {
              hotel: { label:'Hôtel', price:49, yearlyPrice:470, icon:'🏨', modules:['hotel','clients','invoices','agenda','reports'] },
              restaurant: { label:'Restaurant', price:39, yearlyPrice:374, icon:'🍽️', modules:['restaurant','pos','clients','invoices','reports'] },
              spa: { label:'Spa', price:39, yearlyPrice:374, icon:'💆', modules:['spa','clients','invoices','reports'] },
              padel: { label:'Padel', price:29, yearlyPrice:278, icon:'🎾', modules:['padel','clients','invoices','reports'] },
              all: { label:'All Inclusive', price:129, yearlyPrice:1238, icon:'⭐', modules:['hotel','restaurant','spa','padel','clients','invoices','agenda','reports'] },
            } as any).map((plan:any) => (
              <div key={plan.label} className={`plan-card ${plan.label==='All Inclusive'?'featured':''}`}>
                <div style={{ fontSize:'28px', marginBottom:'12px' }}>{plan.icon}</div>
                <div style={{ fontSize:'16px', fontWeight:'700', color:'#0f172a', marginBottom:'4px' }}>{plan.label}</div>
                <div style={{ marginBottom:'16px' }}>
                  <span style={{ fontSize:'30px', fontWeight:'800', color:'#0f172a' }}>€{plan.price}</span>
                  <span style={{ fontSize:'12px', color:'#94a3b8' }}>/mois</span>
                </div>
                {plan.label==='All Inclusive' && <div style={{ background:'#2563eb', color:'white', borderRadius:'6px', padding:'3px 8px', fontSize:'10px', fontWeight:'700', marginBottom:'12px', display:'inline-block' }}>⭐ MEILLEUR CHOIX</div>}
                <div style={{ fontSize:'11px', color:'#94a3b8', marginBottom:'16px' }}>€{plan.yearlyPrice}/an · économisez {Math.round(100-(plan.yearlyPrice/(plan.price*12)*100))}%</div>
                <div style={{ display:'flex', flexDirection:'column', gap:'5px', marginBottom:'20px' }}>
                  {(plan.modules||[]).slice(0,5).map((m:string)=>(
                    <div key={m} style={{ fontSize:'12px', color:'#475569', display:'flex', alignItems:'center', gap:'5px' }}>
                      <span style={{ color:'#059669', fontWeight:'700' }}>✓</span> {m.charAt(0).toUpperCase()+m.slice(1)}
                    </div>
                  ))}
                </div>
                <Link href="/auth/register" style={{ display:'block', padding:'10px', background:plan.label==='All Inclusive'?'linear-gradient(135deg,#7c3aed,#2563eb)':'#f8f9fc', color:plan.label==='All Inclusive'?'white':'#374151', border:`1px solid ${plan.label==='All Inclusive'?'transparent':'#e2e8f0'}`, borderRadius:'8px', textDecoration:'none', fontSize:'13px', fontWeight:'600', textAlign:'center', transition:'all 0.15s' }}>
                  Essai gratuit 14j
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FOOTER ────────────────────────────────────────────────── */}
      <footer style={{ borderTop:'1px solid #e2e8f0', padding:'32px 48px', display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:'12px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
          <div style={{ width:'24px', height:'24px', background:'linear-gradient(135deg,#7c3aed,#2563eb)', borderRadius:'6px', display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontSize:'11px', fontWeight:'800' }}>N</div>
          <span style={{ fontSize:'13px', color:'#94a3b8' }}>© 2026 Nexly Hub — Tous droits réservés</span>
        </div>
        <div style={{ display:'flex', gap:'20px' }}>
          {['Confidentialité','CGU','Support'].map(l=>(
            <a key={l} href="#" style={{ fontSize:'12px', color:'#94a3b8', textDecoration:'none' }}>{l}</a>
          ))}
        </div>
      </footer>
    </main>
  )
}
