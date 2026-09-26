export type WealthSummary = {
 currency:'BRL';month:string;income:string;expenses:string;assets:string;liabilities:string;netWorth:string;cashFlow:string;entryCount:string;goalCount:string;completedGoals:string;goalTarget:string;goalSaved:string;goalContributions:string;reserveTarget:string;contributionCapacity:string;unknownValuations?:string;
 months:{month:string;income:string;expenses:string;cashFlow:string}[];
 categories:{kind:'income'|'expense';category:string;amount:string}[];
}
const object=(v:unknown):v is Record<string,unknown>=>typeof v==='object'&&v!==null&&!Array.isArray(v)
const cents=(v:unknown)=>typeof v==='string'&&/^-?\d{1,60}$/.test(v)
export function readWealthSummary(value:unknown):WealthSummary {
 if(!object(value)||value.currency!=='BRL'||typeof value.month!=='string')throw Error('Resumo inválido')
 for(const key of ['income','expenses','assets','liabilities','netWorth','cashFlow','entryCount','goalCount','completedGoals','goalTarget','goalSaved','goalContributions','reserveTarget','contributionCapacity'])if(!cents(value[key]))throw Error('Total sem precisão confirmada')
 if(!Array.isArray(value.months)||value.months.length!==12||!value.months.every(row=>object(row)&&typeof row.month==='string'&&cents(row.income)&&cents(row.expenses)&&cents(row.cashFlow)))throw Error('Evolução inválida')
 if(!Array.isArray(value.categories)||value.categories.length>22||!value.categories.every(row=>object(row)&&['income','expense'].includes(String(row.kind))&&typeof row.category==='string'&&cents(row.amount)))throw Error('Categorias inválidas')
 return value as WealthSummary
}
