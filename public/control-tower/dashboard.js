'use strict';
/**
 * Orçaly Control Tower — public read-only dashboard.
 * No access tokens, mutation endpoints, secrets, private task data or AI dispatch.
 */
(() => {
  const OWNER = 'viniciusaraujoop';
  const REPO = 'grafica-flash';
  const API = 'https://api.github.com/repos/' + OWNER + '/' + REPO + '/';
  const GH = 'https://github.com/' + OWNER + '/' + REPO;
  const INTERVAL_MS = 5 * 60 * 1000;
  const EXECUTORS = Object.freeze({
    codex: 'Orçaly Codex Agent Pilot - Founder Dispatch',
    claude: 'Orçaly Claude Architecture Review V1'
  });
  const ACTIVE = new Set(['in_progress','queued','pending','waiting','requested']);
  const RUNNING = new Set(['in_progress']);
  const $ = (id) => document.getElementById(id);
  const set = (id, value) => { const element = $(id); if (element) element.textContent = String(value); };
  const create = (tag, className, value) => {
    const n = document.createElement(tag);
    if (className) n.className = className;
    if (value !== undefined) n.textContent = String(value);
    return n;
  };
  const num = (value) => Number.isSafeInteger(value) && value > 0 ? value : null;
  const dateOf = (value) => {
    const date = new Date(value || '');
    return Number.isFinite(date.getTime()) ? date : null;
  };
  const time = (value) => {
    const date = dateOf(value);
    return date ? new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short'}).format(date) : 'sem horário';
  };
  const ago = (value) => {
    const date = dateOf(value);
    if (!date) return 'data indisponível';
    const delta = Math.max(0, Date.now() - date.getTime());
    const mins = Math.floor(delta / 60000);
    return mins < 1 ? 'agora' : mins < 60 ? 'há ' + mins + ' min' : mins < 1440 ? 'há ' + Math.floor(mins / 60) + ' h' : 'em ' + time(value);
  };
  const link = (url, label) => {
    const a = create('a',null,label);
    a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer';
    return a;
  };
  const item = (title,detail,state,stateClass,url) => {
    const row = create('div','item');
    const left = create('div');
    const heading = create('div','name');
    if (url) heading.append(link(url,title)); else heading.textContent = title;
    left.append(heading,create('div','detail',detail));
    row.append(left,create('span','state '+(stateClass||''),state));
    return row;
  };
  function clear(id) {
    const parent = $(id);
    parent.replaceChildren();
    return parent;
  }
  async function get(path) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    try {
      const r = await fetch(API + path,{
        method:'GET',mode:'cors',credentials:'omit',cache:'no-store',
        headers:{Accept:'application/vnd.github+json'},signal:controller.signal
      });
      if (!r.ok) throw new Error(r.status === 403 || r.status === 429
        ? 'Limite de consultas do GitHub atingido (' + r.status + ')'
        : 'GitHub HTTP ' + r.status);
      return await r.json();
    } finally { clearTimeout(timeout); }
  }
  function statusByRun(run) {
    if (!run) return {label:'SEM EVIDÊNCIA',cls:''};
    if (ACTIVE.has(run.status)) return {label:run.status === 'in_progress' ? 'EM EXECUÇÃO' : 'EM FILA',cls:'running'};
    if (run.conclusion === 'success') return {label:'PASS',cls:'success'};
    if (run.conclusion === 'failure') return {label:'FAIL',cls:'blocked'};
    return {label:String(run.conclusion||run.status||'DESCONHECIDO').toUpperCase(),cls:''};
  }
  function latestFor(pr,runs) {
    return runs.find(r => r.head_sha === pr.head?.sha && r.head_branch === pr.head?.ref &&
      r.name === 'Orçaly Platform Quality Gate' && r.event === 'pull_request');
  }
  const agentDefs = [
    {n:'01',name:'Wealth & R10',description:'Reconciliação da base e inteligência Wealth',url:GH+'/branches',kind:'external'},
    {n:'02',name:'Arquitetura',description:'Integrações e especificações arquiteturais',url:GH+'/pull/25',kind:'external'},
    {n:'03',name:'Quality / QA',description:'Revisão independente dos gates e regressões',url:GH+'/pull/33',kind:'review'},
    {n:'04',name:'Security',description:'Revisão independente de segurança',url:GH+'/pull/33',kind:'review'},
    {n:'05',name:'Frontend',description:'Experiência visual e implementação de interfaces',url:GH+'/pulls',kind:'external'},
    {n:'06',name:'Comercial',description:'Posicionamento, crescimento e preços sob aprovação',url:GH+'/issues',kind:'external'},
    {n:'07',name:'Product Strategy',description:'Blueprints de produto e fluxos',url:GH+'/issues',kind:'external'},
    {n:'08',name:'Visual Design',description:'Conceito visual do Hub e estados de acesso',issue:26,kind:'issue'},
    {n:'C',name:'Codex',description:'Programação assistida (piloto PR #22)',pr:22,kind:'codex'},
    {n:'CL',name:'Claude',description:'Revisão de arquitetura (piloto PR #25)',pr:25,kind:'claude'}
  ];
  function showAgents(issues,prs,agentRuns) {
    const container=clear('agents');
    for (const a of agentDefs) {
      const card=create('div','agent');
      const top=create('div','who');
      top.append(create('span','num',a.n),create('h3',null,a.name));
      const desc=create('div','what',a.description);
      const state=create('span','state','ATIVIDADE NÃO OBSERVÁVEL');
      let target=a.url;
      if (a.issue) {
        const issue=issues.find(x=>x.number===a.issue);
        target=GH+'/issues/'+a.issue;
        state.textContent=issue?.state==='open'?'MISSÃO CADASTRADA':'SEM EVIDÊNCIA';
      }
      if (a.kind==='review') state.textContent='REVISÃO NÃO CERTIFICADA';
      if (a.pr) {
        const p=prs.find(x=>x.number===a.pr);
        target=GH+'/pull/'+a.pr;
        state.textContent=p?.draft?'PILOTO EM RASCUNHO':'SEM EXECUÇÃO VERIFICADA';
        const runs=agentRuns.filter(r=>r.name===EXECUTORS[a.kind]);
        if (runs.some(r=>ACTIVE.has(r.status))) {
          state.textContent='EXECUÇÃO VERIFICADA';
          state.className='state running';
        }
      }
      card.append(top,desc,state);
      const aLink=link(target,'Ver evidência ↗');
      aLink.style.fontSize='12px';
      card.append(aLink);
      container.append(card);
    }
  }
  function showRuns(runs) {
    const container=clear('runs');
    const recent=runs.slice(0,7);
    if (!recent.length) { container.append(create('p','muted','Nenhuma execução encontrada.'));return; }
    for (const r of recent) {
      const isAgent=Object.values(EXECUTORS).includes(r.name);
      const status=statusByRun(r);
      const id=num(r.id);
      const url=id?GH+'/actions/runs/'+id:null;
      container.append(item(r.name||'Workflow sem nome',(isAgent?'EXECUTOR DE IA · ':'TESTE / CI · ')+ago(r.created_at),status.label,status.cls,url));
    }
  }
  function showPipeline(prs,runs,issues,main) {
    const container=clear('pipeline');
    const pr=(n)=>prs.find(x=>x.number===n);
    const integrated=pr(33);
    const gate=integrated?latestFor(integrated,runs):null;
    const s=statusByRun(gate);
    const items=[
      {title:'Integração Autopilot',detail:integrated?'PR #33 · '+(integrated.draft?'Rascunho':'Aberta')+' · CI '+s.label:'PR #33 não aparece entre as PRs abertas',label:integrated?'SEM MERGE':'NÃO OBSERVADO',cls:integrated?'blocked':'',url:GH+'/pull/33'},
      {title:'Monitoramento horário via GitHub',detail:'Workflow da PR #33; só ativa por agendamento após integração à branch padrão',label:'AGUARDA MERGE',cls:'',url:GH+'/pull/33'},
      {title:'Codex Cloud / Claude externo',detail:'Sessões cloud não expostas por estas APIs; pilotos Github #22/#25 ainda em rascunho',label:'NÃO VERIFICADO',cls:'',url:GH+'/pull/22'},
      {title:'Piloto Docs',detail:issues.some(x=>x.number===23)?'Issue #23 aberta; tarefas no ChatGPT não aparecem no GitHub antes de publicar uma PR':'Sem missão #23 aberta',label:'SEM ENTREGA VERIFICADA',cls:'',url:GH+'/issues/23'},
      {title:'Base principal',detail:(main?.commit?.sha||'SHA indisponível').slice(0,12)+' · branch main',label:'APENAS LEITURA',cls:'',url:GH+'/tree/main'},
    ];
    for (const x of items)container.append(item(x.title,x.detail,x.label,x.cls,x.url));
  }
  function showPrs(prs,runs) {
    const parent=clear('prs');
    if(!prs.length){parent.append(create('p','muted','Nenhuma PR aberta observada.'));return;}
    for(const p of prs.slice(0,12)){
      const id=num(p.number);
      if (!id) continue;
      const gate=latestFor(p,runs);
      const s=statusByRun(gate);
      const row=create('div','pr');
      const left=create('div');
      const title=link(GH+'/pull/'+id,'#'+id+' '+(p.title||'Pull request'));
      title.className='title';
      left.append(title,create('small', (p.draft?'Rascunho · ':'Aberta · ')+'Quality Gate: '+s.label+' · SHA '+String(p.head?.sha||'sem SHA').slice(0,10)));
      row.append(left,create('span','state '+s.cls,p.draft?'RASCUNHO':'EM REVISÃO'));
      parent.append(row);
    }
  }
  let polling=false;
  async function refresh(){
    if(polling)return;polling=true;
    $('refresh').disabled=true;
    set('refresh','Atualizando…');
    try{
      const [action,prs,issues,main] = await Promise.all([
        get('actions/runs?per_page=60'),get('pulls?state=open&per_page=100'),
        get('issues?state=open&per_page=100'),get('branches/main')
      ]);
      if(!Array.isArray(action.workflow_runs)||!Array.isArray(prs)||!Array.isArray(issues)) {
        throw new Error('Formato de resposta inesperado');
      }
      const all=action.workflow_runs,ai=all.filter(r=>Object.values(EXECUTORS).includes(r.name));
      const activeAI=ai.filter(r=>ACTIVE.has(r.status));
      const activeCI=all.filter(r=>RUNNING.has(r.status) && !Object.values(EXECUTORS).includes(r.name));
      const issueList=issues.filter(i=>!i.pull_request);
      const missions=issueList.filter(i=>/^\[AGENT(?:\s|\])/i.test(String(i.title||'')));
      set('ai-count',activeAI.length);
      set('ci-count',activeCI.length);
      set('pr-count',prs.length);
      set('task-count',missions.length);
      set('updated','Consultado em '+time(new Date().toISOString())+' · próximo refresh em 5 min');
      const aged=all.filter(r=>r.status==='in_progress' && dateOf(r.created_at) &&
         Date.now()-dateOf(r.created_at).getTime()>2*60*60*1000);
      const failedAgent=ai.find(r=>r.conclusion==='failure' && dateOf(r.updated_at) &&
         Date.now()-dateOf(r.updated_at).getTime()<2*60*60*1000);
      const alert=$('alert');alert.classList.remove('show');
      if (failedAgent) {
        alert.textContent='Atenção: uma execução de agente registrada no GitHub falhou recentemente. Consulte as execuções abaixo.';
        alert.classList.add('show');
      } else if (aged.length) {
        alert.textContent='Possível travamento: existe pelo menos um workflow há mais de 2 horas em execução. Confirme no GitHub antes de considerar bloqueado.';
        alert.classList.add('show');
      }
      if (activeAI.length) {
        set('summary-heading',activeAI.length+' execução(ões) de IA verificada(s)');
        set('summary-detail','Fluxos de agentes efetivamente em andamento ou na fila do GitHub. Sessões externas continuam não observáveis.');
      } else {
        set('summary-heading','Nenhum Codex ou Claude executando no GitHub agora');
        set('summary-detail','Isso não significa que o sistema falhou ou que agentes em outros chats estão ociosos. Os pilotos ainda precisam de ativação.');
      }
      showRuns(all);showAgents(issueList,prs,ai);showPipeline(prs,all,issueList,main);showPrs(prs,all);
    }catch(err){
      const alert=$('alert');
      alert.classList.add('show');
      alert.textContent='Não foi possível atualizar: '+(err instanceof Error?err.message:'erro desconhecido')+'. Os números visíveis podem estar desatualizados. Abra o GitHub para confirmar.';
      set('updated','Falha na consulta · dados possivelmente desatualizados');
      if($('ai-count').textContent==='—') {
        set('summary-heading','Status não verificado');
        set('summary-detail','Não foi possível consultar os dados do GitHub. Nenhum estado de execução pode ser confirmado.');
      }
    }finally{
      polling=false;$('refresh').disabled=false;set('refresh','Atualizar ↻');
    }
  }
  $('refresh').addEventListener('click',refresh);
  window.addEventListener('online',refresh);
  refresh();
  setInterval(refresh,INTERVAL_MS);
})();
