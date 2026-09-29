import Link from 'next/link'
import { products, ecosystemJourneys, getProduct } from '@/lib/ecosystem/products'
import ReferralBridge from '@/components/marketing/ReferralBridge'
import EcosystemHeader from './EcosystemHeader'
import ProductCard from './ProductCard'
import styles from './ecosystem.module.css'

export default function EcosystemHome() {
  return <div className={styles.shell}>
    <a className={styles.skipLink} href="#conteudo">Pular para o conteúdo</a>
    <ReferralBridge /><EcosystemHeader />
    <main id="conteudo">
      <section className={styles.hero} aria-labelledby="ecosystem-title">
        <div className={styles.heroCopy}><p className={styles.eyebrow}><span className={styles.liveDot} /> Um ecossistema. O seu próximo passo.</p>
          <h1 id="ecosystem-title">Um Orçaly.<br /><span>Várias possibilidades.</span></h1>
          <p className={styles.heroDescription}>Para o negócio que você está construindo.<br />Para o futuro que você está imaginando.<br />Encontre o seu lugar no Orçaly.</p>
          <div className={styles.actions}><Link className={styles.primaryButton} href="#produtos">Encontre seu produto <span aria-hidden="true">↗</span></Link><Link className={styles.textButton} href="/business">Conheça o Business <span aria-hidden="true">→</span></Link></div>
          <p className={styles.heroFootnote}>Produtos especializados. Uma identidade. Você no centro.</p>
        </div>
        <div className={styles.constellation} aria-label="O ecossistema conecta negócio, patrimônio, aprendizado e possibilidades">
          <div className={styles.orbit} aria-hidden="true" /><div className={styles.orbitInner} aria-hidden="true" />
          <div className={styles.orbitCenter}><span>O seu próximo</span><strong>possível.</strong><small>COMEÇA AQUI</small></div>
          {products.filter((product) => product.context !== 'bundle').map((product, index) => <Link key={product.id} href={product.href} className={`${styles.orbitProduct} ${styles[`orbit${index}`]}`}><span>{product.shortName}</span><small>{product.status === 'available' ? 'Explore agora ↗' : 'Conheça a proposta ↗'}</small></Link>)}
          <span className={styles.orbitCaption}>Diferentes caminhos. A mesma conexão.</span>
        </div>
      </section>
      <section className={styles.intentSection} aria-labelledby="intent-title"><div><p className={styles.eyebrow}>O começo é com você</p><h2 id="intent-title">O que você quer<br />fazer acontecer?</h2></div><div className={styles.intentGrid}>{products.map((product) => <Link href={product.href} key={product.id}>{product.intent}<span aria-hidden="true">↗</span></Link>)}</div></section>
      <section id="produtos" className={styles.section} aria-labelledby="products-title"><div className={styles.sectionHeading}><div><p className={styles.eyebrow}>Conheça o ecossistema</p><h2 id="products-title">Cada possibilidade,<br />um produto pensado para ela.</h2></div><p>Experiências com identidade própria, conectadas por uma conta Orçaly. Veja o que já está disponível e o que estamos construindo.</p></div><div className={styles.productGrid}>{products.filter((product) => product.context !== 'bundle').map((product) => <ProductCard key={product.id} product={product} />)}</div></section>
      <section className={styles.journeySection} aria-labelledby="journey-title"><p className={styles.eyebrow}>Caminhos que se encontram</p><h2 id="journey-title">Seu próximo passo<br />pode abrir outros caminhos.</h2><div className={styles.journeyGrid}>{ecosystemJourneys.map((journey) => <article key={journey.title}><h3>{journey.title}</h3><p>{journey.description}</p><div>{journey.products.map((id) => <Link key={id} href={getProduct(id)!.href}>{getProduct(id)!.shortName} <span aria-hidden="true">↗</span></Link>)}</div></article>)}</div><p className={styles.smallNote}>Jornadas ilustram a proposta do ecossistema. A disponibilidade de cada produto está indicada acima.</p></section>
      <section className={styles.oneSection} aria-labelledby="one-title"><div><p className={styles.eyebrow}>Orçaly One · em desenvolvimento</p><h2 id="one-title">Mais do seu mundo.<br />Em uma experiência.</h2><p>Uma proposta premium para aproximar seus produtos, benefícios e possibilidades. Com acesso e compartilhamento sempre sob seu controle.</p><Link className={styles.primaryButton} href="/produtos/one">Explore a proposta One <span aria-hidden="true">↗</span></Link></div><div className={styles.oneWord} aria-hidden="true">One<span>Uma conexão.<br />Novas possibilidades.</span></div></section>
      <section className={styles.trustSection} aria-labelledby="trust-title"><div><p className={styles.eyebrow}>Conexão com cuidado</p><h2 id="trust-title">Uma conta.<br />Cada contexto no seu lugar.</h2></div><div className={styles.trustGrid}><article><h3>Sua identidade Orçaly</h3><p>Acesse com a sua conta e proteja o login com autenticação em dois fatores.</p></article><article><h3>Compartilhamento consciente</h3><p>Dados pessoais e empresariais têm limites próprios. Conexões entre produtos exigem autorização.</p></article><article><h3>Permissões de verdade</h3><p>Cada acesso considera sua identidade, seu contexto e os recursos liberados para você.</p></article><article><h3>Perto de você</h3><p>Use pelo navegador no computador ou no celular. A instalação aparece quando estiver disponível para o produto e o dispositivo.</p></article></div></section>
      <section className={styles.finalCta}><p className={styles.eyebrow}>Seu próximo possível</p><h2>Por onde vamos começar?</h2><div className={styles.actions}><Link href="/cadastro" className={styles.primaryButton}>Começar com Business <span aria-hidden="true">↗</span></Link><Link href="/login?next=%2Fapps" className={styles.textButton}>Já tenho uma conta →</Link></div></section>
    </main>
    <footer className={styles.footer}><p>Orçaly · Um ecossistema de possibilidades.</p><nav aria-label="Rodapé"><Link href="/parceiros">Seja parceiro</Link><Link href="/suporte">Suporte</Link><a href="mailto:orcalybr@gmail.com">Fale com a gente</a></nav><small>Disponibilidade e condições variam por produto. Dados financeiros pessoais não são compartilhados automaticamente com empresas.</small></footer>
  </div>
}
