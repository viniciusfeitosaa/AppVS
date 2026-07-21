/**
 * Importação única — corpo clínico (lista colada pelo utilizador).
 * Uso: node scripts/import-corpo-clinico-once.mjs
 */
import { PrismaClient, StatusCadastroMedico } from '@prisma/client';
import bcrypt from 'bcryptjs';

const TENANT_ID = 'b7c43aba-fb5f-4b85-9ded-ba72ba96ec2b';
const DEFAULT_SENHA = 'viva@2026';
const BCRYPT_ROUNDS = Number(process.env.BCRYPT_ROUNDS || 12);

const PROFISSIONAIS = [
  { nome: 'Allysson Lima Fontenele Rodrigues', cpf: '036.345.803-48', crm: '26178CE', email: 'allyssonrodrigues@uninta.edu.br', telefone: '(85) 98199-1105' },
  { nome: 'Carlito Braga Linhares', cpf: '764.614.833-49', crm: '22902CE', email: 'carlitobraga22@gmail.com', telefone: '(88) 99785-9371' },
  { nome: 'Carlos Alexandre de Sousa Teixeira', cpf: '047.369.973-70', crm: '20842CE', email: 'cadesousateixeira@yahoo.com.br', telefone: '(11) 99123-9784' },
  { nome: 'Davyson Chaves Farias', cpf: '634.548.583-72', crm: '16745CE', email: 'dr.davyson@gmail.com', telefone: '(88) 99808-7171' },
  { nome: 'Francisco Renan Pontes Barroso', cpf: '991.685.703-25', crm: '22490CE', email: 'fcorenan@gmail.com', telefone: '(88) 99602-7401' },
  { nome: 'Gabriele Taumaturgo Mororo', cpf: '004.074.853-76', crm: '23221CE', email: 'gabrieletaumaturgo@gmail.com', telefone: '(86) 99959-9080' },
  { nome: 'Italo Ramon Bessa Holanda', cpf: '111.532.784-48', crm: '27237CE', email: 'italo.ramon.bessa@gmail.com', telefone: '(84) 99912-1618' },
  { nome: 'Jean Carlos Farias Tabosa', cpf: '058.963.683-99', crm: '21256CE', email: 'jeancarlosft3@gmail.com', telefone: '(88) 99765-1326' },
  { nome: 'Leticia Tereza Pinto Holanda', cpf: '636.260.180-75', crm: '22745CE', email: 'leticiatpholanda@gmail.com', telefone: '(85) 99671-2484' },
  { nome: 'Leyde Jenifer Dias Uchoa', cpf: '021.389.333-93', crm: '23683CE', email: 'leydejenifer@gmail.com', telefone: '(88) 9943-6955' },
  { nome: 'Marcelo da Silva Costa', cpf: '600.401.973-95', crm: '18195CE', email: 'marcelocosta3@hotmail.com', telefone: '(85) 98144-1771' },
  { nome: 'Maxwell Kennedy Xavier Maques Viana', cpf: '043.868.893-70', crm: '15986CE', email: 'marusiamuniz@gmail.com', telefone: '(85) 99434-5203' },
  { nome: 'Miquéias Manoel de Vasconcelos', cpf: '019.493.133-10', crm: '018678CE', email: 'miqueiasvasconcelos2@hotmail.com', telefone: '(85) 99919-7206' },
  { nome: 'Sarah de Oliveira Rosado', cpf: '048.873.911-02', crm: '27181CE', email: 'sarah.ors@hotmail.com', telefone: '(63) 98151-9802' },
  { nome: 'Sarah de Sousa Magalhaes', cpf: '068.011.233-27', crm: '25006CE', email: 'zsmates14@gmail.com', telefone: '(85) 98141-3114' },
  { nome: 'Tallys Lima Carneiro', cpf: '606.108.103-08', crm: '22054CE', email: 'tallyslimacarneiro@hotmail.com', telefone: '(85) 99952-2490' },
  { nome: 'Yvilla Cinara Rolim Magalhaes', cpf: '020.182.493-04', crm: '24113CE', email: 'yvilla-cinara@hotmail.com', telefone: '(88) 99764-5373' },
  { nome: 'José Ronaldo de Sousa Filho', cpf: '058.983.673-06', crm: '21579CE', email: 'rofilho09@gmail.com', telefone: '(88) 99659-1909' },
  { nome: 'Sara Lívia Martins Teixeira', cpf: '082.289.193-01', crm: '31452CE', email: 'saratlivia@gmail.com', telefone: '(88) 9242-6710' },
  { nome: 'Danielle Cristina Chaves Farias', cpf: '041.592.123-60', crm: '18523CE', email: 'daniellecfarias@hotmail.com', telefone: '(88) 99962-9374' },
  { nome: 'Mariana Mendes Cafe', cpf: '062.425.913-75', crm: '27724CE', email: 'marianakfe@yahoo.com.br', telefone: '(85) 99632-2459' },
  { nome: 'Matheus de Lira Gregorio', cpf: '063.207.213-08', crm: '23081CE', email: 'matheus.lirag12@gmail.com', telefone: '(88) 99753-4911' },
  { nome: 'Antonio Davi Henrique Bertini', cpf: '080.106.063-08', crm: '27466CE', email: 'davihenriquebertini@gmail.com', telefone: '(88) 99861-3135' },
  { nome: 'Hariel Bringel Fuentes', cpf: '043.760.343-12', crm: '30927CE' },
  { nome: 'Tereza Raquel de Sousa Damasceno', cpf: '068.685.263-00', crm: '31287CE' },
];

