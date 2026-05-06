import { Link } from 'react-router-dom';

const IMG_HERO =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuBouz_WGPwZEuhhlXtnxPJMTunIDrUE-Ce_tuxHxDI8hdNVwaBUeLGitlLvnoI_m79bYjJuXkbPV2Gv4E-Syf4iTdnxMfjYMBbLUBqHyj5jvZeDEm2uVzO-ZLg_O2CLnWjmUcKYrf3qP6Nau_RhuAj5G8N7SQw_39VD2N87emsPNdhDM_pgLxS56a6Iynv9DxkU99E_it_M_ZfF3cPWcOKkmI7szXxPENbZjDINeVrYRADU3HvU5d3PmFT3MH00TIxcEx06TEKaD7k';

const LOGOS = [
  'https://lh3.googleusercontent.com/aida-public/AB6AXuDfZt9t1RyEyEc9t9UalzsdqlOQ81DkyN1SkWLiqi8iVTb_1vtnMKIDM3QfDCt4FPDQUlNCLosZBPk4Ksilsvbx2o93a9GfyUax25Va7rILEPJceYD7qD0xNI1Y0_nrUu0Uv7VlqVwIeWyMcCgPDIfdG0F5YkiiEkKaDqM1F9xZsLbmjUvXvbdJ411KgE7JDFQvL5mrJrjuFjgH6nXu06jYkWSdPqc6dKVCIA0uEQkRe0NOoepu0h6WQwQe_d9YAqIL4VDEfobwkss',
  'https://lh3.googleusercontent.com/aida-public/AB6AXuCGhzpbWflp-sXb0Bo3bhQUGONEJ20g78YjCrc-fo5mmrCN1sMKZUanI_5UuN5jafkkryGEYLcYwZcELElRwBaeHHzhaLDHzFIKv0EXb3z2xuaB1_JUKQdxS0YjIeU4nuMyMjHHesxlsiU4vx3xD3B1cyH4V6eHn_aPHqR2ItudiNVdrjZTJ0zq-rk9mhx2pnLNqTaGdf19tFbiTmEmlgLO9ndsKNUFw8vHMoBTCDkOv94tuMpBYMO9VAaZFdp3ev-Z2Qs5IJ37jWM',
  'https://lh3.googleusercontent.com/aida-public/AB6AXuDX9cSie2lR938BXZN4bI1LFNK4nk8Qo5HdqOB8LShZDhAKY86N4JNn4WQnuShsx53aoRoYzzMU91MeVv0BJoYDVuC5dQJ7_2Xq4eh5lH9sbf7yf0DT1guAnNUtfr9QuxCkDLTyxTvAGWjSTCysjJM3Xnm5AHZ8ZUVB1etWlcEqgQxvAqrwXlPin48riOCbiamuoV6HfSBeJnNjGlfZeVd4tRaZCYubhC-fDLw8voa7nmDJ9lvfD9UCZf_GYyobbFIkR4PYFyElE3Y',
  'https://lh3.googleusercontent.com/aida-public/AB6AXuCGYwecX1DjrJmdJT4c4vhAGcgknt5rzCK0RFuZ_TTDZIx8_qWOrVzjxwnjnM6Q1lh3--Lq6V7acX4MdsT9WagX2tbiHWBTOioZ_0iPziSG5hRfYSZyQp9u00BrsPoR5zKuleBLJXh6gg3-KY3nz79wQpmfJELGKvUwGk3bAW7XxmLSew8PPEuSEU-cLEOzRz84ZfYGuRR4zYvRsBGHLScALFzCnAVZehsilypdEamXnhmA_bR2X98GzrY2ilH2EQTEHv3dTtvBjI8',
  'https://lh3.googleusercontent.com/aida-public/AB6AXuBygjKI9L7BNc6wm_aRcVKr4jYp8asvBXBGK2viLu1NaLfGo0OKQsBPv7b55T8xAjTDyVHTZqAOkSYeNjrCWaY24jnDgGjnn6YV5yOPVcsARKqpORWouYYCZI6KCY2eBgdmOP0Pn3xox9mHd8TlJxBMDwvyqSw1bRAwnLNXUKBMySkAU9LjkVY6h6IPuQmQD4Rq58S6L5VLk33Z0dNEgvhs3DGdIiAE2khba0JfoZAl8XFWuQwbWd3BnBN4o14Jq6gGqLY-d3-Xu2Y',
];

