/** Bancos comuns (código COMPE) para seleção no cadastro. */
import { validateCPF } from '../utils/validation.util';

export const BANCOS_CADASTRO = [
  { codigo: '001', label: '001 — Banco do Brasil' },
  { codigo: '033', label: '033 — Santander' },
  { codigo: '104', label: '104 — Caixa Econômica' },
  { codigo: '237', label: '237 — Bradesco' },
  { codigo: '341', label: '341 — Itaú' },
  { codigo: '260', label: '260 — Nubank' },
  { codigo: '077', label: '077 — Inter' },
  { codigo: '212', label: '212 — Banco Original' },
  { codigo: '336', label: '336 — C6 Bank' },
  { codigo: '422', label: '422 — Safra' },
  { codigo: '070', label: '070 — BRB' },
  { codigo: '756', label: '756 — Sicoob' },
  { codigo: '748', label: '748 — Sicredi' },
  { codigo: '041', label: '041 — Banrisul' },
  { codigo: '208', label: '208 — BTG Pactual' },
  { codigo: 'outro', label: 'Outro (informar nome)' },
] as const;

export type BancoCadastroCodigo = (typeof BANCOS_CADASTRO)[number]['codigo'];

export const TIPOS_CHAVE_PIX = [
  { value: 'cpf', label: 'CPF' },
  { value: 'cnpj', label: 'CNPJ' },
  { value: 'email', label: 'E-mail' },
  { value: 'telefone', label: 'Telefone celular' },
  { value: 'aleatoria', label: 'Chave aleatória (EVP)' },
] as const;

export type TipoChavePix = (typeof TIPOS_CHAVE_PIX)[number]['value'];

export function labelBancoPorCodigo(codigo: string, nomeOutro?: string): string {
  if (codigo === 'outro') {
    const n = (nomeOutro || '').trim();
    return n || 'Outro';
  }
  const found = BANCOS_CADASTRO.find((b) => b.codigo === codigo);
  return found?.label ?? codigo;
}

export function formatarCpfMask(value: string): string {
  const d = value.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

export function formatarCnpjMask(value: string): string {
  const d = value.replace(/\D/g, '').slice(0, 14);
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

/** Máscara (00) 00000-0000 — só dígitos nacionais (DDD + número). */
export function formatarTelefonePixMask(value: string): string {
  let d = value.replace(/\D/g, '');
  if (d.startsWith('55') && d.length > 11) d = d.slice(2);
  d = d.slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : '';
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/** EVP tipicamente UUID: 8-4-4-4-12 hex. */
export function formatarEvpMask(value: string): string {
  const hex = value.replace(/[^a-fA-F0-9]/g, '').slice(0, 32).toLowerCase();
  const parts = [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].filter(Boolean);
  return parts.join('-');
}

export function formatarChavePixPorTipo(tipo: TipoChavePix, value: string): string {
  switch (tipo) {
    case 'cpf':
      return formatarCpfMask(value);
    case 'cnpj':
      return formatarCnpjMask(value);
    case 'telefone':
      return formatarTelefonePixMask(value);
    case 'email':
      return value.replace(/\s/g, '').toLowerCase().slice(0, 120);
    case 'aleatoria':
      return formatarEvpMask(value);
    default:
      return value;
  }
}

export function placeholderChavePix(tipo: TipoChavePix): string {
  switch (tipo) {
    case 'cpf':
      return '000.000.000-00';
    case 'cnpj':
      return '00.000.000/0000-00';
    case 'email':
      return 'seu@email.com';
    case 'telefone':
      return '(85) 99999-9999';
    case 'aleatoria':
      return 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx';
    default:
      return '';
  }
}

export function inputModeChavePix(tipo: TipoChavePix): 'text' | 'email' | 'tel' | 'numeric' {
  switch (tipo) {
    case 'email':
      return 'email';
    case 'telefone':
      return 'tel';
    case 'cpf':
    case 'cnpj':
      return 'numeric';
    default:
      return 'text';
  }
}

/** Valida dígitos verificadores de CNPJ. */
export function validateCNPJ(cnpj: string): boolean {
  const d = cnpj.replace(/\D/g, '');
  if (d.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(d)) return false;

  const calc = (base: string, factors: number[]) => {
    let sum = 0;
    for (let i = 0; i < factors.length; i++) {
      sum += parseInt(base[i]!, 10) * factors[i]!;
    }
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };

  const f1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const d1 = calc(d, f1);
  if (d1 !== parseInt(d[12]!, 10)) return false;
  const f2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const d2 = calc(d, f2);
  return d2 === parseInt(d[13]!, 10);
}

export function validarChavePix(tipo: TipoChavePix, value: string): string | null {
  const v = (value || '').trim();
  if (!v) return 'Informe a chave Pix';

  switch (tipo) {
    case 'cpf': {
      if (!validateCPF(v)) return 'CPF inválido';
      return null;
    }
    case 'cnpj': {
      if (!validateCNPJ(v)) return 'CNPJ inválido';
      return null;
    }
    case 'email': {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return 'E-mail inválido';
      return null;
    }
    case 'telefone': {
      let digits = v.replace(/\D/g, '');
      if (digits.startsWith('55') && digits.length > 11) digits = digits.slice(2);
      if (digits.length !== 10 && digits.length !== 11) {
        return 'Telefone deve ter DDD + número (10 ou 11 dígitos)';
      }
      return null;
    }
    case 'aleatoria': {
      const hex = v.replace(/-/g, '');
      if (!/^[a-f0-9]{32}$/i.test(hex)) {
        return 'Chave aleatória deve ter 32 caracteres hexadecimais (formato UUID)';
      }
      return null;
    }
    default:
      return 'Tipo de chave inválido';
  }
}

/** Valor normalizado para envio/armazenamento. */
export function normalizarChavePix(tipo: TipoChavePix, value: string): string {
  const v = (value || '').trim();
  switch (tipo) {
    case 'cpf':
    case 'cnpj':
      return v.replace(/\D/g, '');
    case 'telefone': {
      let digits = v.replace(/\D/g, '');
      if (digits.startsWith('55') && digits.length > 11) digits = digits.slice(2);
      return `+55${digits}`;
    }
    case 'email':
      return v.toLowerCase();
    case 'aleatoria':
      return formatarEvpMask(v);
    default:
      return v;
  }
}
