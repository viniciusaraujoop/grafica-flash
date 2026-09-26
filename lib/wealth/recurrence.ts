export const recurrenceFrequencies = {daily:'Diária',weekly:'Semanal',monthly:'Mensal',yearly:'Anual'}
export const recurrenceStatuses = {active:'Ativa',paused:'Pausada',cancelled:'Cancelada',completed:'Concluída'}
export type WealthRecurrence = {
 id:string;title:string;kind:'income'|'expense';category:string;amount_cents:number;frequency:keyof typeof recurrenceFrequencies;
 interval_count:number;start_date:string;end_date:string|null;max_occurrences:number|null;timezone:string;
 status:keyof typeof recurrenceStatuses;pause_reason:'user'|'access_unavailable'|null;next_index:number;next_date:string;
 next_run_at:string;last_run_at:string|null;version:number;
}
