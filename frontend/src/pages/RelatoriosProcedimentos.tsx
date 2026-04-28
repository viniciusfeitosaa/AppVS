import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { useAuth } from '../context/AuthContext';
import { adminService, type AdminMedico } from '../services/admin.service';
import procedimentosBase from '../data/procedimentosBase.json';

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const PCT = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 3 });

const defaultDeflatorPct = 23.021;
const defaultCustoAdmPct = 25;
const defaultRepasse2MedPct = 30;
const STORAGE_KEY = 'relatorioProcedimentosCalc_v1';
const COLS_LANC_KEY = 'relatorioProcedLancColunas_v1';

/** Colunas da tabela de lançamentos (a coluna — excluir é sempre visível). */
type ColLancKey = 'ins' | 'cod1' | 'proc1' | 'v1' | 'rep1' | 'cod2' | 'proc2' | 'v2' | 'rep2' | 'bruto';
type ColResumoKey = 'medico' | 'repasse' | 'recebe';

const defaultColsLanc = (): Record<ColLancKey, boolean> => ({
  ins: true,
  cod1: true,
  proc1: true,
  v1: true,
  rep1: true,
  cod2: true,
  proc2: true,
  v2: true,
  rep2: true,
  bruto: true,
});

const loadColsLanc = (): Record<ColLancKey, boolean> => {
  try {
    const r = localStorage.getItem(COLS_LANC_KEY);
    if (!r) return defaultColsLanc();
    const p = JSON.parse(r) as Record<string, boolean>;
    return { ...defaultColsLanc(), ...p };
  } catch {
    return defaultColsLanc();
  }
};

/** Pesos relativos para `table-layout: fixed` (largura % soma 100 com colunas visíveis). Inclui ações. */
const PESO_COL_LANC: Record<'acoes' | ColLancKey, number> = {
  acoes: 3.4,
  ins: 2.8,
  cod1: 3.6,
  proc1: 16,
  v1: 4.2,
  rep1: 8.5,
  cod2: 3.6,
  proc2: 16,
  v2: 4.2,
  rep2: 8.5,
  bruto: 5.4,
};

/** Peso mínimo da coluna oculta: só o controlo de visibilidade no cabeçalho. */
const PESO_COL_LANC_HEADER_OCULTA = 0.55;

const LANC_COL_ORDER: ColLancKey[] = [
  'ins',
  'cod1',
  'proc1',
  'v1',
  'rep1',
  'cod2',
  'proc2',
  'v2',
  'rep2',
  'bruto',
];

const LANC_TH: { key: ColLancKey; label: string; thTitle?: string; borderL?: boolean }[] = [
  { key: 'ins', label: 'Ins.' },
  { key: 'cod1', label: 'Cód. 1' },
  { key: 'proc1', label: '1.º proced.' },
  { key: 'v1', label: 'Valor 1', thTitle: 'Valor 1' },
  { key: 'rep1', label: '1.º no rep.', thTitle: 'Médico no repasse', borderL: true },
  { key: 'cod2', label: 'Cód. 2' },
  { key: 'proc2', label: '2.º proced.' },
  { key: 'v2', label: 'Valor 2', thTitle: 'Valor 2' },
  { key: 'rep2', label: '2.º no rep.', thTitle: 'Médico no repasse' },
  { key: 'bruto', label: 'Contrib.' },
];

const RESUMO_TH: { key: ColResumoKey; label: string; align?: 'left' | 'center' | 'right' }[] = [
  { key: 'medico', label: 'Médico', align: 'left' },
  { key: 'repasse', label: 'Repasse', align: 'center' },
  { key: 'recebe', label: 'Valor exato a receber', align: 'right' },
];

function IconEye({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function IconEyeOff({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

function IconPencil({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
    </svg>
  );
}

const textoSeguroPdf = (s: string) =>
  String(s)
    .replace(/\u202f/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\u2013|\u2014|\u2212/g, '-');

type ProcedimentoBase = (typeof procedimentosBase)[number];

type RascunhoProfsT = {
  profissional1Nome: string;
  profissional1Crm: string;
  profissional2Nome: string;
  profissional2Crm: string;
  incluirProfissional1: boolean;
  incluirProfissional2: boolean;
};

type LinhaProcedimento = {
  id: string;
  refBaseId: string | null;
  dataProcedimento: string;
  nomePaciente: string;
  prontuario: string;
  instrumento: string;
  codigo1: string;
  nome1: string;
  valorPrimeiro: string;
  codigo2: string;
  nome2: string;
  valorSegundo: string;
  /**
   * Quem recebe o repasse **nesta** linha, gravado no lançamento.
   * Ausente em dados legados: usa a identificação geral do mês (`DadosMes`).
   */
  quemRepasse?: RascunhoProfsT;
};

type DadosMes = {
  concluido: boolean;
  deflatorPct: string;
  custoAdmPct: string;
  repasse2MedPct: string;
  /** Incluir o 1.º profissional na divisão do pool (repasse) */
  incluirProfissional1: boolean;
  /** Incluir o 2.º profissional na divisão do pool (repasse) */
  incluirProfissional2: boolean;
  /** Nome (ou como identificar) o 1.º profissional do repasse */
  profissional1Nome: string;
  /** CRM/UF do 1.º; opcional */
  profissional1Crm: string;
  profissional2Nome: string;
  profissional2Crm: string;
  /** Legado: migrado → incluirProfissional2 */
  segundoMedico?: boolean;
  /** Tabela "Detalhe do cálculo" visível (padrão: true) */
  mostrarDetalheCalculo?: boolean;
  procedimentos: LinhaProcedimento[];
};

const pickRascunhoProfs = (d: DadosMes): RascunhoProfsT => ({
  profissional1Nome: d.profissional1Nome,
  profissional1Crm: d.profissional1Crm,
  profissional2Nome: d.profissional2Nome,
  profissional2Crm: d.profissional2Crm,
  incluirProfissional1: d.incluirProfissional1,
  incluirProfissional2: d.incluirProfissional2,
});

const mesesNomes = ['jan.', 'fev.', 'mar.', 'abr.', 'mai.', 'jun.', 'jul.', 'ago.', 'set.', 'out.', 'nov.', 'dez.'] as const;

const criarId = () => globalThis.crypto?.randomUUID?.() ?? `p-${Date.now()}`;

const numBrl = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const chaveDeBase = (p: ProcedimentoBase) => `${p.instrumento} | ${p.codigo1} | ${p.nome1}`;

const fromBase = (b: ProcedimentoBase): LinhaProcedimento => ({
  id: criarId(),
  refBaseId: b.id,
  dataProcedimento: '',
  nomePaciente: '',
  prontuario: '',
  instrumento: b.instrumento,
  codigo1: b.codigo1,
  nome1: b.nome1,
  valorPrimeiro: numBrl(b.valor1),
  codigo2: b.codigo2,
  nome2: b.nome2,
  valorSegundo: numBrl(b.valor2),
});

const linhaPendenteVazia = (): LinhaProcedimento => ({
  id: criarId(),
  refBaseId: null,
  dataProcedimento: '',
  nomePaciente: '',
  prontuario: '',
  instrumento: '',
  codigo1: '',
  nome1: '',
  valorPrimeiro: '',
  codigo2: '',
  nome2: '',
  valorSegundo: '',
});

const defaultDadosMes = (): DadosMes => ({
  concluido: false,
  deflatorPct: String(defaultDeflatorPct),
  custoAdmPct: String(defaultCustoAdmPct),
  repasse2MedPct: String(defaultRepasse2MedPct),
  incluirProfissional1: true,
  incluirProfissional2: true,
  profissional1Nome: '',
  profissional1Crm: '',
  profissional2Nome: '',
  profissional2Crm: '',
  mostrarDetalheCalculo: true,
  procedimentos: [],
});

/** Carrega dados guardados e aplica campos novos / legado `segundoMedico`. */
const normalizarDadosMes = (s: DadosMes): DadosMes => {
  let p1 = s.incluirProfissional1;
  let p2 = s.incluirProfissional2;
  if (typeof p1 !== 'boolean') p1 = true;
  if (typeof p2 !== 'boolean') {
    if (typeof s.segundoMedico === 'boolean') p2 = s.segundoMedico;
    else p2 = true;
  }
  return {
    ...s,
    incluirProfissional1: p1,
    incluirProfissional2: p2,
    profissional1Nome: s.profissional1Nome ?? '',
    profissional1Crm: s.profissional1Crm ?? '',
    profissional2Nome: s.profissional2Nome ?? '',
    profissional2Crm: s.profissional2Crm ?? '',
    mostrarDetalheCalculo: s.mostrarDetalheCalculo !== false,
  };
};

const rotuloQuem = (nome: string, crm: string): string | null => {
  const n = nome.trim();
  const c = crm.trim();
  if (!n && !c) return null;
  if (n && c) return `${n} · CRM ${c}`;
  return n || `CRM ${c}`;
};

const parseNumeroBr = (s: string, fallback: number = 0): number => {
  if (!s || !String(s).trim()) return fallback;
  const raw = String(s)
    .trim()
    .replace(/%/g, '')
    .replace(/R\$/g, '')
    .replace(/\s/g, '');
  if (!raw) return fallback;
  if (raw.includes(',') && raw.includes('.')) {
    return parseFloat(raw.replace(/\./g, '').replace(',', '.')) || fallback;
  }
  if (raw.includes(',') && !raw.includes('.')) {
    return parseFloat(raw.replace(/\./g, '').replace(',', '.')) || fallback;
  }
  if (raw.includes('.')) return parseFloat(raw) || fallback;
  return parseFloat(raw) || fallback;
};

const parseBrl = (s: string) => parseNumeroBr(s, 0);
const formatarDataISO = (iso: string): string => {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
};
const parsePercent = (s: string, fallback: number) => {
  const n = parseNumeroBr(s, NaN);
  return Number.isNaN(n) ? fallback : n;
};

const loadStore = (): Record<string, DadosMes> => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const p = JSON.parse(raw) as Record<string, DadosMes>;
    return p && typeof p === 'object' ? p : {};
  } catch {
    return {};
  }
};

const saveStore = (d: Record<string, DadosMes>) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(d));
  } catch {
    /* ignore */
  }
};

const migrarProcedimentos = (raw: unknown): LinhaProcedimento[] => {
  if (!Array.isArray(raw) || raw.length === 0) return [];
  return (raw as Record<string, unknown>[]).map((p) => {
    if (p && typeof p === 'object' && 'codigo1' in p) {
      return p as unknown as LinhaProcedimento;
    }
    const o = p as { id: string; nome: string; valorPrimeiro: string; valorSegundo: string };
    return {
      id: o.id || criarId(),
      refBaseId: null,
      dataProcedimento: '',
      nomePaciente: '',
      prontuario: '',
      instrumento: '',
      codigo1: '',
      nome1: o.nome ?? '',
      valorPrimeiro: o.valorPrimeiro ?? '',
      codigo2: '',
      nome2: '',
      valorSegundo: o.valorSegundo ?? '',
    };
  });
};

