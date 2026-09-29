'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import styles from './ecosystem.module.css'

type InstallEvent = Event & { prompt(): Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }
function subscribeDisplay(callback: () => void) {
  const query = window.matchMedia('(display-mode: standalone)')
  query.addEventListener('change', callback)
  return () => query.removeEventListener('change', callback)
}
function standalone() { return window.matchMedia('(display-mode: standalone)').matches }
function serverSnapshot() { return false }

export default function InstallApp() {
  const [prompt, setPrompt] = useState<InstallEvent | null>(null)
  const [message, setMessage] = useState('')
  const [pending, setPending] = useState(false)
  const installed = useSyncExternalStore(subscribeDisplay, standalone, serverSnapshot)
  useEffect(() => {
    function onPrompt(event: Event) { event.preventDefault(); setPrompt(event as InstallEvent) }
    function onInstalled() { setPrompt(null); setMessage('Orçaly adicionado ao seu dispositivo.') }
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => { window.removeEventListener('beforeinstallprompt', onPrompt); window.removeEventListener('appinstalled', onInstalled) }
  }, [])
  async function install() {
    if (!prompt || pending) return
    setPending(true)
    try { await prompt.prompt(); const choice = await prompt.userChoice; setMessage(choice.outcome === 'accepted' ? 'Pedido de instalação aceito pelo navegador.' : 'Você pode instalar em outro momento.'); setPrompt(null) }
    catch { setMessage('Não foi possível abrir a instalação. Use o menu do navegador quando disponível.') }
    finally { setPending(false) }
  }
  return <section className={styles.panel}><h2>Orçaly perto de você</h2><p>{installed ? 'Você está usando o Orçaly no modo aplicativo.' : 'Acesse o App Hub pela tela inicial. A instalação depende do navegador e do dispositivo; os produtos mantêm seus próprios requisitos de acesso.'}</p>{prompt && !installed ? <button className={styles.primaryButton} onClick={install} disabled={pending} type="button">{pending ? 'Abrindo instalação…' : 'Instalar Orçaly'}</button> : !installed && <p>Se disponível, use “Instalar aplicativo” no menu do navegador. No Safari do iPhone, procure “Adicionar à Tela de Início” no menu de compartilhamento.</p>}{message && <p role="status">{message}</p>}</section>
}
