import 'server-only'
import {getPersonalProductAccess} from '@/lib/ecosystem/server'
import {uuid,integer,financialDate} from './core'
import {documentCategories} from './documents'
export async function documentAccess(write=false){
 const read=await getPersonalProductAccess('wealth','wealth.read')
 if(!read.allowed||!read.identity)return null
 if(write&&!(await getPersonalProductAccess('wealth','wealth.write')).allowed)return null
 return read.identity
}
export function documentMetadata(form:FormData){
 const title=String(form.get('title')??'').trim(),category=String(form.get('category')??''),notes=String(form.get('notes')??'')
 if(!title||title.length>160||!Object.hasOwn(documentCategories,category)||notes.length>2000)throw Error('Confira título, categoria e observações.')
 const date=String(form.get('document_date')??''),expires=String(form.get('expires_on')??'')
 const links=form.getAll('link').filter(Boolean).map(value=>{const [kind,id]=String(value).split(':');if(!['goal','debt','portfolio'].includes(kind))throw Error('Vínculo inválido.');return {kind,id:uuid(id)}})
 if(links.length>5)throw Error('Selecione até cinco referências.')
 return {title,category,notes,document_date:date?financialDate(date):null,expires_on:expires?financialDate(expires):null,links}
}
export function documentCommand(form:FormData){
 if(form.get('confirmed')!=='yes')throw Error('Confirme a ação.')
 return {id:uuid(form.get('id')),version:integer(form.get('version'),1,Number.MAX_SAFE_INTEGER),idempotency_key:uuid(form.get('idempotency_key')),confirmed:'yes'}
}