const round2 = (n: number) => Math.round(n * 100) / 100;

const quemRepasseEfetivo = (l: LinhaProcedimento, mes: DadosMes): RascunhoProfsT => l.quemRepasse ?? pickRascunhoProfs(mes);

const repasseBrutoUmaLinha = (
  bruto: number,
  d: number,
  adm: number,
  r2F: number,
  q: RascunhoProfsT
) => {
  const desconto = round2(bruto * d);
  const baseDefl = round2(bruto * (1 - d));
  const custo = round2(baseDefl * adm);
  const pool = round2(baseDefl - custo);
  const p1 = q.incluirProfissional1;
  const p2 = q.incluirProfissional2;
  if (p1 && p2) {
    const r2 = round2(pool * r2F);
    // Regra solicitada: 1.º recebe 100% do pool; 2.º recebe percentual adicional do pool.
    const r1 = pool;
    return { desconto, baseDefl, custo, pool, r1, r2 };
  }
  if (p1) return { desconto, baseDefl, custo, pool, r1: pool, r2: 0 };
  if (p2) return { desconto, baseDefl, custo, pool, r1: 0, r2: pool };
  return { desconto, baseDefl, custo, pool, r1: 0, r2: 0 };
};

const lancarRepassePermitido = (q: RascunhoProfsT): boolean => {
  if (!q.incluirProfissional1 && !q.incluirProfissional2) return false;
  if (q.incluirProfissional1 && !rotuloQuem(q.profissional1Nome, q.profissional1Crm)) return false;
  if (q.incluirProfissional2 && !rotuloQuem(q.profissional2Nome, q.profissional2Crm)) return false;
  return true;
};

const rascunhoNomesVazios = (inc: { incluirProfissional1: boolean; incluirProfissional2: boolean }): RascunhoProfsT => ({
  profissional1Nome: '',
  profissional1Crm: '',
  profissional2Nome: '',
  profissional2Crm: '',
  incluirProfissional1: inc.incluirProfissional1,
  incluirProfissional2: inc.incluirProfissional2,
});

/** Só no carregamento do mês: linhas antigas (sem `quemRepasse`) herdam a identificação geral UMA VEZ, não a cada lançamento. */
const enriquecerLinhasComQuemRepasseAusente = (d: DadosMes): { dados: DadosMes; mudou: boolean } => {
  let mudou = false;
  const procedimentos = d.procedimentos.map((p) => {
    if (p.quemRepasse != null) return p;
    mudou = true;
    return { ...p, quemRepasse: pickRascunhoProfs(d) };
  });
  if (!mudou) return { dados: d, mudou: false };
  return { dados: { ...d, procedimentos }, mudou: true };
};

