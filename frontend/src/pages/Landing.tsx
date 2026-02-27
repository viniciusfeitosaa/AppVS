import { Link } from 'react-router-dom';

export default function Landing() {
  return (
    <>
      <section className="relative py-20 sm:py-28 overflow-hidden">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 text-center">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-viva-900 tracking-tight">
            Bem-vindo à <span className="text-viva-600">Viva Saúde</span>
          </h1>
          <p className="mt-6 text-lg sm:text-xl text-viva-800 max-w-2xl mx-auto">
            Sua plataforma para gestão de escalas, ponto eletrônico e muito mais.
            Acesse sua área e gerencie sua rotina com praticidade.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/login"
              className="inline-flex items-center justify-center px-8 py-4 rounded-xl bg-viva-600 text-white font-semibold text-lg hover:bg-viva-700 transition shadow-lg"
            >
              Área do associado
            </Link>
            <Link
              to="/sobre"
              className="inline-flex items-center justify-center px-8 py-4 rounded-xl border-2 border-viva-600 text-viva-700 font-semibold hover:bg-viva-50 transition"
            >
              Conheça mais
            </Link>
          </div>
        </div>
      </section>
      <section className="py-16 bg-viva-50 border-y border-viva-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 grid sm:grid-cols-3 gap-8 text-center">
          <div>
            <div className="text-3xl font-bold text-viva-600">Escalas</div>
            <p className="mt-2 text-viva-800">Organize e visualize suas escalas de forma simples.</p>
          </div>
          <div>
            <div className="text-3xl font-bold text-viva-600">Ponto</div>
            <p className="mt-2 text-viva-800">Registro de ponto eletrônico integrado.</p>
          </div>
          <div>
            <div className="text-3xl font-bold text-viva-600">Relatórios</div>
            <p className="mt-2 text-viva-800">Acompanhe contratos e indicadores.</p>
          </div>
        </div>
      </section>
    </>
  );
}
