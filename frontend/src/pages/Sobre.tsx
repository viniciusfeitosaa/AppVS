import { Link } from 'react-router-dom';

export default function Sobre() {
  return (
    <section className="py-16 sm:py-24">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        <h1 className="text-3xl sm:text-4xl font-bold text-viva-900">Sobre nós</h1>
        <p className="mt-6 text-lg text-viva-800 leading-relaxed">
          A Viva Saúde é a plataforma que conecta profissionais de saúde à gestão do dia a dia:
          escalas, ponto eletrônico, contratos e relatórios em um só lugar.
        </p>
        <p className="mt-4 text-lg text-viva-800 leading-relaxed">
          Nosso objetivo é simplificar a rotina dos associados e das instituições, com ferramentas
          práticas e seguras.
        </p>
        <div className="mt-10">
          <Link
            to="/login"
            className="inline-flex items-center justify-center px-6 py-3 rounded-xl bg-viva-600 text-white font-semibold hover:bg-viva-700 transition"
          >
            Acessar área do associado
          </Link>
        </div>
      </div>
    </section>
  );
}