const IMG_CTA_BG =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuBJ-cA4mAa5WwwatrBFdAWMkBuUe0VQzH_Ll9WWtCzxM4mWNsjuMsQRxFPQaOCeYyOAMG4QxMPe7VTJFQ2lQMQbxUQW651I4vPzy96jnciB4zz1govY0Tl7SGpetG_lpSMB2TWpy5jAin83f0PjMIgte0VXL-VTbSGfRjf5tRj0faxJiy9RhkidHQg0n_CCEURGF_kwxJpAbj9f92p46lgigB_w-fRKckzRFTR_hskImeYFxsdUqzHA0rV0buPSDaluERDElt9gfqs';

const IMG_TESTI_1 =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuDiyPQe9gymBRTDs2pKGRdyc0TEtmwCFijcpiyN8l_65pqke01JCj58O4fo4XYZ0OiQhHyVF9uK7iT7efg30nXVN2KdH5AVwEkzz5cOVpasmiFcO4jLH0ueMihAuhcN9Mw_lbzQoFTc1LWcktHJyVYpM1XT32QEDSk3AS5nk3U1Kr5mRNzZ-cVoij7vmH4sTZRiyeM6tZaNWviER_gCh_8sk_7HyJhwSauVvCbonC9tqrnRXZ0xik1x-lUcMIqC1ewfagQ0c6Mwg6s';

const IMG_TESTI_2 =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuBegUCynQ6h9HlMBiN3tEwrWu2OGAeulc5tmU3RUf5YTuylVx3j9zJQT0kEjmNAtSWCaoA4LJTdGcjJdEIimg85uIUs3cnAOumHfcA40eqV2E-M_oZPkmUvJU_RTPt5tH7rUo3yoKCQ6lKygFrVS-o6I6eOtW1VBPg9pVKJ29UdZKz0B8JtBpdXOLRolUoiMBaKOei_Gv1rdC7B1CnTUfx43mMmlRSE_ZHzryvF-dEf4hY7JEwvnxT1tnaOc6X6hzcXcgC7S_QEmmk';

