import { Link } from 'react-router-dom';

export default function Contato() {
  return (
    <section className="py-16 sm:py-24">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        <h1 className="text-3xl sm:text-4xl font-bold text-viva-900">Contato</h1>
        <p className="mt-6 text-lg text-viva-800 leading-relaxed">
          Entre em contato conosco para dúvidas, sugestões ou suporte. Estamos à disposição.
        </p>
        <div className="mt-8 p-6 rounded-xl bg-viva-50 border border-viva-100">
          <p className="text-viva-800">
            <strong>E-mail:</strong> contato@viva-saude.com.br
          </p>
          <p className="mt-2 text-viva-800">
            <strong>Suporte:</strong> suporte@viva-saude.com.br
          </p>
        </div>
        <div className="mt-10">
          <Link
            to="/login"
            className="inline-flex items-center justify-center px-6 py-3 rounded-xl bg-viva-600 text-white font-semibold hover:bg-viva-700 transition"
          >
            Área do associado
          </Link>
        </div>
      </div>
    </section>
  );
}
