import {integer,uuid} from './core'
export const familyScopes={'goal.summary':'Resumo de uma meta','entry.summary':'Resumo de um lançamento','document.download':'Arquivo completo de um documento'}
export const familyStates={pending:'Aguardando aceite',active:'Ativo',revoked:'Encerrado',expired:'Expirado'}
export type FamilyResource={title:string;date?:string|null;target_cents?:string;saved_cents?:string;amount_cents?:string;kind?:string;status?:string;currency?:string;mime_type?:string;size_bytes?:number;sha256?:string;object_path?:string}
export type FamilyConnection={id:string;label:string;state:keyof typeof familyStates;version:number;owned:boolean;invite_expires_at:string}
export type FamilyShare={id:string;connection_id:string;scope:keyof typeof familyScopes;purpose:string;state:keyof typeof familyStates;version:number;owned:boolean;expires_at:string;resource:FamilyResource|null}
export type FamilyOverview={connections:FamilyConnection[];shares:FamilyShare[];total:string;connectionTotal:string}
export type FamilyOption={id:string;title:string;scope:keyof typeof familyScopes}
export function familyCommand(form:FormData){
 const operation=String(form.get('operation')??'')
 if(!['invite','join','disconnect','share','accept','revoke'].includes(operation)||form.get('confirmed')!=='yes')throw Error('Confira e confirme a ação.')
 const input:Record<string,string|number>={id:uuid(form.get('id')),idempotency_key:uuid(form.get('idempotency_key')),confirmed:'yes'}
 if(operation==='invite'){
  const label=String(form.get('label')??'').trim(),email=String(form.get('email')??'').trim().toLowerCase(),code=String(form.get('code')??'')
  if(!label||label.length>80||email.length>254||!/^\S+@[^\s@]+\.[^\s@]+$/.test(email)||!/^[a-f0-9]{64}$/.test(code))throw Error('Confira o nome e o email do destinatário.')
  Object.assign(input,{label,email,code})
 }else if(operation==='join'){
  const [id,code,...rest]=String(form.get('invitation')??'').trim().split('.')
  if(rest.length||!/^[a-f0-9]{64}$/.test(code??''))throw Error('Código de convite inválido.')
  input.id=uuid(id);input.code=code
 }else if(operation==='share'){
  const [scope,resource,...rest]=String(form.get('resource')??'').split(':');const purpose=String(form.get('purpose')??'').trim()
  if(rest.length||!Object.hasOwn(familyScopes,scope)||!purpose||purpose.length>160)throw Error('Escolha um registro e informe a finalidade.')
  Object.assign(input,{scope,resource_id:uuid(resource),connection_id:uuid(form.get('connection_id')),purpose,days:integer(form.get('days'),1,366)})
 }else input.version=integer(form.get('version'),1,Number.MAX_SAFE_INTEGER)
 return {operation,input}
}
export function familyError(code?:string){return code==='PT409'?'O acesso mudou. Atualize a página e confira antes de repetir.':code==='23505'?'Esta conexão ou solicitação já existe. Atualize a página.':code==='54000'?'Limite operacional atingido. Encerre convites ou acessos que não usa.':'Não foi possível concluir. Confira o convite, as permissões e a validade.'}