export default function LandingV2() {
  const year = new Date().getFullYear();

  return (
    <>
      <header className="fixed top-0 z-50 w-full border-b border-slate-200 bg-white/90 backdrop-blur-md dark:border-slate-800 dark:bg-slate-950/90">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-8">
          <Link to="/" className="font-serif text-2xl font-bold text-green-900 dark:text-green-50">
            Viva Saúde
          </Link>
          <nav className="hidden items-center gap-8 md:flex">
            <a
              className="border-b-2 border-green-800 pb-1 font-headline-lg text-lg font-semibold text-green-800 dark:border-green-400 dark:text-green-400"
              href="#"
            >
              Hospitais
            </a>
            <a
              className="font-headline-lg text-lg font-semibold text-slate-600 transition-colors duration-200 hover:text-green-700 dark:text-slate-400"
              href="#"
            >
              Profissionais
            </a>
            <a
              className="font-headline-lg text-lg font-semibold text-slate-600 transition-colors duration-200 hover:text-green-700 dark:text-slate-400"
              href="#"
            >
              Parceiros
            </a>
            <Link
              to="/sobre"
              className="font-headline-lg text-lg font-semibold text-slate-600 transition-colors duration-200 hover:text-green-700 dark:text-slate-400"
            >
              Sobre Nós
            </Link>
          </nav>
          <div className="flex items-center gap-4">
            <Link
              to="/login"
              className="font-body-md text-sm font-semibold tracking-wide text-slate-600 hover:text-green-700"
            >
              Login
            </Link>
            <Link
              to="/contato"
              className="rounded bg-primary px-6 py-2.5 font-body-md text-on-primary shadow-sm transition-all hover:bg-primary-container"
            >
              Quero contratar
            </Link>
          </div>
        </div>
      </header>

      <main className="pt-20">
        <section className="relative overflow-hidden pb-32 pt-20">
          <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-16 px-8 lg:grid-cols-2">
            <div className="z-10">
              <h1 className="mb-6 font-headline-xl text-headline-xl text-primary">
                Plataforma de gestão médica e alocação de profissionais para hospitais e clínicas
              </h1>
              <p className="mb-10 max-w-lg font-body-lg text-body-lg text-on-surface-variant">
                Conectamos instituições de saúde aos melhores profissionais com tecnologia, transparência e segurança
                jurídica.
              </p>
              <div className="flex flex-col gap-4 sm:flex-row">
                <Link
                  to="/contato"
                  className="flex items-center justify-center gap-2 rounded-lg bg-primary px-8 py-4 font-body-md font-semibold text-on-primary transition-all hover:bg-primary-container"
                >
                  Falar com Especialista
                  <span className="material-symbols-outlined">arrow_forward</span>
                </Link>
                <Link
                  to="/sobre"
                  className="rounded-lg border border-secondary px-8 py-4 font-body-md font-semibold text-secondary transition-all hover:bg-secondary-fixed-dim/10"
                >
                  Saiba mais
                </Link>
              </div>
            </div>
            <div className="relative">
              <div className="overflow-hidden rounded-2xl shadow-2xl">
                <img alt="Ambiente hospitalar moderno" className="h-[500px] w-full object-cover" src={IMG_HERO} />
              </div>
              <div className="glass-card absolute -bottom-6 -left-6 max-w-[240px] rounded-xl border border-outline-variant p-6 shadow-lg">
                <div className="mb-2 flex items-center gap-3">
                  <span
                    className="material-symbols-outlined text-secondary"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    verified
                  </span>
                  <span className="font-label-caps text-label-caps uppercase text-secondary">Compliance Total</span>
                </div>
                <p className="font-body-sm text-body-sm text-on-surface-variant">
                  Operação 100% aderente à LGPD e normas médicas vigentes.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-24 border-y border-slate-100 bg-white/50 py-12">
            <div className="mx-auto max-w-7xl px-8">
              <p className="mb-8 text-center font-label-caps text-label-caps uppercase tracking-[0.2em] text-outline">
                Instituições que confiam na Viva Saúde
              </p>
              <div className="flex flex-wrap items-center justify-center gap-12 grayscale transition-all hover:grayscale-0 opacity-60">
                {LOGOS.map((src, i) => (
                  <img key={i} alt="" className="h-8 object-contain" src={src} />
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-8 py-section-gap">
          <h2 className="mb-16 text-center font-headline-lg text-headline-lg text-primary">
            Soluções desenhadas para todo o ecossistema
          </h2>
          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            <div className="group flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-10 transition-all hover:border-secondary hover:shadow-xl">
              <span className="material-symbols-outlined mb-6 text-4xl text-primary">local_hospital</span>
              <h3 className="mb-4 font-headline-md text-headline-md text-primary">Para Hospitais</h3>
              <p className="mb-8 grow font-body-md text-body-md text-on-surface-variant">
                Foque no atendimento. Nós cuidamos da alocação médica, redução de custos operacionais e gestão técnica
                completa.
              </p>
              <Link
                to="/contato"
                className="w-full rounded-lg bg-primary py-3 text-center font-body-md font-semibold text-on-primary transition-colors group-hover:bg-primary-container"
              >
                Quero contratar
              </Link>
            </div>
            <div className="group flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-10 transition-all hover:border-secondary hover:shadow-xl">
              <span className="material-symbols-outlined mb-6 text-4xl text-primary">medical_services</span>
              <h3 className="mb-4 font-headline-md text-headline-md text-primary">Para Profissionais</h3>
              <p className="mb-8 grow font-body-md text-body-md text-on-surface-variant">
                Acesse as melhores oportunidades, garanta remuneração justa e tenha total autonomia sobre sua agenda e
                carreira.
              </p>
              <Link
                to="/cadastro"
                className="w-full rounded-lg border border-primary py-3 text-center font-body-md font-semibold text-primary transition-all group-hover:bg-primary group-hover:text-on-primary"
              >
                Quero me cadastrar
              </Link>
            </div>
            <div className="group flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-10 transition-all hover:border-secondary hover:shadow-xl">
              <span className="material-symbols-outlined mb-6 text-4xl text-primary">handshake</span>
              <h3 className="mb-4 font-headline-md text-headline-md text-primary">Para Parceiros</h3>
              <p className="mb-8 grow font-body-md text-body-md text-on-surface-variant">
                Expanda sua rede estratégica. Conectamos tecnologia e inteligência para acelerar o crescimento mútuo.
              </p>
              <a
                href="#"
                className="block w-full rounded-lg border border-secondary py-3 text-center font-body-md font-semibold text-secondary transition-all group-hover:bg-secondary group-hover:text-on-secondary"
              >
                Seja um parceiro
              </a>
            </div>
          </div>
        </section>

        <section className="bg-primary py-section-gap">
          <div className="mx-auto grid max-w-7xl grid-cols-1 gap-12 px-8 text-center text-white md:grid-cols-3">
            <div>
              <div className="mb-2 font-headline-xl text-[64px] text-secondary-fixed">+50</div>
              <p className="font-label-caps text-label-caps uppercase tracking-widest">Hospitais Atendidos</p>
            </div>
            <div>
              <div className="mb-2 font-headline-xl text-[64px] text-secondary-fixed">+2.500</div>
              <p className="font-label-caps text-label-caps uppercase tracking-widest">Médicos Cadastrados</p>
            </div>
            <div>
              <div className="mb-2 font-headline-xl text-[64px] text-secondary-fixed">12</div>
              <p className="font-label-caps text-label-caps uppercase tracking-widest">Estados Cobertos</p>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-8 py-section-gap">
          <div className="mb-20 text-center">
            <h2 className="mb-4 font-headline-lg text-headline-lg text-primary">Como funciona nossa excelência</h2>
            <div className="mx-auto h-1 w-20 bg-secondary" />
          </div>
          <div className="grid grid-cols-1 gap-0 md:grid-cols-3">
            <div className="relative border-r border-slate-100 p-8 text-center last:border-0 md:last:border-r-0">
              <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-surface-container text-2xl font-bold text-primary">
                01
              </div>
              <h4 className="mb-4 font-headline-md text-headline-md text-primary">Seleção rigorosa</h4>
              <p className="font-body-md text-on-surface-variant">
                Análise técnica e documental profunda para garantir a excelência do corpo clínico.
              </p>
            </div>
            <div className="relative border-r border-slate-100 p-8 text-center last:border-0 md:last:border-r-0">
              <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-surface-container text-2xl font-bold text-primary">
                02
              </div>
              <h4 className="mb-4 font-headline-md text-headline-md text-primary">Alocação Inteligente</h4>
              <p className="font-body-md text-on-surface-variant">
                Algoritmos de match que consideram especialidade, localização e demanda institucional.
              </p>
            </div>
            <div className="relative p-8 text-center">
              <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-surface-container text-2xl font-bold text-primary">
                03
              </div>
              <h4 className="mb-4 font-headline-md text-headline-md text-primary">Gestão e Repasse</h4>
              <p className="font-body-md text-on-surface-variant">
                Transparência total em faturamentos, repasses e métricas de desempenho em tempo real.
              </p>
            </div>
          </div>
        </section>

        <section className="border-y border-slate-200 bg-slate-50 py-section-gap">
          <div className="mx-auto max-w-7xl px-8 text-center">
            <h2 className="mb-12 font-headline-lg text-headline-lg text-primary">Segurança e Compliance</h2>
            <div className="flex flex-wrap justify-center gap-12">
              <div className="group flex flex-col items-center gap-4">
                <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-slate-200 bg-white text-primary shadow-sm transition-all group-hover:border-secondary">
                  <span className="material-symbols-outlined text-4xl">shield_lock</span>
                </div>
                <span className="font-label-caps text-label-caps uppercase">LGPD Compliance</span>
              </div>
              <div className="group flex flex-col items-center gap-4">
                <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-slate-200 bg-white text-primary shadow-sm transition-all group-hover:border-secondary">
                  <span className="material-symbols-outlined text-4xl">verified_user</span>
                </div>
                <span className="font-label-caps text-label-caps uppercase">Certificação Médica</span>
              </div>
              <div className="group flex flex-col items-center gap-4">
                <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-slate-200 bg-white text-primary shadow-sm transition-all group-hover:border-secondary">
                  <span className="material-symbols-outlined text-4xl">database</span>
                </div>
                <span className="font-label-caps text-label-caps uppercase">Dados Criptografados</span>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-8 py-section-gap">
          <h2 className="mb-16 font-headline-lg text-headline-lg text-primary">O que dizem nossos parceiros</h2>
          <div className="grid grid-cols-1 gap-12 md:grid-cols-2">
            <div className="relative rounded-3xl border border-slate-200 bg-white p-12">
              <span className="material-symbols-outlined absolute -top-8 left-8 text-6xl text-secondary-fixed-dim">
                format_quote
              </span>
              <p className="mb-8 font-body-lg text-body-lg italic text-on-surface-variant">
                &ldquo;A Viva Saúde transformou nossa gestão de escalas. A agilidade na reposição e a qualidade dos
                profissionais superaram todas as expectativas do nosso hospital.&rdquo;
              </p>
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 overflow-hidden rounded-full bg-slate-200">
                  <img alt="" className="h-full w-full object-cover" src={IMG_TESTI_1} />
                </div>
                <div>
                  <p className="font-body-md font-bold text-primary">Dr. Ricardo Menezes</p>
                  <p className="font-body-sm text-outline">Diretor Técnico Hospitalar</p>
                </div>
              </div>
            </div>
            <div className="relative rounded-3xl border border-slate-200 bg-white p-12">
              <span className="material-symbols-outlined absolute -top-8 left-8 text-6xl text-secondary-fixed-dim">
                format_quote
              </span>
              <p className="mb-8 font-body-lg text-body-lg italic text-on-surface-variant">
                &ldquo;Como médico, encontrei na plataforma a transparência e a segurança que faltavam no mercado. O
                repasse é pontual e as oportunidades são de alto nível.&rdquo;
              </p>
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 overflow-hidden rounded-full bg-slate-200">
                  <img alt="" className="h-full w-full object-cover" src={IMG_TESTI_2} />
                </div>
                <div>
                  <p className="font-body-md font-bold text-primary">Dra. Juliana Costa</p>
                  <p className="font-body-sm text-outline">Médica Intensivista</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="px-8 py-section-gap">
          <div className="relative mx-auto max-w-5xl overflow-hidden rounded-[2rem] bg-primary p-16 text-center text-white">
            <div className="absolute inset-0 opacity-10">
              <img alt="" className="h-full w-full object-cover" src={IMG_CTA_BG} />
            </div>
            <div className="relative z-10">
              <h2 className="mb-6 font-headline-lg text-headline-lg">Pronto para otimizar sua gestão de saúde?</h2>
              <p className="mx-auto mb-10 max-w-2xl font-body-lg text-body-lg text-primary-fixed/80">
                Agende uma demonstração gratuita e descubra como nossa tecnologia pode elevar o padrão da sua
                instituição.
              </p>
              <Link
                to="/contato"
                className="inline-block rounded-xl bg-secondary px-12 py-5 font-headline-md font-bold text-on-secondary-fixed shadow-lg transition-all hover:bg-secondary-container"
              >
                Agendar Demonstração
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="w-full border-t border-slate-200 bg-slate-50 py-16 dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-12 px-8 md:grid-cols-4">
          <div>
            <Link to="/" className="mb-6 block font-serif text-xl font-bold text-green-900 dark:text-green-50">
              Viva Saúde
            </Link>
            <p className="font-body-sm text-sm tracking-wide text-slate-500 dark:text-slate-400">
              Transformando a gestão em saúde através de tecnologia humana e compliance rigoroso.
            </p>
            <p className="mt-4 text-xs">
              <Link to="/" className="text-slate-500 underline hover:text-green-800">
                Voltar à landing principal
              </Link>
            </p>
          </div>
          <div>
            <h5 className="mb-6 font-label-caps text-label-caps uppercase tracking-widest text-primary">Navegação</h5>
            <ul className="space-y-4">
              <li>
                <a className="font-body-sm text-sm text-slate-500 hover:text-green-700 dark:text-slate-400" href="#">
                  Hospitais
                </a>
              </li>
              <li>
                <Link
                  to="/cadastro"
                  className="font-body-sm text-sm text-slate-500 hover:text-green-700 dark:text-slate-400"
                >
                  Profissionais
                </Link>
              </li>
              <li>
                <a className="font-body-sm text-sm text-slate-500 hover:text-green-700 dark:text-slate-400" href="#">
                  Parceiros
                </a>
              </li>
            </ul>
          </div>
          <div>
            <h5 className="mb-6 font-label-caps text-label-caps uppercase tracking-widest text-primary">Legal</h5>
            <ul className="space-y-4">
              <li>
                <Link
                  to="/politica-privacidade"
                  className="font-body-sm text-sm text-slate-500 hover:text-green-700 dark:text-slate-400"
                >
                  Privacidade
                </Link>
              </li>
              <li>
                <a className="font-body-sm text-sm text-slate-500 hover:text-green-700 dark:text-slate-400" href="#">
                  Termos de Uso
                </a>
              </li>
              <li>
                <a className="font-body-sm text-sm text-slate-500 hover:text-green-700 dark:text-slate-400" href="#">
                  Compliance
                </a>
              </li>
            </ul>
          </div>
          <div>
            <h5 className="mb-6 font-label-caps text-label-caps uppercase tracking-widest text-primary">
              Institucional
            </h5>
            <ul className="space-y-4">
              <li>
                <Link
                  to="/contato"
                  className="font-body-sm text-sm text-slate-500 hover:text-green-700 dark:text-slate-400"
                >
                  Contato
                </Link>
              </li>
              <li>
                <a className="font-body-sm text-sm text-slate-500 hover:text-green-700 dark:text-slate-400" href="#">
                  Carreiras
                </a>
              </li>
              <li>
                <Link
                  to="/sobre"
                  className="font-body-sm text-sm text-slate-500 hover:text-green-700 dark:text-slate-400"
                >
                  Sobre Nós
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="mx-auto mt-16 max-w-7xl border-t border-slate-200 px-8 pt-8 text-center dark:border-slate-800">
          <p className="font-body-sm text-sm tracking-wide text-slate-500 dark:text-slate-400">
            © {year} Viva Saúde. Todos os direitos reservados. Em conformidade com a LGPD.
          </p>
        </div>
      </footer>
    </>
  );
}
