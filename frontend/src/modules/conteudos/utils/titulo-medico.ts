function stripAccents(s: string) {
  return s.normalize('NFD').replace(/\p{M}/gu, '');
}

/** Primeiro nome, sem Dr/Dra. */
function primeiroNome(nome: string): string {
  const limpo = nome
    .trim()
    .replace(/^(dr\(a\)|dra?)\.?\s+/i, '');
  const token = limpo.split(/\s+/)[0] || '';
  return stripAccents(token).toLowerCase();
}

const MASCULINOS_TERMINA_A = new Set([
  'luca',
  'lucca',
  'elias',
  'jonas',
  'tobias',
  'matias',
  'josias',
  'isaias',
  'ananias',
  'nicola',
  'joshua',
]);

const FEMININOS_COMUNS = new Set([
  'ana',
  'anna',
  'beatriz',
  'bruna',
  'camila',
  'carolina',
  'claudia',
  'cristina',
  'daniela',
  'denise',
  'elaine',
  'eliane',
  'fabiana',
  'fernanda',
  'flavia',
  'gabriela',
  'giselle',
  'helena',
  'ingrid',
  'iris',
  'isabel',
  'isabela',
  'isabella',
  'isis',
  'janete',
  'jessica',
  'joana',
  'jordana',
  'joyce',
  'julia',
  'juliana',
  'karina',
  'kelly',
  'larissa',
  'leticia',
  'lilian',
  'lucia',
  'luciana',
  'luiza',
  'manuela',
  'mara',
  'marcela',
  'maria',
  'mariana',
  'marina',
  'mayra',
  'michele',
  'michelle',
  'monique',
  'natalia',
  'nathalia',
  'nicole',
  'patricia',
  'paula',
  'priscila',
  'raquel',
  'renata',
  'roberta',
  'sabrina',
  'samara',
  'sandra',
  'silvia',
  'simone',
  'solange',
  'sonia',
  'tatiana',
  'thais',
  'valeria',
  'vanessa',
  'vera',
  'vivian',
  'viviane',
  'waleska',
  'yasmin',
]);

/**
 * Título profissional: Dr. / Dra. (evita Dr(a)., que parece feminino em nomes masculinos).
 */
export function tituloMedico(nome: string): 'Dr.' | 'Dra.' {
  const first = primeiroNome(nome);
  if (!first) return 'Dr.';
  if (FEMININOS_COMUNS.has(first)) return 'Dra.';
  if (first.endsWith('a') && !MASCULINOS_TERMINA_A.has(first)) return 'Dra.';
  return 'Dr.';
}

/** Prefixa Dr./Dra. se o nome ainda não tiver título. */
export function formatPalestranteNome(nome: string): string {
  const n = nome.trim();
  if (!n) return '';
  if (/^dra?\.?\s/i.test(n) && !/^dr\(a\)/i.test(n)) return n;
  const semTitulo = n.replace(/^(dr\(a\)|dra?)\.?\s+/i, '').trim();
  return `${tituloMedico(semTitulo)} ${semTitulo}`;
}