const RelatoriosProcedimentos = () => {
  const { user } = useAuth();
  const isMaster = user?.role === 'MASTER';
  const hoje = new Date();
  const [ano, setAno] = useState(hoje.getFullYear());
  const [mesMM, setMesMM] = useState(() => String(hoje.getMonth() + 1).padStart(2, '0'));
  const mesChave = `${ano}-${mesMM}`;

  const [store, setStore] = useState<Record<string, DadosMes>>(() =>
    typeof window === 'undefined' ? {} : loadStore()
  );
  const [local, setLocal] = useState<DadosMes>(() => defaultDadosMes());
  const localRef = useRef(local);
  useEffect(() => {
    localRef.current = local;
  }, [local]);

  const [busca, setBusca] = useState('');
  const [abrirSugestoes, setAbrirSugestoes] = useState(false);
  const boxBuscaRef = useRef<HTMLDivElement | null>(null);

  const [modalParams, setModalParams] = useState(false);
  const [modalBaseProcedimentos, setModalBaseProcedimentos] = useState(false);
  const [rascunho, setRascunho] = useState<DadosMes>(() => defaultDadosMes());
  const [rascunhoProfs, setRascunhoProfs] = useState<RascunhoProfsT>(() => pickRascunhoProfs(defaultDadosMes()));
  const [linhaPendente, setLinhaPendente] = useState<LinhaProcedimento | null>(null);
  const [medBusca1, setMedBusca1] = useState('');
  const [medAbrir1, setMedAbrir1] = useState(false);
  const [medBusca2, setMedBusca2] = useState('');
  const [medAbrir2, setMedAbrir2] = useState(false);
  const boxMed1Ref = useRef<HTMLDivElement | null>(null);
  const boxMed2Ref = useRef<HTMLDivElement | null>(null);

  const [colsLanc, setColsLanc] = useState<Record<ColLancKey, boolean>>(() =>
    typeof window === 'undefined' ? defaultColsLanc() : loadColsLanc()
  );
  const [colsResumo, setColsResumo] = useState<Record<ColResumoKey, boolean>>({
    medico: true,
    repasse: true,
    recebe: true,
  });
  const [modoVisualLanc, setModoVisualLanc] = useState<'detalhado' | 'resumo' | 'pacientes'>('detalhado');
  useEffect(() => {
    try {
      localStorage.setItem(COLS_LANC_KEY, JSON.stringify(colsLanc));
    } catch {
      /* ignore */
    }
  }, [colsLanc]);

  const fetchCorpoClinicoCompleto = useCallback(async (): Promise<AdminMedico[]> => {
    const limit = 2000;
    const all: AdminMedico[] = [];
    let page = 1;
    for (;;) {
      const res = await adminService.listMedicos({ page, limit, ativo: true });
      if (Array.isArray(res.data)) {
        for (const m of res.data) {
          if (m.ativo) all.push(m);
        }
      }
      const totalPages = res.pagination?.totalPages ?? 1;
      if (page >= totalPages) break;
      page += 1;
    }
    all.sort((a, b) => a.nomeCompleto.localeCompare(b.nomeCompleto, 'pt-BR', { sensitivity: 'base' }));
    return all;
  }, []);

  const { data: medicosLista = [], isError: errMedicos, isLoading: carregandoMedicos } = useQuery({
    queryKey: ['admin', 'medicos', 'relatorio-procedimentos', 'all'],
    queryFn: fetchCorpoClinicoCompleto,
    enabled: isMaster,
    staleTime: 60_000,
  });

  useEffect(() => {
    setStore(loadStore());
  }, []);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (boxBuscaRef.current && !boxBuscaRef.current.contains(t)) setAbrirSugestoes(false);
      if (boxMed1Ref.current && !boxMed1Ref.current.contains(t)) setMedAbrir1(false);
      if (boxMed2Ref.current && !boxMed2Ref.current.contains(t)) setMedAbrir2(false);
    };
    document.addEventListener('click', onDoc);
    return () => document.removeEventListener('click', onDoc);
  }, []);

  useEffect(() => {
    const all = loadStore();
    setStore(all);
    const s = all[mesChave];
    if (s) {
      const n = normalizarDadosMes({
        ...s,
        deflatorPct: s.deflatorPct ?? String(defaultDeflatorPct),
        custoAdmPct: s.custoAdmPct ?? String(defaultCustoAdmPct),
        repasse2MedPct: s.repasse2MedPct ?? String(defaultRepasse2MedPct),
        procedimentos: migrarProcedimentos(s.procedimentos),
      });
      const { dados, mudou } = enriquecerLinhasComQuemRepasseAusente(n);
      setLocal(dados);
      setRascunhoProfs(pickRascunhoProfs(dados));
      if (mudou) {
        const grava = { ...all, [mesChave]: dados };
        saveStore(grava);
        setStore(grava);
      }
    } else {
      const d0 = defaultDadosMes();
      setLocal(d0);
      setRascunhoProfs(pickRascunhoProfs(d0));
    }
    setBusca('');
    setLinhaPendente(null);
  }, [mesChave]);

  const persist = useCallback(
    (a: DadosMes) => {
      setLocal(a);
      setStore((prev) => {
        const n = { ...prev, [mesChave]: a };
        saveStore(n);
        return n;
      });
    },
    [mesChave]
  );

  const abrirParametros = () => {
    setRascunho(normalizarDadosMes({ ...local, ...rascunhoProfs }));
    setModalParams(true);
  };
  const salvarParametros = () => {
    const salvo = normalizarDadosMes(rascunho);
    persist(salvo);
    setRascunhoProfs(pickRascunhoProfs(salvo));
    setModalParams(false);
  };
  const cancelarParametros = () => setModalParams(false);

  useEffect(() => {
    if (!modalParams) return;
    const f = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setModalParams(false);
    };
    window.addEventListener('keydown', f);
    return () => window.removeEventListener('keydown', f);
  }, [modalParams]);

  useEffect(() => {
    if (!modalBaseProcedimentos) return;
    const f = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setModalBaseProcedimentos(false);
    };
    window.addEventListener('keydown', f);
    return () => window.removeEventListener('keydown', f);
  }, [modalBaseProcedimentos]);

  const sugestoes = useMemo(() => {
    const q = busca.toLowerCase().trim();
    if (q.length < 2) return [];
    return procedimentosBase
      .filter(
        (b) =>
          chaveDeBase(b).toLowerCase().includes(q) ||
          b.instrumento.toLowerCase().includes(q) ||
          b.nome1.toLowerCase().includes(q) ||
          b.codigo1.toLowerCase().includes(q) ||
          b.nome2.toLowerCase().includes(q)
      )
      .slice(0, 12);
  }, [busca]);

  const sugestoesMedicos1 = useMemo(() => {
    const t = medBusca1.toLowerCase().trim();
    if (t.length === 0) return medicosLista;
    return medicosLista.filter(
      (m) =>
        m.nomeCompleto.toLowerCase().includes(t) || (m.crm != null && m.crm.toLowerCase().includes(t))
    );
  }, [medBusca1, medicosLista]);
  const sugestoesMedicos2 = useMemo(() => {
    const t = medBusca2.toLowerCase().trim();
    if (t.length === 0) return medicosLista;
    return medicosLista.filter(
      (m) =>
        m.nomeCompleto.toLowerCase().includes(t) || (m.crm != null && m.crm.toLowerCase().includes(t))
    );
  }, [medBusca2, medicosLista]);

  const linhasTotais = useMemo(
    () =>
      [...local.procedimentos]
        .sort((a, b) => {
          const da = (a.dataProcedimento || '').trim();
          const db = (b.dataProcedimento || '').trim();
          if (!da && !db) return 0;
          if (!da) return 1;
          if (!db) return -1;
          return da.localeCompare(db);
        })
        .map((l) => {
          const p1 = parseBrl(l.valorPrimeiro);
          const p2 = parseBrl(l.valorSegundo);
          const bruto = p1 + 0.5 * p2;
          return { ...l, p1, p2, bruto: round2(bruto) };
        }),
    [local.procedimentos]
  );

  const valorBruto = useMemo(
    () => round2(linhasTotais.reduce((a, b) => a + b.bruto, 0)),
    [linhasTotais]
  );

  const dPct = useMemo(
    () => parsePercent(local.deflatorPct, defaultDeflatorPct) / 100,
    [local.deflatorPct]
  );
  const admPct = useMemo(
    () => parsePercent(local.custoAdmPct, defaultCustoAdmPct) / 100,
    [local.custoAdmPct]
  );
  const r2Pct = useMemo(
    () => parsePercent(local.repasse2MedPct, defaultRepasse2MedPct) / 100,
    [local.repasse2MedPct]
  );

  const { descontoDeflator, baseDeflada, custoAdm, poolAposCusto, repasse1, repasse2, repasseTotal, margemCoop, margemPctBruto } = useMemo(() => {
    if (linhasTotais.length === 0) {
      return {
        descontoDeflator: 0,
        baseDeflada: 0,
        custoAdm: 0,
        poolAposCusto: 0,
        repasse1: 0,
        repasse2: 0,
        repasseTotal: 0,
        margemCoop: 0,
        margemPctBruto: 0,
      };
    }
    let sDes = 0;
    let sBase = 0;
    let sCusto = 0;
    let sPool = 0;
    let sR1 = 0;
    let sR2 = 0;
    for (const l of linhasTotais) {
      const q = quemRepasseEfetivo(l, local);
      const r = repasseBrutoUmaLinha(l.bruto, dPct, admPct, r2Pct, q);
      sDes += r.desconto;
      sBase += r.baseDefl;
      sCusto += r.custo;
      sPool += r.pool;
      sR1 += r.r1;
      sR2 += r.r2;
    }
    const r1a = round2(sR1);
    const r2a = round2(sR2);
    const rTot = round2(r1a + r2a);
    const m = round2(valorBruto - rTot);
    return {
      descontoDeflator: round2(sDes),
      baseDeflada: round2(sBase),
      custoAdm: round2(sCusto),
      poolAposCusto: round2(sPool),
      repasse1: r1a,
      repasse2: r2a,
      repasseTotal: rTot,
      margemCoop: m,
      margemPctBruto: valorBruto > 0.0001 ? (m / valorBruto) * 100 : 0,
    };
  }, [linhasTotais, local, dPct, admPct, r2Pct, valorBruto]);

  const resumoMedicos = useMemo(() => {
    const mapa = new Map<
      string,
      { medico: string; cobranca: number; recebe: number; repasses: Set<string> }
    >();

    const add = (medico: string, cobranca: number, recebe: number, repasse: string) => {
      const atual = mapa.get(medico);
      if (!atual) {
        mapa.set(medico, {
          medico,
          cobranca,
          recebe,
          repasses: new Set([repasse]),
        });
        return;
      }
      atual.cobranca += cobranca;
      atual.recebe += recebe;
      atual.repasses.add(repasse);
    };

    for (const l of linhasTotais) {
      const q = quemRepasseEfetivo(l, local);
      const r = repasseBrutoUmaLinha(l.bruto, dPct, admPct, r2Pct, q);

      if (q.incluirProfissional1) {
        const m1 = rotuloQuem(q.profissional1Nome, q.profissional1Crm);
        if (m1) add(m1, l.bruto, r.r1, '100%');
      }
      if (q.incluirProfissional2) {
        const m2 = rotuloQuem(q.profissional2Nome, q.profissional2Crm);
        if (m2) add(m2, l.bruto, r.r2, `${PCT.format(r2Pct * 100)}%`);
      }
    }

    return Array.from(mapa.values())
      .map((r) => ({
        ...r,
        cobranca: round2(r.cobranca),
        recebe: round2(r.recebe),
        repasseTxt: Array.from(r.repasses).sort().join(' + '),
      }))
      .sort((a, b) => a.medico.localeCompare(b.medico, 'pt-BR', { sensitivity: 'base' }));
  }, [linhasTotais, local, dPct, admPct, r2Pct]);

  const tabelaPacientes = useMemo(() => {
    const fmtData = (iso: string) => {
      if (!iso) return '—';
      const [y, m, d] = iso.split('-');
      if (!y || !m || !d) return iso;
      return `${d}/${m}/${y}`;
    };
    return linhasTotais.map((l) => {
      const q = quemRepasseEfetivo(l, local);
      const medicoPrincipal = q.incluirProfissional1
        ? rotuloQuem(q.profissional1Nome, q.profissional1Crm) ?? '—'
        : '—';
      const medicoAuxiliar = q.incluirProfissional2
        ? rotuloQuem(q.profissional2Nome, q.profissional2Crm) ?? '—'
        : '—';
      return {
        prontuario: l.prontuario?.trim() || '—',
        paciente: l.nomePaciente?.trim() || '—',
        medicoPrincipal,
        medicoAuxiliar,
        dataCirurgia: fmtData(l.dataProcedimento),
      };
    });
  }, [linhasTotais, local]);

  const somaResumoMedicos = useMemo(
    () => round2(resumoMedicos.reduce((acc, r) => acc + r.recebe, 0)),
    [resumoMedicos]
  );
  const timelineMeses = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => ({
        key: String(i + 1).padStart(2, '0'),
        label: mesesNomes[i] ?? '',
        ch: `${ano}-${String(i + 1).padStart(2, '0')}`,
      })),
    [ano]
  );
  const isDone = (c: string) => !!store[c]?.concluido;

  const salvarRascunhoProfsMês = useCallback(() => {
    persist({ ...localRef.current, ...rascunhoProfs });
  }, [rascunhoProfs, persist]);

  const selecionarProcedimentoBase = (b: ProcedimentoBase) => {
    setLinhaPendente((atual) => {
      const base = fromBase(b);
      if (!atual) return base;
      return {
        ...base,
        id: atual.id,
        dataProcedimento: atual.dataProcedimento ?? '',
        nomePaciente: atual.nomePaciente ?? '',
        prontuario: atual.prontuario ?? '',
        quemRepasse: atual.quemRepasse,
      };
    });
    setBusca('');
    setAbrirSugestoes(false);
  };

  const salvarLinhaPendente = useCallback(() => {
    if (!linhaPendente) return;
    if (!lancarRepassePermitido(rascunhoProfs)) {
      window.alert('Indique 1.º e/ou 2.º ativos, nome e CRM de cada ativo, e adicione à tabela.');
      return;
    }
    const L = localRef.current;
    const comRepasse: LinhaProcedimento = { ...linhaPendente, quemRepasse: { ...rascunhoProfs } };
    const limpo = rascunhoNomesVazios(rascunhoProfs);
    const jaExiste = L.procedimentos.some((p) => p.id === comRepasse.id);
    persist({
      ...L,
      procedimentos: jaExiste
        ? L.procedimentos.map((p) => (p.id === comRepasse.id ? comRepasse : p))
        : [...L.procedimentos, comRepasse],
      profissional1Nome: '',
      profissional1Crm: '',
      profissional2Nome: '',
      profissional2Crm: '',
    });
    setRascunhoProfs(limpo);
    setLinhaPendente(null);
    setBusca('');
    requestAnimationFrame(() => {
      document.getElementById('secao-lancamentos-mes')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, [linhaPendente, persist, rascunhoProfs]);

  const remover = (id: string) => {
    const L = localRef.current;
    persist({ ...L, procedimentos: L.procedimentos.filter((l) => l.id !== id) });
  };

  const editar = (id: string) => {
    const L = localRef.current;
    const alvo = L.procedimentos.find((l) => l.id === id);
    if (!alvo) return;
    setLinhaPendente({ ...alvo });
    setRascunhoProfs(quemRepasseEfetivo(alvo, L));
    setBusca('');
    setAbrirSugestoes(false);
    requestAnimationFrame(() => {
      document.getElementById('secao-lancamentos-mes')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const lancPesoTotal = useMemo(() => {
    let s = PESO_COL_LANC.acoes;
    (Object.keys(colsLanc) as ColLancKey[]).forEach((k) => {
      s += colsLanc[k] ? PESO_COL_LANC[k] : PESO_COL_LANC_HEADER_OCULTA;
    });
    return s;
  }, [colsLanc]);

  const lancWidthPct = useCallback(
    (k: 'acoes' | ColLancKey) => {
      if (k === 'acoes') {
        return (PESO_COL_LANC.acoes / lancPesoTotal) * 100;
      }
      return (
        ((colsLanc[k as ColLancKey] ? PESO_COL_LANC[k] : PESO_COL_LANC_HEADER_OCULTA) / lancPesoTotal) * 100
      );
    },
    [colsLanc, lancPesoTotal]
  );

  const toggleLancCol = useCallback((key: ColLancKey) => {
    setColsLanc((c) => {
      const next = { ...c, [key]: !c[key] } as typeof c;
      if (!(Object.keys(next) as ColLancKey[]).some((k) => next[k])) {
        return c;
      }
      return next;
    });
  }, []);

  const toggleResumoCol = useCallback((key: ColResumoKey) => {
    setColsResumo((c) => {
      const next = { ...c, [key]: !c[key] } as typeof c;
      if (!(Object.keys(next) as ColResumoKey[]).some((k) => next[k])) return c;
      return next;
    });
  }, []);

  const algumaColLancDado = useMemo(
    () => (Object.keys(colsLanc) as ColLancKey[]).some((k) => colsLanc[k]),
    [colsLanc]
  );
  const algumaColResumoDado = useMemo(
    () => (Object.keys(colsResumo) as ColResumoKey[]).some((k) => colsResumo[k]),
    [colsResumo]
  );
  const podeExportarVisualizacaoAtual = useMemo(() => {
    if (modoVisualLanc === 'detalhado') return algumaColLancDado;
    if (modoVisualLanc === 'resumo') return algumaColResumoDado;
    return tabelaPacientes.length > 0;
  }, [modoVisualLanc, algumaColLancDado, algumaColResumoDado, tabelaPacientes.length]);

  const exportLancamentosExcel = useCallback(() => {
    if (linhasTotais.length === 0) return;
    if (modoVisualLanc === 'pacientes') {
      const rows = tabelaPacientes.map((r) => ({
        Prontuário: r.prontuario,
        'Nome do paciente': r.paciente,
        'Médico principal': r.medicoPrincipal,
        'Médico auxiliar': r.medicoAuxiliar,
        'Data da cirurgia': r.dataCirurgia,
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Pacientes');
      XLSX.writeFile(wb, `pacientes-cirurgia_${mesChave}.xlsx`);
      return;
    }
    if (modoVisualLanc === 'resumo') {
      const rows = resumoMedicos.map((r) => {
        const o: Record<string, string> = {};
        if (colsResumo.medico) o['Médico'] = r.medico;
        if (colsResumo.repasse) o['Repasse'] = r.repasseTxt;
        if (colsResumo.recebe) o['Valor exato a receber'] = BRL.format(r.recebe);
        return o;
      });
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Produção por médico');
      XLSX.writeFile(wb, `producao-por-medico_${mesChave}.xlsx`);
      return;
    }
    const rotMed = (l: (typeof linhasTotais)[0], qual: 1 | 2) => {
      const q = quemRepasseEfetivo(l, local);
      if (qual === 1) {
        return q.incluirProfissional1 ? rotuloQuem(q.profissional1Nome, q.profissional1Crm) ?? '' : '';
      }
      return q.incluirProfissional2 ? rotuloQuem(q.profissional2Nome, q.profissional2Crm) ?? '' : '';
    };
    const rows: Record<string, string | number>[] = linhasTotais.map((l) => {
      const o: Record<string, string | number> = {};
      if (colsLanc.ins) o['Ins.'] = l.instrumento;
      if (colsLanc.cod1) o['Cód. 1'] = l.codigo1;
      if (colsLanc.proc1) o['1.º procedimento'] = l.nome1;
      if (colsLanc.v1) o['Valor 1'] = l.valorPrimeiro;
      if (colsLanc.rep1) o['1.º no repasse'] = rotMed(l, 1);
      if (colsLanc.cod2) o['Cód. 2'] = l.codigo2;
      if (colsLanc.proc2) o['2.º procedimento'] = l.nome2;
      if (colsLanc.v2) o['Valor 2'] = l.valorSegundo;
      if (colsLanc.rep2) o['2.º no repasse'] = rotMed(l, 2);
      if (colsLanc.bruto) o['Contrib. bruta'] = l.bruto;
      return o;
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Lançamentos');
    XLSX.writeFile(wb, `lancamentos-procedimentos_${mesChave}.xlsx`);
  }, [linhasTotais, local, mesChave, colsLanc, modoVisualLanc, resumoMedicos, colsResumo, tabelaPacientes]);

  const exportLancamentosPdf = useCallback(() => {
    if (linhasTotais.length === 0) return;
    const cel = (s: string) => textoSeguroPdf(s);
    if (modoVisualLanc === 'pacientes') {
      const head = [[
        cel('Prontuário'),
        cel('Nome do paciente'),
        cel('Médico principal'),
        cel('Médico auxiliar'),
        cel('Data da cirurgia'),
      ]];
      const body = tabelaPacientes.map((r) => [
        cel(r.prontuario),
        cel(r.paciente),
        cel(r.medicoPrincipal),
        cel(r.medicoAuxiliar),
        cel(r.dataCirurgia),
      ]);
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      doc.setFontSize(12);
      doc.text(cel('Pacientes da cirurgia'), 10, 10);
      doc.setFontSize(9);
      doc.text(cel(`Referência: ${mesChave}`), 10, 16);
      autoTable(doc, {
        startY: 20,
        head,
        body,
        styles: { fontSize: 7, cellPadding: 1.4, overflow: 'linebreak' },
        headStyles: { fillColor: [51, 65, 85] },
        margin: { left: 10, right: 10 },
      });
      doc.save(`pacientes-cirurgia_${mesChave}.pdf`);
      return;
    }
    if (modoVisualLanc === 'resumo') {
      const head: string[][] = [[]];
      if (colsResumo.medico) head[0].push(cel('Médico'));
      if (colsResumo.repasse) head[0].push(cel('Repasse'));
      if (colsResumo.recebe) head[0].push(cel('Valor exato a receber'));
      const body = resumoMedicos.map((r) => {
        const row: string[] = [];
        if (colsResumo.medico) row.push(cel(r.medico));
        if (colsResumo.repasse) row.push(cel(r.repasseTxt));
        if (colsResumo.recebe) row.push(cel(BRL.format(r.recebe).replace(/\u00a0/g, ' ')));
        return row;
      });
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      doc.setFontSize(12);
      doc.text(cel('Produção por médico'), 10, 10);
      doc.setFontSize(9);
      doc.text(cel(`Referência: ${mesChave}`), 10, 16);
      autoTable(doc, {
        startY: 20,
        head,
        body,
        styles: { fontSize: 7, cellPadding: 1.5, overflow: 'linebreak' },
        headStyles: { fillColor: [51, 65, 85] },
        margin: { left: 10, right: 10 },
      });
      doc.save(`producao-por-medico_${mesChave}.pdf`);
      return;
    }
    const rotMed = (l: (typeof linhasTotais)[0], qual: 1 | 2) => {
      const q = quemRepasseEfetivo(l, local);
      if (qual === 1) {
        return q.incluirProfissional1 ? rotuloQuem(q.profissional1Nome, q.profissional1Crm) ?? '—' : '—';
      }
      return q.incluirProfissional2 ? rotuloQuem(q.profissional2Nome, q.profissional2Crm) ?? '—' : '—';
    };
    const head: string[][] = [[]];
    if (colsLanc.ins) head[0].push(cel('Ins.'));
    if (colsLanc.cod1) head[0].push(cel('Cód. 1'));
    if (colsLanc.proc1) head[0].push(cel('1.º proced.'));
    if (colsLanc.v1) head[0].push(cel('Valor 1'));
    if (colsLanc.rep1) head[0].push(cel('1.º repasse'));
    if (colsLanc.cod2) head[0].push(cel('Cód. 2'));
    if (colsLanc.proc2) head[0].push(cel('2.º proced.'));
    if (colsLanc.v2) head[0].push(cel('Valor 2'));
    if (colsLanc.rep2) head[0].push(cel('2.º repasse'));
    if (colsLanc.bruto) head[0].push(cel('Contrib. bruta'));
    const body = linhasTotais.map((l) => {
      const r: string[] = [];
      if (colsLanc.ins) r.push(cel(l.instrumento));
      if (colsLanc.cod1) r.push(cel(l.codigo1));
      if (colsLanc.proc1) r.push(cel(l.nome1));
      if (colsLanc.v1) r.push(cel(l.valorPrimeiro));
      if (colsLanc.rep1) r.push(cel(rotMed(l, 1)));
      if (colsLanc.cod2) r.push(cel(l.codigo2));
      if (colsLanc.proc2) r.push(cel(l.nome2));
      if (colsLanc.v2) r.push(cel(l.valorSegundo));
      if (colsLanc.rep2) r.push(cel(rotMed(l, 2)));
      if (colsLanc.bruto) r.push(cel(BRL.format(l.bruto).replace(/\u00a0/g, ' ')));
      return r;
    });
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    doc.setFontSize(12);
    doc.text(cel('Lançamentos do mês'), 10, 10);
    doc.setFontSize(9);
    doc.text(cel(`Referência: ${mesChave}`), 10, 16);
    autoTable(doc, {
      startY: 20,
      head,
      body,
      styles: { fontSize: 6.5, cellPadding: 1, overflow: 'linebreak' },
      headStyles: { fillColor: [51, 65, 85] },
      margin: { left: 10, right: 10 },
    });
    doc.save(`lancamentos-procedimentos_${mesChave}.pdf`);
  }, [linhasTotais, local, mesChave, colsLanc, modoVisualLanc, resumoMedicos, colsResumo, tabelaPacientes]);

  if (!isMaster) {
    return (
      <div className="card border-l-4 border-red-400 max-w-2xl mx-auto">
        <h2 className="text-lg font-bold text-viva-900">Acesso restrito</h2>
      </div>
    );
  }

  return (
    <div className="max-w-[92rem] mx-auto space-y-5 pb-10 px-2 sm:px-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-viva-900 font-display">Relatório de procedimentos</h1>
        </div>
        <button type="button" onClick={abrirParametros} className="btn btn-primary shrink-0 w-full sm:w-auto">
          Parâmetros do cálculo
        </button>
      </div>

      <div className="rounded-2xl border border-viva-200/70 bg-white shadow-[var(--card-shadow)] overflow-hidden">
        <div className="flex items-center justify-between gap-2 px-4 py-2.5 bg-viva-50/40 border-b border-viva-200/50">
          <span className="text-[11px] font-semibold uppercase tracking-widest text-viva-500 font-display">Mês de referência</span>
          <div className="flex items-center gap-2 text-sm text-viva-800">
            <span className="text-viva-500">Ano</span>
            <select
              className="input w-auto min-w-[96px] py-1 text-sm h-8"
              value={ano}
              onChange={(e) => setAno(parseInt(e.target.value, 10) || hoje.getFullYear())}
            >
              {Array.from({ length: 11 }, (_, i) => hoje.getFullYear() - 2 + i).map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="px-2 sm:px-3 py-3">
          <div className="relative mx-auto max-w-5xl">
            <div className="pointer-events-none absolute left-2 right-2 top-4 h-px bg-viva-200/80" />
            <div className="relative flex items-start justify-between gap-1 overflow-x-auto pb-1">
            {timelineMeses.map((m) => {
              const at = m.key === mesMM;
              const ok = isDone(m.ch);
              return (
                <button
                  type="button"
                  key={m.key}
                  onClick={() => setMesMM(m.key)}
                  className={[
                    'group relative min-w-[52px] sm:min-w-[58px] shrink-0 rounded-xl px-1.5 py-1',
                    'flex flex-col items-center font-display font-bold transition',
                    at ? 'bg-white/95 text-viva-900 shadow-sm' : 'text-viva-500 hover:bg-viva-50/70 hover:text-viva-700',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  <span
                    className={[
                      'block h-3 w-3 rounded-full border-2 transition',
                      ok ? 'border-emerald-500 bg-emerald-500' : 'border-slate-400/90 bg-slate-400/85',
                      at ? 'ring-2 ring-viva-300/80 ring-offset-1 ring-offset-white' : '',
                    ].join(' ')}
                    title={ok ? 'Concluído' : 'Em aberto'}
                  />
                  <span
                    className={[
                      'mt-1.5 block capitalize leading-tight text-[11px] sm:text-xs',
                      at ? 'text-viva-900' : 'text-viva-500 group-hover:text-viva-700',
                    ].join(' ')}
                  >
                    {m.label}
                  </span>
                </button>
              );
            })}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-viva-200/60 bg-white overflow-hidden shadow-[var(--card-shadow)]">
        <div className="p-4 sm:p-5 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold text-viva-900 font-display">Quem recebe o repasse</h2>
            {errMedicos && (
              <p className="text-xs text-amber-800 mt-1">Não foi possível carregar a lista de médicos. Tente de novo.</p>
            )}
          </div>
          <button
            type="button"
            className="btn btn-primary btn-sm shrink-0"
            onClick={salvarRascunhoProfsMês}
          >
            Salvar identificação
          </button>
          </div>
          <div className="rounded-xl border border-viva-200/70 bg-white/80 p-3 sm:p-3.5">
            <p className="text-[10px] font-semibold uppercase text-viva-500 font-display mb-2">Dados do procedimento</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div>
                <label className="text-[10px] font-semibold uppercase text-viva-500 font-display">Data</label>
                <input
                  type="date"
                  className="input w-full h-8 text-xs mt-0.5"
                  value={linhaPendente?.dataProcedimento ?? ''}
                  onChange={(e) =>
                    setLinhaPendente((lp) => ({
                      ...(lp ?? linhaPendenteVazia()),
                      dataProcedimento: e.target.value,
                    }))
                  }
                />
              </div>
              <div>
                <label className="text-[10px] font-semibold uppercase text-viva-500 font-display">Paciente</label>
                <input
                  className="input w-full h-8 text-xs mt-0.5"
                  placeholder="Nome do paciente"
                  value={linhaPendente?.nomePaciente ?? ''}
                  onChange={(e) =>
                    setLinhaPendente((lp) => ({
                      ...(lp ?? linhaPendenteVazia()),
                      nomePaciente: e.target.value,
                    }))
                  }
                />
              </div>
              <div>
                <label className="text-[10px] font-semibold uppercase text-viva-500 font-display">Prontuário</label>
                <input
                  className="input w-full h-8 text-xs mt-0.5"
                  placeholder="Número do prontuário"
                  value={linhaPendente?.prontuario ?? ''}
                  onChange={(e) =>
                    setLinhaPendente((lp) => ({
                      ...(lp ?? linhaPendenteVazia()),
                      prontuario: e.target.value,
                    }))
                  }
                />
              </div>
            </div>
          </div>
          <div className="space-y-3">
          <div
            className={`rounded-xl border p-3 sm:p-3.5 grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-3 ${
              rascunhoProfs.incluirProfissional1 ? 'border-viva-200/80 bg-viva-50/25' : 'border-viva-200/50 bg-stone-50/40'
            }`}
          >
            <label className="inline-flex sm:flex sm:flex-col sm:items-start sm:pt-0.5 items-center gap-2.5 text-sm text-viva-800 font-medium shrink-0">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-viva-300 text-viva-800"
                checked={rascunhoProfs.incluirProfissional1}
                onChange={(e) => {
                  setRascunhoProfs((p) => {
                    const next: RascunhoProfsT = { ...p, incluirProfissional1: e.target.checked };
                    persist({ ...localRef.current, ...next });
                    return next;
                  });
                }}
              />
              <span>1.º</span>
            </label>
            <div className="space-y-2 min-w-0">
              <div ref={boxMed1Ref} className="relative" onClick={(e) => e.stopPropagation()}>
                <label className="text-[10px] font-semibold uppercase text-viva-500 font-display">Buscar no corpo clínico</label>
                <input
                  className="input w-full h-8 text-xs mt-0.5"
                  placeholder="Filtrar por nome ou CRM — ou deixe vazio para listar todos"
                  value={medBusca1}
                  onChange={(e) => {
                    setMedBusca1(e.target.value);
                    setMedAbrir1(true);
                  }}
                  onFocus={() => setMedAbrir1(true)}
                />
                {medAbrir1 && (
                  <ul className="absolute z-30 mt-1 w-full min-w-0 max-h-64 overflow-y-auto rounded-lg border border-viva-200 bg-white text-xs shadow-lg">
                    {carregandoMedicos ? (
                      <li className="px-2 py-2.5 text-viva-500">A carregar o corpo clínico…</li>
                    ) : errMedicos ? (
                      <li className="px-2 py-2.5 text-amber-800">Erro ao carregar a lista.</li>
                    ) : sugestoesMedicos1.length === 0 ? (
                      <li className="px-2 py-2.5 text-viva-500">Nenhum profissional{medBusca1.trim() ? ' com este filtro' : ''}.</li>
                    ) : (
                      <>
                        {sugestoesMedicos1.map((m) => (
                          <li key={m.id}>
                            <button
                              type="button"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => {
                                setRascunhoProfs((p) => {
                                  const next: RascunhoProfsT = {
                                    ...p,
                                    profissional1Nome: m.nomeCompleto,
                                    profissional1Crm: m.crm ?? '',
                                  };
                                  persist({ ...localRef.current, ...next });
                                  return next;
                                });
                                setMedAbrir1(false);
                                setMedBusca1('');
                              }}
                              className="w-full text-left px-2 py-2 hover:bg-viva-50"
                            >
                              {m.nomeCompleto}
                              {m.crm && <span className="text-viva-500"> · {m.crm}</span>}
                            </button>
                          </li>
                        ))}
                      </>
                    )}
                  </ul>
                )}
              </div>
              {rascunhoProfs.incluirProfissional1 ? (
                (() => {
                  const rot = rotuloQuem(rascunhoProfs.profissional1Nome, rascunhoProfs.profissional1Crm);
                  return rot ? (
                    <div className="mt-1.5 rounded-lg border border-emerald-200/80 bg-emerald-50/90 px-2.5 py-2 text-xs text-viva-800">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-[10px] font-bold uppercase text-emerald-800/90 font-display">1.º no próximo lançamento</p>
                        <button
                          type="button"
                          className="text-[10px] font-display font-semibold underline text-emerald-800/90 hover:text-emerald-900"
                          onClick={() => {
                            setRascunhoProfs((p) => {
                              const next: RascunhoProfsT = { ...p, profissional1Nome: '', profissional1Crm: '' };
                              persist({ ...localRef.current, ...next });
                              return next;
                            });
                          }}
                        >
                          Excluir seleção
                        </button>
                      </div>
                      <p className="mt-0.5 font-serif leading-snug">{rot}</p>
                    </div>
                  ) : (
                    <p className="text-xs text-amber-800/90 mt-1.5">Selecione o 1.º profissional.</p>
                  );
                })()
              ) : (
                <p className="text-xs text-stone-500 mt-1">1.º: inativo</p>
              )}
            </div>
          </div>
          <div
            className={`rounded-xl border p-3 sm:p-3.5 grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-3 ${
              rascunhoProfs.incluirProfissional2 ? 'border-viva-200/80 bg-viva-50/25' : 'border-viva-200/50 bg-stone-50/40'
            }`}
          >
            <label className="inline-flex sm:flex sm:flex-col sm:items-start sm:pt-0.5 items-center gap-2.5 text-sm text-viva-800 font-medium shrink-0">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-viva-300 text-viva-800"
                checked={rascunhoProfs.incluirProfissional2}
                onChange={(e) => {
                  setRascunhoProfs((p) => {
                    const next: RascunhoProfsT = { ...p, incluirProfissional2: e.target.checked };
                    persist({ ...localRef.current, ...next });
                    return next;
                  });
                }}
              />
              <span>2.º</span>
            </label>
            <div className="space-y-2 min-w-0">
              <div ref={boxMed2Ref} className="relative" onClick={(e) => e.stopPropagation()}>
                <label className="text-[10px] font-semibold uppercase text-viva-500 font-display">Buscar no corpo clínico</label>
                <input
                  className="input w-full h-8 text-xs mt-0.5"
                  placeholder="Filtrar por nome ou CRM — ou deixe vazio para listar todos"
                  value={medBusca2}
                  onChange={(e) => {
                    setMedBusca2(e.target.value);
                    setMedAbrir2(true);
                  }}
                  onFocus={() => setMedAbrir2(true)}
                />
                {medAbrir2 && (
                  <ul className="absolute z-30 mt-1 w-full min-w-0 max-h-64 overflow-y-auto rounded-lg border border-viva-200 bg-white text-xs shadow-lg">
                    {carregandoMedicos ? (
                      <li className="px-2 py-2.5 text-viva-500">A carregar o corpo clínico…</li>
                    ) : errMedicos ? (
                      <li className="px-2 py-2.5 text-amber-800">Erro ao carregar a lista.</li>
                    ) : sugestoesMedicos2.length === 0 ? (
                      <li className="px-2 py-2.5 text-viva-500">Nenhum profissional{medBusca2.trim() ? ' com este filtro' : ''}.</li>
                    ) : (
                      <>
                        {sugestoesMedicos2.map((m) => (
                          <li key={m.id}>
                            <button
                              type="button"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => {
                                setRascunhoProfs((p) => {
                                  const next: RascunhoProfsT = {
                                    ...p,
                                    profissional2Nome: m.nomeCompleto,
                                    profissional2Crm: m.crm ?? '',
                                  };
                                  persist({ ...localRef.current, ...next });
                                  return next;
                                });
                                setMedAbrir2(false);
                                setMedBusca2('');
                              }}
                              className="w-full text-left px-2 py-2 hover:bg-viva-50"
                            >
                              {m.nomeCompleto}
                              {m.crm && <span className="text-viva-500"> · {m.crm}</span>}
                            </button>
                          </li>
                        ))}
                      </>
                    )}
                  </ul>
                )}
              </div>
              {rascunhoProfs.incluirProfissional2 ? (
                (() => {
                  const rot = rotuloQuem(rascunhoProfs.profissional2Nome, rascunhoProfs.profissional2Crm);
                  return rot ? (
                    <div className="mt-1.5 rounded-lg border border-emerald-200/80 bg-emerald-50/90 px-2.5 py-2 text-xs text-viva-800">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-[10px] font-bold uppercase text-emerald-800/90 font-display">2.º no próximo lançamento</p>
                        <button
                          type="button"
                          className="text-[10px] font-display font-semibold underline text-emerald-800/90 hover:text-emerald-900"
                          onClick={() => {
                            setRascunhoProfs((p) => {
                              const next: RascunhoProfsT = { ...p, profissional2Nome: '', profissional2Crm: '' };
                              persist({ ...localRef.current, ...next });
                              return next;
                            });
                          }}
                        >
                          Excluir seleção
                        </button>
                      </div>
                      <p className="mt-0.5 font-serif leading-snug">{rot}</p>
                    </div>
                  ) : (
                    <p className="text-xs text-amber-800/90 mt-1.5">Selecione o 2.º profissional.</p>
                  );
                })()
              ) : (
                <p className="text-xs text-stone-500 mt-1">2.º: inativo</p>
              )}
            </div>
          </div>
          </div>
        </div>
        {!rascunhoProfs.incluirProfissional1 && !rascunhoProfs.incluirProfissional2 && (
          <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200/80 rounded-xl mx-4 sm:mx-5 mb-0 px-4 py-2.5 font-serif">
            Nenhum 1.º/2.º ativo. Ative no mínimo um.
          </p>
        )}
        <div
          className="px-4 sm:px-5 py-4 sm:py-5 border-t border-viva-200/50 bg-gradient-to-b from-amber-50/25 to-amber-50/5"
          ref={boxBuscaRef}
          onClick={(e) => e.stopPropagation()}
        >
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-viva-900 font-display">Procedimentos</h2>
          <button
            type="button"
            className="btn btn-secondary btn-sm font-display shrink-0"
            onClick={() => setModalBaseProcedimentos(true)}
          >
            Ver base de procedimentos
          </button>
        </div>
        <div className="relative">
          <input
            className="input w-full pl-3 pr-10 h-10 text-sm"
            placeholder="Ex.: C1, clavícula, 04.08.01.010"
            value={busca}
            onChange={(e) => {
              setBusca(e.target.value);
              setAbrirSugestoes(true);
            }}
            onFocus={() => setAbrirSugestoes(true)}
          />
          {busca && (
            <button
              type="button"
              className="absolute right-1 top-1/2 -translate-y-1/2 w-8 h-8 text-viva-500 hover:text-viva-800"
              onClick={() => setBusca('')}
            >
              ×
            </button>
          )}
          {abrirSugestoes && busca.trim().length >= 2 && sugestoes.length > 0 && (
            <ul
              className="absolute z-20 mt-1 w-full max-h-56 overflow-y-auto rounded-xl border border-viva-200 bg-white py-1 shadow-lg"
            >
              {sugestoes.map((b) => (
                <li key={b.id}>
                  <button
                    type="button"
                    onClick={() => selecionarProcedimentoBase(b)}
                    className="w-full text-left px-3 py-2.5 text-xs sm:text-sm hover:bg-viva-50 border-b border-viva-100/80 last:border-0"
                  >
                    <span className="font-mono text-amber-900/90 font-medium">{b.instrumento}</span>
                    <span className="text-viva-500 mx-1">|</span>
                    <span className="text-viva-800">
                      {b.nome1.slice(0, 56)}
                      {b.nome1.length > 56 ? '…' : ''}
                      {' '}
                      <span className="text-viva-500">|</span>
                      {' '}
                      {b.nome2.slice(0, 56)}
                      {b.nome2.length > 56 ? '…' : ''}
                    </span>
                    <span className="block text-viva-500 text-[10px] mt-0.5 pl-0 font-serif">{b.codigo1}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        {linhaPendente && (
          <div className="mt-4 rounded-xl border-2 border-dashed border-amber-400/80 bg-amber-50/40 p-3 sm:p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <h3 className="text-sm font-bold text-viva-900 font-display">Pré-visualização</h3>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2 text-xs">
              <div className="rounded-lg border border-viva-200/70 bg-white px-2 py-1.5">
                <p className="text-[10px] text-viva-500 font-display uppercase">Ins.</p>
                <p className="text-viva-900 font-medium mt-0.5 [overflow-wrap:anywhere]">{linhaPendente.instrumento || '—'}</p>
              </div>
              <div className="rounded-lg border border-viva-200/70 bg-white px-2 py-1.5">
                <p className="text-[10px] text-viva-500 font-display uppercase">Cód. 1</p>
                <p className="text-viva-900 font-medium mt-0.5 [overflow-wrap:anywhere]">{linhaPendente.codigo1 || '—'}</p>
              </div>
              <div className="rounded-lg border border-viva-200/70 bg-white px-2 py-1.5 col-span-2">
                <p className="text-[10px] text-viva-500 font-display uppercase">1.º procedimento</p>
                <p className="text-viva-900 font-medium mt-0.5 [overflow-wrap:anywhere]">{linhaPendente.nome1 || '—'}</p>
              </div>
              <div className="rounded-lg border border-viva-200/70 bg-white px-2 py-1.5">
                <p className="text-[10px] text-viva-500 font-display uppercase">R$ 1</p>
                <p className="text-viva-900 font-mono tabular-nums mt-0.5 text-right">{linhaPendente.valorPrimeiro || '0,00'}</p>
              </div>
              <div className="rounded-lg border border-viva-200/70 bg-white px-2 py-1.5">
                <p className="text-[10px] text-viva-500 font-display uppercase">Cód. 2</p>
                <p className="text-viva-900 font-medium mt-0.5 [overflow-wrap:anywhere]">{linhaPendente.codigo2 || '—'}</p>
              </div>
              <div className="rounded-lg border border-viva-200/70 bg-white px-2 py-1.5 col-span-2">
                <p className="text-[10px] text-viva-500 font-display uppercase">2.º procedimento</p>
                <p className="text-viva-900 font-medium mt-0.5 [overflow-wrap:anywhere]">{linhaPendente.nome2 || '—'}</p>
              </div>
              <div className="rounded-lg border border-viva-200/70 bg-white px-2 py-1.5">
                <p className="text-[10px] text-viva-500 font-display uppercase">R$ 2</p>
                <p className="text-viva-900 font-mono tabular-nums mt-0.5 text-right">{linhaPendente.valorSegundo || '0,00'}</p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-mono text-viva-800">
                Contrib. bruta:{' '}
                {BRL.format(
                  round2(
                    parseBrl(linhaPendente.valorPrimeiro) + 0.5 * parseBrl(linhaPendente.valorSegundo)
                  )
                )}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    if (linhaPendente) {
                      if (!window.confirm('Descartar esta linha?')) return;
                    }
                    setLinhaPendente(null);
                  }}
                >
                  Descartar
                </button>
                <button type="button" className="btn btn-primary btn-sm" onClick={salvarLinhaPendente}>
                  {linhaPendente && local.procedimentos.some((p) => p.id === linhaPendente.id)
                    ? 'Salvar edição'
                    : 'Incluir na tabela de lançamentos'}
                </button>
              </div>
            </div>
          </div>
        )}
        </div>
      </div>

      <div
        className="rounded-2xl border border-viva-200/60 bg-white overflow-hidden shadow-[var(--card-shadow)]"
        id="secao-lancamentos-mes"
      >
        <div className="px-4 py-3 border-b border-viva-200/50 bg-viva-50/30">
          <h2 className="text-sm font-bold text-viva-900 font-display">Lançamentos do mês</h2>
        </div>
        {linhasTotais.length === 0 ? (
          <p className="p-6 text-sm text-viva-600 text-center font-serif">Nada lançado.</p>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2 px-3 sm:px-4 py-2.5 border-b border-viva-200/50 bg-viva-50/25 text-[11px] sm:text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className={`btn btn-sm font-display ${
                    modoVisualLanc === 'detalhado' ? 'btn-primary' : 'btn-secondary'
                  }`}
                  onClick={() => setModoVisualLanc('detalhado')}
                  aria-pressed={modoVisualLanc === 'detalhado'}
                >
                  Detalhado
                </button>
                <button
                  type="button"
                  className={`btn btn-sm font-display ${
                    modoVisualLanc === 'resumo' ? 'btn-primary' : 'btn-secondary'
                  }`}
                  onClick={() => setModoVisualLanc('resumo')}
                  aria-pressed={modoVisualLanc === 'resumo'}
                >
                  Produção por médico
                </button>
                <button
                  type="button"
                  className={`btn btn-sm font-display ${
                    modoVisualLanc === 'pacientes' ? 'btn-primary' : 'btn-secondary'
                  }`}
                  onClick={() => setModoVisualLanc('pacientes')}
                  aria-pressed={modoVisualLanc === 'pacientes'}
                >
                  Pacientes
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-2 ml-auto">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm font-display"
                  disabled={!podeExportarVisualizacaoAtual}
                  onClick={exportLancamentosExcel}
                  title={!podeExportarVisualizacaoAtual ? 'Sem dados para exportar' : 'Exportar Excel'}
                >
                  Excel
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm font-display"
                  disabled={!podeExportarVisualizacaoAtual}
                  onClick={exportLancamentosPdf}
                  title={!podeExportarVisualizacaoAtual ? 'Sem dados para exportar' : 'Exportar PDF'}
                >
                  PDF
                </button>
              </div>
            </div>
            {modoVisualLanc === 'detalhado' && !algumaColLancDado && (
              <p className="px-3 sm:px-4 py-2 text-xs text-amber-800 bg-amber-50/80 border-b border-amber-200/80 font-serif">
                Nenhuma coluna visível. Ative no cabeçalho com o ícone de olho.
              </p>
            )}
            {modoVisualLanc === 'resumo' && !algumaColResumoDado && (
              <p className="px-3 sm:px-4 py-2 text-xs text-amber-800 bg-amber-50/80 border-b border-amber-200/80 font-serif">
                Nenhuma coluna visível. Ative no cabeçalho com o ícone de olho.
              </p>
            )}
            {modoVisualLanc === 'detalhado' ? (
            <div className="w-full min-w-0 max-w-full rounded-b-lg overflow-auto max-h-[68vh] px-1 sm:px-2 pb-1">
              <table
                className="w-full min-w-[1550px] table-fixed border-collapse text-left text-[9px] sm:text-[11px] [word-break:break-word]"
                id="tabela-lancamentos-mes"
              >
                <colgroup>
                  <col style={{ width: `${lancWidthPct('acoes')}%` }} />
                  <col style={{ width: '3.8%' }} />
                  <col style={{ width: '6.8%' }} />
                  {LANC_COL_ORDER.map((k) => (
                    <col key={k} style={{ width: `${lancWidthPct(k)}%` }} />
                  ))}
                </colgroup>
                <thead>
                  <tr className="bg-slate-800/95 text-white text-[8px] sm:text-[9px] font-display">
                    <th className="py-1 px-0.5 sm:px-1 align-bottom font-medium">—</th>
                    <th className="py-1 px-0.5 sm:px-1 align-bottom font-medium text-center">#</th>
                    <th className="py-1 px-0.5 sm:px-1 align-bottom font-medium text-center">Data</th>
                    {LANC_TH.map(({ key, label, thTitle, borderL }) => {
                      const vis = colsLanc[key];
                      return (
                        <th
                          key={key}
                          className={[
                            'px-0.5 sm:px-1 align-bottom font-medium min-w-0',
                            'py-1',
                            borderL ? 'border-l border-slate-600/60' : '',
                            (key === 'rep1' || key === 'rep2') && vis ? 'text-left' : '',
                            !vis ? 'text-center bg-slate-700/55 text-slate-300' : '',
                          ]
                            .filter(Boolean)
                            .join(' ')}
                          title={vis ? thTitle ?? label : 'Mostrar coluna'}
                        >
                          <div
                            className={[
                              'flex min-w-0 items-center gap-0.5',
                              vis ? 'justify-between' : 'justify-center',
                            ].join(' ')}
                          >
                            <span
                                className={[
                                  'flex-1 min-w-0 leading-tight [overflow-wrap:anywhere]',
                                vis ? 'text-left' : 'text-center text-slate-300',
                              ].join(' ')}
                            >
                              {label}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleLancCol(key);
                              }}
                              className="shrink-0 rounded p-0.5 text-slate-200 transition hover:bg-slate-600/70 hover:text-white"
                              title={vis ? 'Ocultar coluna' : 'Mostrar coluna'}
                              aria-pressed={vis}
                            >
                              {vis ? <IconEye className="h-3 w-3" /> : <IconEyeOff className="h-3 w-3" />}
                            </button>
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {linhasTotais.map((l, i) => (
                    <tr key={l.id} className={i % 2 ? 'bg-viva-50/20' : 'bg-white border-t border-slate-100/90'}>
                      <td className="p-0.5 sm:p-1 align-middle min-w-0">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => editar(l.id)}
                            className="text-viva-700 text-xs w-7 h-7 rounded hover:bg-viva-50 shrink-0 inline-flex items-center justify-center"
                            title="Editar"
                            aria-label="Editar"
                          >
                            <IconPencil className="h-3 w-3 shrink-0" />
                          </button>
                          <button
                            type="button"
                            onClick={() => remover(l.id)}
                            className="text-rose-600 text-xs w-7 h-7 rounded hover:bg-rose-50 shrink-0 inline-flex items-center justify-center"
                            title="Excluir"
                            aria-label="Excluir"
                          >
                            ×
                          </button>
                        </div>
                      </td>
                      <td className="p-0.5 sm:p-1 align-middle min-w-0">
                        <div className="w-full min-w-0 max-w-full h-6 flex items-center justify-center text-[9px] sm:text-[10px] font-semibold text-viva-900 py-0 px-0.5">
                          {i + 1}
                        </div>
                      </td>
                      <td className="p-0.5 sm:p-1 align-middle min-w-0">
                        <div className="w-full min-w-0 max-w-full h-6 flex items-center justify-center text-[9px] sm:text-[10px] text-viva-900 py-0 px-0.5">
                          {formatarDataISO(l.dataProcedimento)}
                        </div>
                      </td>
                      {LANC_COL_ORDER.map((k) => {
                        if (!colsLanc[k]) {
                          return (
                            <td
                              key={k}
                              className="p-0.5 sm:p-1 align-middle min-w-0 bg-slate-100/95 text-slate-400"
                            >
                              <div className="w-full min-h-6 flex items-center justify-center text-[9px] sm:text-[10px] font-display">
                                Oculta
                              </div>
                            </td>
                          );
                        }
                        if (k === 'ins') {
                          return (
                            <td key={k} className="p-0.5 sm:p-1 align-middle min-w-0">
                              <div className="w-full min-w-0 max-w-full min-h-6 flex items-center text-[9px] sm:text-[10px] text-viva-900 py-0 px-0.5 [overflow-wrap:anywhere]">
                                {l.instrumento}
                              </div>
                            </td>
                          );
                        }
                        if (k === 'cod1') {
                          return (
                            <td key={k} className="p-0.5 sm:p-1 align-middle min-w-0">
                              <div className="w-full min-w-0 max-w-full min-h-6 flex items-center text-[9px] sm:text-[10px] text-viva-900 py-0 px-0.5 [overflow-wrap:anywhere]">
                                {l.codigo1}
                              </div>
                            </td>
                          );
                        }
                        if (k === 'proc1') {
                          return (
                            <td key={k} className="p-0.5 sm:p-1 align-top min-w-0">
                              <div className="w-full min-w-0 max-w-full min-h-[1.6rem] py-0.5 text-[9px] sm:text-[10px] leading-tight text-viva-900 [overflow-wrap:anywhere]">
                                {l.nome1}
                              </div>
                            </td>
                          );
                        }
                        if (k === 'v1') {
                          return (
                            <td key={k} className="p-0.5 sm:p-1 align-middle min-w-0">
                              <div className="w-full min-w-0 max-w-full h-6 flex items-center justify-end text-[9px] sm:text-[10px] text-right tabular-nums text-viva-900 py-0 px-0.5">
                                {l.valorPrimeiro}
                              </div>
                            </td>
                          );
                        }
                        if (k === 'rep1') {
                          return (
                            <td
                              key={k}
                              className="p-0.5 sm:p-1 text-[8px] sm:text-[9px] text-viva-800 font-serif border-l border-slate-200/80 align-middle min-w-0 [overflow-wrap:anywhere]"
                            >
                              {(() => {
                                const q = quemRepasseEfetivo(l, local);
                                return q.incluirProfissional1
                                  ? rotuloQuem(q.profissional1Nome, q.profissional1Crm) ?? '—'
                                  : '—';
                              })()}
                            </td>
                          );
                        }
                        if (k === 'cod2') {
                          return (
                            <td key={k} className="p-0.5 sm:p-1 align-middle min-w-0">
                              <div className="w-full min-w-0 max-w-full min-h-6 flex items-center text-[9px] sm:text-[10px] text-viva-900 py-0 px-0.5 [overflow-wrap:anywhere]">
                                {l.codigo2}
                              </div>
                            </td>
                          );
                        }
                        if (k === 'proc2') {
                          return (
                            <td key={k} className="p-0.5 sm:p-1 align-top min-w-0">
                              <div className="w-full min-w-0 max-w-full min-h-[1.6rem] py-0.5 text-[9px] sm:text-[10px] leading-tight text-viva-900 [overflow-wrap:anywhere]">
                                {l.nome2}
                              </div>
                            </td>
                          );
                        }
                        if (k === 'v2') {
                          return (
                            <td key={k} className="p-0.5 sm:p-1 align-middle min-w-0">
                              <div className="w-full min-w-0 max-w-full h-6 flex items-center justify-end text-[9px] sm:text-[10px] text-right tabular-nums text-viva-900 py-0 px-0.5">
                                {l.valorSegundo}
                              </div>
                            </td>
                          );
                        }
                        if (k === 'rep2') {
                          return (
                            <td
                              key={k}
                              className="p-0.5 sm:p-1 text-[8px] sm:text-[9px] text-viva-800 font-serif align-middle min-w-0 [overflow-wrap:anywhere]"
                            >
                              {(() => {
                                const q = quemRepasseEfetivo(l, local);
                                return q.incluirProfissional2
                                  ? rotuloQuem(q.profissional2Nome, q.profissional2Crm) ?? '—'
                                  : '—';
                              })()}
                            </td>
                          );
                        }
                        return (
                          <td
                            key={k}
                            className="p-0.5 sm:p-1 font-mono text-[9px] sm:text-[10px] font-bold text-viva-800 tabular-nums text-right align-middle min-w-0"
                          >
                            {BRL.format(l.bruto)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            ) : modoVisualLanc === 'resumo' ? (
              <div className="px-3 sm:px-4 py-3">
                <div className="overflow-x-auto rounded-xl border border-viva-200/60">
                  <table className="min-w-[700px] w-full text-xs sm:text-sm">
                    <thead>
                      <tr className="bg-slate-800/95 text-white font-display text-[10px] sm:text-xs">
                        {RESUMO_TH.map(({ key, label, align }) => {
                          const vis = colsResumo[key];
                          return (
                            <th
                              key={key}
                              className={[
                                'px-3 py-2.5',
                                vis
                                  ? align === 'right'
                                    ? 'text-right'
                                    : align === 'center'
                                      ? 'text-center'
                                      : 'text-left'
                                  : 'text-center bg-slate-700/55 text-slate-300',
                              ].join(' ')}
                              title={vis ? label : 'Mostrar coluna'}
                            >
                              <div
                                className={[
                                  'flex items-center gap-1',
                                  vis ? (align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : 'justify-between') : 'justify-center',
                                ].join(' ')}
                              >
                                <span className={vis ? 'leading-tight' : 'leading-tight text-slate-300'}>{label}</span>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleResumoCol(key);
                                  }}
                                  className="shrink-0 rounded p-0.5 text-slate-200 transition hover:bg-slate-600/70 hover:text-white"
                                  title={vis ? 'Ocultar coluna' : 'Mostrar coluna'}
                                  aria-pressed={vis}
                                >
                                  {vis ? <IconEye className="h-3.5 w-3.5" /> : <IconEyeOff className="h-3.5 w-3.5" />}
                                </button>
                              </div>
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody className="text-viva-800">
                      {resumoMedicos.map((r, i) => (
                        <tr key={r.medico} className={i % 2 ? 'bg-viva-50/25' : 'bg-white border-t border-slate-100/90'}>
                          {colsResumo.medico ? (
                            <td className="px-3 py-2 font-serif [overflow-wrap:anywhere]">{r.medico}</td>
                          ) : (
                            <td className="px-3 py-2 text-center font-display text-slate-400 bg-slate-100/95">Oculta</td>
                          )}
                          {colsResumo.repasse ? (
                            <td className="px-3 py-2 text-center font-display font-semibold text-viva-700">{r.repasseTxt}</td>
                          ) : (
                            <td className="px-3 py-2 text-center font-display text-slate-400 bg-slate-100/95">Oculta</td>
                          )}
                          {colsResumo.recebe ? (
                            <td className="px-3 py-2 text-right font-mono font-bold tabular-nums text-viva-900">
                              {BRL.format(r.recebe)}
                            </td>
                          ) : (
                            <td className="px-3 py-2 text-center font-display text-slate-400 bg-slate-100/95">Oculta</td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="px-3 sm:px-4 py-3">
                <div className="overflow-x-auto rounded-xl border border-viva-200/60">
                  <table className="min-w-[860px] w-full text-xs sm:text-sm">
                    <thead>
                      <tr className="bg-slate-800/95 text-white font-display text-[10px] sm:text-xs">
                        <th className="px-3 py-2.5 text-left">Prontuário</th>
                        <th className="px-3 py-2.5 text-left">Nome do paciente</th>
                        <th className="px-3 py-2.5 text-left">Médico principal</th>
                        <th className="px-3 py-2.5 text-left">Médico auxiliar</th>
                        <th className="px-3 py-2.5 text-left">Data da cirurgia</th>
                      </tr>
                    </thead>
                    <tbody className="text-viva-800">
                      {tabelaPacientes.map((r, i) => (
                        <tr key={`${r.prontuario}-${r.paciente}-${i}`} className={i % 2 ? 'bg-viva-50/25' : 'bg-white border-t border-slate-100/90'}>
                          <td className="px-3 py-2 font-mono tabular-nums">{r.prontuario}</td>
                          <td className="px-3 py-2 font-serif [overflow-wrap:anywhere]">{r.paciente}</td>
                          <td className="px-3 py-2 font-serif [overflow-wrap:anywhere]">{r.medicoPrincipal}</td>
                          <td className="px-3 py-2 font-serif [overflow-wrap:anywhere]">{r.medicoAuxiliar}</td>
                          <td className="px-3 py-2 font-mono tabular-nums">{r.dataCirurgia}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
        {linhasTotais.length > 0 && (
          <div className="flex items-center justify-end gap-2 px-4 py-2 border-t border-viva-200/60 bg-viva-50/20">
            {modoVisualLanc === 'pacientes' ? (
              <>
                <span className="text-xs text-viva-500 font-serif">Total de registros</span>
                <span className="text-lg font-bold text-viva-900 font-mono tabular-nums">
                  {tabelaPacientes.length}
                </span>
              </>
            ) : (
              <>
                <span className="text-xs text-viva-500 font-serif">Soma</span>
                <span className="text-lg font-bold text-viva-900 font-mono tabular-nums">
                  {BRL.format(modoVisualLanc === 'resumo' ? somaResumoMedicos : valorBruto)}
                </span>
              </>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { t: 'Valor cobrança', v: BRL.format(valorBruto) },
          { t: 'Base deflatada', v: BRL.format(baseDeflada) },
          { t: 'Repasse total', v: BRL.format(repasseTotal) },
          { t: 'Margem coop.', v: BRL.format(margemCoop) },
        ].map((c) => (
          <div key={c.t} className="rounded-2xl border border-viva-200/50 bg-gradient-to-b from-viva-50/40 to-white p-3">
            <p className="text-[10px] font-semibold uppercase text-viva-500 font-display tracking-wide">{c.t}</p>
            <p className="text-sm sm:text-base font-bold text-viva-900 font-mono tabular-nums mt-0.5">{c.v}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-end">
        <button
          type="button"
          className="text-sm text-viva-800 underline font-display"
          onClick={() => {
            const vis = local.mostrarDetalheCalculo !== false;
            persist({ ...local, mostrarDetalheCalculo: !vis });
          }}
        >
          {local.mostrarDetalheCalculo !== false ? 'Ocultar detalhe do cálculo' : 'Mostrar detalhe do cálculo'}
        </button>
      </div>

      {local.mostrarDetalheCalculo !== false && (
      <div className="rounded-2xl border border-viva-200/50 bg-white overflow-hidden">
        <h2 className="text-sm font-bold text-viva-900 font-display px-4 py-3 border-b border-viva-200/50">Detalhe do cálculo</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-viva-100/50 text-viva-800 text-left text-xs font-display">
                <th className="px-3 py-2.5 w-[28%]">Etapas</th>
                <th className="px-3 py-2.5 w-[50%]">Fórmula</th>
                <th className="px-3 py-2.5 text-right">R$</th>
              </tr>
            </thead>
            <tbody className="text-viva-800 font-serif text-xs sm:text-sm">
              <tr className="border-b border-viva-100">
                <td className="px-3 py-2 font-bold font-display">Valor cobrança</td>
                <td className="px-3 py-2">Soma por linha: 1.º + 50% × 2.º</td>
                <td className="px-3 py-2 text-right font-mono font-semibold">{BRL.format(valorBruto)}</td>
              </tr>
              <tr className="border-b border-viva-100">
                <td className="px-3 py-2 font-bold font-display">Deflator</td>
                <td className="px-3 py-2">
                  Por linha: −{PCT.format(dPct * 100)}% do bruto · Parâmetros
                </td>
                <td className="px-3 py-2 text-right font-mono">−{BRL.format(descontoDeflator)}</td>
              </tr>
              <tr className="border-b border-viva-100">
                <td className="px-3 py-2 font-bold font-display">Base deflatada</td>
                <td className="px-3 py-2">Soma por linha após deflator</td>
                <td className="px-3 py-2 text-right font-mono font-semibold">{BRL.format(baseDeflada)}</td>
              </tr>
              <tr className="border-b border-viva-100">
                <td className="px-3 py-2 font-bold font-display">Custo ad.</td>
                <td className="px-3 py-2">Soma, por linha, de {PCT.format(admPct * 100)}% da base de cada linha</td>
                <td className="px-3 py-2 text-right font-mono">−{BRL.format(custoAdm)}</td>
              </tr>
              <tr className="border-b border-viva-100">
                <td className="px-3 py-2 font-bold font-display">Pool repasse</td>
                <td className="px-3 py-2">Soma por linha: base deflat. − custo · Parâmetros</td>
                <td className="px-3 py-2 text-right font-mono font-semibold">{BRL.format(poolAposCusto)}</td>
              </tr>
              <tr className="border-b border-viva-100">
                <td className="px-3 py-2 font-bold font-display">Rep. 1.º méd.</td>
                <td className="px-3 py-2">
                  1.º recebe 100% do pool por linha. Ver <span className="font-display">Lançamentos do mês</span>.
                </td>
                <td className="px-3 py-2 text-right font-mono">{BRL.format(repasse1)}</td>
              </tr>
              <tr className="border-b border-viva-100">
                <td className="px-3 py-2 font-bold font-display">Rep. 2.º méd.</td>
                <td className="px-3 py-2">
                  2.º recebe até {PCT.format(r2Pct * 100)}% do pool de cada linha, quando aplicável
                </td>
                <td className="px-3 py-2 text-right font-mono">{BRL.format(repasse2)}</td>
              </tr>
              <tr className="bg-viva-50/30">
                <td className="px-3 py-2 font-bold font-display">Repasse total</td>
                <td className="px-3 py-2" />
                <td className="px-3 py-2 text-right font-mono font-bold">{BRL.format(repasseTotal)}</td>
              </tr>
              <tr className="bg-amber-50/40">
                <td className="px-3 py-2 font-bold font-display">Margem da cooperativa</td>
                <td className="px-3 py-2">Cobrança − repasse total · {PCT.format(margemPctBruto)}% da cobrança</td>
                <td className="px-3 py-2 text-right font-mono font-bold">{BRL.format(margemCoop)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-2xl border border-viva-200/50 p-4 bg-viva-50/30">
        <p className="text-sm text-viva-800 font-serif font-display font-bold">
          {mesesNomes[Number(mesMM) - 1]} {ano}
        </p>
        <button
          type="button"
          className={`btn w-full sm:w-auto ${local.concluido ? 'btn-secondary' : 'btn-primary'}`}
          onClick={() => persist({ ...local, concluido: !local.concluido })}
        >
          {local.concluido ? 'Reabrir mês' : 'Marcar mês como concluído'}
        </button>
      </div>

      {modalParams && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
        >
          <button type="button" className="absolute inset-0 bg-viva-950/50 backdrop-blur-sm" onClick={cancelarParametros} aria-label="Fechar" />
          <div className="relative z-10 w-full sm:max-w-lg bg-white sm:rounded-2xl border border-viva-200/70 shadow-2xl max-h-[95dvh] flex flex-col rounded-t-2xl sm:rounded-2xl mt-8 sm:mt-0">
            <div className="px-5 py-3 border-b border-viva-200/60">
              <h2 className="text-lg font-bold text-viva-900 font-display">Parâmetros do cálculo</h2>
            </div>
            <div className="p-5 space-y-4 overflow-y-auto">
              <div>
                <label className="text-sm font-semibold text-viva-800">Deflator %</label>
                <input
                  className="input w-full mt-0.5"
                  value={rascunho.deflatorPct}
                  onChange={(e) => setRascunho((d) => ({ ...d, deflatorPct: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-viva-800">Custo admin. %</label>
                <input
                  className="input w-full mt-0.5"
                  value={rascunho.custoAdmPct}
                  onChange={(e) => setRascunho((d) => ({ ...d, custoAdmPct: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-viva-800">Rep. 2.º no pool %</label>
                <input
                  className="input w-full mt-0.5"
                  value={rascunho.repasse2MedPct}
                  onChange={(e) => setRascunho((d) => ({ ...d, repasse2MedPct: e.target.value }))}
                  disabled={!(rascunho.incluirProfissional1 && rascunho.incluirProfissional2)}
                />
              </div>
              <div className="pt-1 border-t border-viva-200/50">
                <p className="text-sm font-semibold text-viva-800">Quem recebe</p>
                <div className="space-y-3">
                  <div
                    className={`rounded-lg border p-2.5 ${
                      rascunho.incluirProfissional1 ? 'border-viva-200/80' : 'border-viva-200/40'
                    }`}
                  >
                    <label className="inline-flex items-center gap-2 text-sm font-medium text-viva-800">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-viva-300"
                        checked={rascunho.incluirProfissional1}
                        onChange={(e) => setRascunho((d) => ({ ...d, incluirProfissional1: e.target.checked }))}
                      />
                      1.º profissional
                    </label>
                  </div>
                  <div
                    className={`rounded-lg border p-2.5 ${
                      rascunho.incluirProfissional2 ? 'border-viva-200/80' : 'border-viva-200/40'
                    }`}
                  >
                    <label className="inline-flex items-center gap-2 text-sm font-medium text-viva-800">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-viva-300"
                        checked={rascunho.incluirProfissional2}
                        onChange={(e) => setRascunho((d) => ({ ...d, incluirProfissional2: e.target.checked }))}
                      />
                      2.º profissional
                    </label>
                  </div>
                </div>
              </div>
            </div>
            <div className="p-3 border-t border-viva-200/50 flex flex-wrap justify-end gap-2 bg-viva-50/30">
              <button type="button" className="btn btn-secondary" onClick={cancelarParametros}>
                Cancelar
              </button>
              <button type="button" className="btn btn-primary" onClick={salvarParametros}>
                Aplicar
              </button>
            </div>
          </div>
        </div>
      )}

      {modalBaseProcedimentos && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="titulo-base-procedimentos"
        >
          <button
            type="button"
            className="absolute inset-0 bg-viva-950/50 backdrop-blur-sm"
            onClick={() => setModalBaseProcedimentos(false)}
            aria-label="Fechar"
          />
          <div className="relative z-10 flex h-[min(90dvh,800px)] w-full max-w-6xl flex-col sm:rounded-2xl sm:border sm:border-viva-200/70 sm:shadow-2xl sm:mt-0 mt-8 bg-white">
            <div className="flex items-center justify-between gap-2 border-b border-viva-200/60 px-4 py-3 sm:px-5">
              <h2
                id="titulo-base-procedimentos"
                className="text-lg font-bold text-viva-900 font-display"
              >
                Base de procedimentos
              </h2>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setModalBaseProcedimentos(false)}
              >
                Fechar
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-auto px-3 sm:px-4 pb-4">
              <table className="w-full min-w-[880px] border-collapse text-left text-xs text-viva-800">
                <thead className="sticky top-0 z-[1] bg-slate-800/95 text-[10px] font-display font-semibold uppercase text-white sm:text-xs">
                  <tr>
                    <th className="px-2 py-2.5 sm:px-3">Instrumento</th>
                    <th className="px-2 py-2.5 sm:px-3">Código 1</th>
                    <th className="px-2 py-2.5 sm:px-3 min-w-[12rem]">1 Procedimento</th>
                    <th className="px-2 py-2.5 sm:px-3 text-right">Valor 1 (R$)</th>
                    <th className="px-2 py-2.5 sm:px-3">Código 2</th>
                    <th className="px-2 py-2.5 sm:px-3 min-w-[12rem]">2 Procedimento</th>
                    <th className="px-2 py-2.5 sm:px-3 text-right">Valor 2 (R$)</th>
                    <th className="px-2 py-2.5 sm:px-3 min-w-[14rem]">Chave Busca</th>
                  </tr>
                </thead>
                <tbody className="font-serif text-[11px] sm:text-sm">
                  {procedimentosBase.map((b, idx) => (
                    <tr
                      key={b.id}
                      className={idx % 2 ? 'bg-viva-50/30' : 'bg-white border-t border-slate-100/90'}
                    >
                      <td className="px-2 py-1.5 sm:px-3 align-top font-mono font-medium text-amber-900/90">
                        {b.instrumento}
                      </td>
                      <td className="px-2 py-1.5 sm:px-3 align-top font-mono [overflow-wrap:anywhere]">{b.codigo1}</td>
                      <td className="px-2 py-1.5 sm:px-3 align-top [overflow-wrap:anywhere]">{b.nome1}</td>
                      <td className="px-2 py-1.5 sm:px-3 text-right font-mono tabular-nums">{BRL.format(b.valor1)}</td>
                      <td className="px-2 py-1.5 sm:px-3 align-top font-mono [overflow-wrap:anywhere]">{b.codigo2}</td>
                      <td className="px-2 py-1.5 sm:px-3 align-top [overflow-wrap:anywhere]">{b.nome2}</td>
                      <td className="px-2 py-1.5 sm:px-3 text-right font-mono tabular-nums">{BRL.format(b.valor2)}</td>
                      <td className="px-2 py-1.5 sm:px-3 text-[10px] sm:text-xs text-viva-600 [overflow-wrap:anywhere]">
                        {chaveDeBase(b)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RelatoriosProcedimentos;
