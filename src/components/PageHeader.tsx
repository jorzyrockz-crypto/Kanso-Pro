import { ArrowLeft, ArrowRight, ChevronRight, Plus, SearchX } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'
import { KansoMark } from './AppHeader'

export function PageHeader({ title, description, action, breadcrumb }: {
  title: string
  description: string
  action?: ReactNode
  breadcrumb?: string
}) {
  return <header className="page-header">
    <div className="page-breadcrumb"><Link to="/">My workspace</Link><ChevronRight size={12} /><span>{breadcrumb ?? title}</span></div>
    <div className="page-heading-row"><div><h1 id="page-title">{title}</h1><p>{description}</p></div>{action}</div>
  </header>
}

export function PageCreateButton({ label, onClick }: { label: string; onClick: () => void }) {
  return <button className="button button-page-create" onClick={onClick}><Plus size={15} />{label}</button>
}

export function NotFoundPage({ card = false, backTo = '/' }: { card?: boolean; backTo?: string }) {
  return <main id="main-content" tabIndex={-1} className="not-found-page" aria-labelledby="page-title">
    <span className="not-found-icon"><SearchX size={30} /></span>
    <span className="eyebrow">{card ? 'A missing piece of the journey' : 'A little off the path'}</span>
    <h1 id="page-title">{card ? 'We couldn’t find that card.' : 'This page isn’t here.'}</h1>
    <p>{card ? 'It may have been created in another browser. Your cards are saved on this device, so let’s head back to your workspace.' : 'The link may have changed, but your workspace is right where you left it.'}</p>
    <Link className="button button-dark" to={backTo}><ArrowLeft size={14} />{card ? 'Back to workspace' : 'Back to timeline'}</Link>
    {card && <Link className="text-button" to="/">Go to timeline<ArrowRight size={12} /></Link>}
  </main>
}

export function AppFooter() {
  return <footer className="app-footer"><Link to="/" className="footer-brand"><KansoMark size={16} /><span>Kanso Pro</span></Link><span>A little structure. A lot of possibility.</span></footer>
}
