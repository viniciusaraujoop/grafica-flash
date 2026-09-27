export const documentBucket='wealth-documents'
export const documentMaxBytes=3*1024*1024
export const documentCategories={statement:'Extrato',contract:'Contrato',receipt:'Comprovante',tax:'Imposto',insurance:'Seguro',other:'Outro'}
export const documentStatuses={pending:'Envio incompleto',active:'Disponível',deleting:'Exclusão em andamento',deleted:'Removido'}
export type WealthDocument={id:string;title:string;category:keyof typeof documentCategories;document_date:string|null;expires_on:string|null;notes:string;links:{kind:'goal'|'debt'|'portfolio';id:string}[];mime_type:string;size_bytes:number;sha256:string;object_path:string;status:keyof typeof documentStatuses;version:number;created_at:string}
/** Signature checks identify supported containers; they do not certify malware safety. */
export function documentMime(bytes:Uint8Array){
 if(!bytes.length||bytes.length>documentMaxBytes)throw Error('O arquivo deve ter entre 1 byte e 3 MiB.')
 if(bytes.length>=5&&[37,80,68,70,45].every((v,i)=>bytes[i]===v))return 'application/pdf'
 if(bytes.length>=8&&[137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v))return 'image/png'
 if(bytes.length>=3&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return 'image/jpeg'
 throw Error('Formato não reconhecido. Use PDF, PNG ou JPEG.')
}
export function documentExtension(mime:string){return mime==='application/pdf'?'pdf':mime==='image/png'?'png':'jpg'}
export function documentError(code?:string){return code==='PT409'?'O documento mudou. Atualize a página antes de tentar novamente.':code==='23505'?'Este envio ou comando já existe. Atualize a página.':'Não foi possível concluir. Confira o acesso e tente novamente.'}