function validateCPF(cpf) {
  const clean = cpf.replace(/\D/g, '');
  if (clean.length !== 11 || /^(\d)\1{10}$/.test(clean)) return false;
  let sum = 0;
  for (let i = 1; i <= 9; i++) sum += parseInt(clean[i - 1], 10) * (11 - i);
  let r = (sum * 10) % 11;
  if (r === 10 || r === 11) r = 0;
  if (r !== parseInt(clean[9], 10)) return false;
  sum = 0;
  for (let i = 1; i <= 10; i++) sum += parseInt(clean[i - 1], 10) * (12 - i);
  r = (sum * 10) % 11;
  if (r === 10 || r === 11) r = 0;
  return r === parseInt(clean[10], 10);
}

function normalizeCRM(crm) {
  const estados = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];
  const clean = crm.trim().toUpperCase().replace(/\s+/g, '').replace(/^CRM:?/, '');
  const m = clean.match(/^(\d{4,6})[-/]?([A-Z]{2})$/);
  if (!m) return null;
  const [, numero, uf] = m;
  if (!estados.includes(uf) || numero.length < 4 || numero.length > 6) return null;
  return `${numero}-${uf}`;
}

const prisma = new PrismaClient();

async function main() {
  const senhaHash = await bcrypt.hash(DEFAULT_SENHA, BCRYPT_ROUNDS);
  const resultados = { criados: [], jaExistiam: [], erros: [] };

  for (const p of PROFISSIONAIS) {
    const cpf = p.cpf.replace(/\D/g, '');
    const crm = normalizeCRM(p.crm);
    const email = (p.email || '').trim().toLowerCase() || null;

    if (!validateCPF(cpf)) {
      resultados.erros.push({ nome: p.nome, motivo: `CPF inválido: ${p.cpf}` });
      continue;
    }
    if (!crm) {
      resultados.erros.push({ nome: p.nome, motivo: `CRM inválido: ${p.crm}` });
      continue;
    }

    const dup = await prisma.medico.findFirst({
      where: {
        tenantId: TENANT_ID,
        OR: [{ cpf }, { crm }, ...(email ? [{ email }] : [])],
      },
      select: { id: true, nomeCompleto: true, cpf: true, crm: true, email: true },
    });

    if (dup) {
      resultados.jaExistiam.push({ nome: p.nome, existente: dup.nomeCompleto, crm: dup.crm, cpf: dup.cpf });
      continue;
    }

    try {
      const medico = await prisma.medico.create({
        data: {
          tenantId: TENANT_ID,
          nomeCompleto: p.nome.trim(),
          cpf,
          profissao: 'Médico',
          crm,
          email,
          telefone: p.telefone?.trim() || null,
          especialidades: ['Clínica Médica'],
          senhaHash,
          ativo: true,
          statusCadastro: StatusCadastroMedico.ATIVO,
        },
      });
      resultados.criados.push({ nome: medico.nomeCompleto, crm: medico.crm, email: medico.email });
    } catch (e) {
      resultados.erros.push({ nome: p.nome, motivo: e?.message || String(e) });
    }
  }

  console.log(JSON.stringify(resultados, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
