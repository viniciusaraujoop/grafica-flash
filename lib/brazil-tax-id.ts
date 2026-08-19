export type BrazilTaxIdType = "CPF" | "CNPJ";

export function taxIdDigits(value: unknown) {
  return String(value || "").replace(/\D/g, "");
}

function allDigitsEqual(value: string) {
  return /^(\d)\1+$/.test(value);
}

function cpfDigit(base: string, factor: number) {
  let total = 0;

  for (const digit of base) {
    total += Number(digit) * factor;
    factor -= 1;
  }

  const remainder = (total * 10) % 11;
  return remainder === 10 ? 0 : remainder;
}

export function isValidCpf(value: unknown) {
  const cpf = taxIdDigits(value);

  if (cpf.length !== 11 || allDigitsEqual(cpf)) return false;

  const first = cpfDigit(cpf.slice(0, 9), 10);
  if (first !== Number(cpf[9])) return false;

  const second = cpfDigit(cpf.slice(0, 10), 11);
  return second === Number(cpf[10]);
}

function cnpjDigit(base: string, weights: number[]) {
  const total = base
    .split("")
    .reduce((sum, digit, index) => sum + Number(digit) * weights[index], 0);
  const remainder = total % 11;
  return remainder < 2 ? 0 : 11 - remainder;
}

export function isValidCnpj(value: unknown) {
  const cnpj = taxIdDigits(value);

  if (cnpj.length !== 14 || allDigitsEqual(cnpj)) return false;

  const first = cnpjDigit(cnpj.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  if (first !== Number(cnpj[12])) return false;

  const second = cnpjDigit(cnpj.slice(0, 13), [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return second === Number(cnpj[13]);
}

export function parseBrazilTaxId(value: unknown) {
  const number = taxIdDigits(value);
  const type: BrazilTaxIdType | null =
    number.length === 11 ? "CPF" : number.length === 14 ? "CNPJ" : null;
  const valid = type === "CPF" ? isValidCpf(number) : type === "CNPJ" ? isValidCnpj(number) : false;

  return { number, type, valid };
}

export function invalidBrazilTaxIdMessage(value: unknown) {
  const parsed = parseBrazilTaxId(value);

  if (!parsed.type) return "Informe um CPF com 11 dígitos ou CNPJ com 14 dígitos.";
  return `${parsed.type} inválido. Confira os números informados.`;
}
