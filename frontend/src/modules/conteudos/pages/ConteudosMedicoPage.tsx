import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { authService } from '../../../services/auth.service';
import { AuthImage } from '../components/AuthImage';
import { conteudoMedicoService, type ConteudoEvento } from '../api/conteudo.service';

const ConteudosMedicoPage = () => {
  const { user } = useAuth();
  const { data: modulosResp } = useQuery({
    queryKey: ['auth', 'modulos-acesso', user?.id],
    queryFn: () => authService.getModulosAcesso(),
    enabled: !!user,
  });
  const moduloOff = modulosResp?.data?.map?.CONTEUDOS === false;

  const listQuery = useQuery({
    queryKey: ['medico', 'conteudos'],
    queryFn: async () => (await conteudoMedicoService.list()).data.data,
    enabled: !!user && user.role === 'MEDICO' && !moduloOff,
  });

  if (moduloOff) {
    return (
      <div className="p-6">
        <p className="text-viva-800">Módulo Conteúdos desabilitado.</p>
      </div>
    );
  }

  const itens = listQuery.data || [];

  return (
    <div className="p-4 md:p-6 max-w-screen-xl mx-auto space-y-6">
      <header>
        <h1 className="text-2xl font-display font-semibold text-viva-950">Conteúdos</h1>
        <p className="text-sm text-viva-700 mt-1">Aulas anunciadas pela equipe — inscreva-se antes do ao vivo.</p>
      </header>

      {listQuery.isLoading ? (
        <p className="text-sm text-viva-600">Carregando…</p>
      ) : itens.length === 0 ? (
        <p className="text-sm text-viva-600">Nenhum conteúdo publicado no momento.</p>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {itens.map((ev: ConteudoEvento) => (
            <Link
              key={ev.id}
              to={`/conteudos/${ev.id}`}
              className="group rounded-2xl overflow-hidden border border-viva-200 bg-white hover:border-viva-400 transition-colors"
            >
              {ev.capaUrl ? (
                <AuthImage
                  apiPath={`/medico/conteudos/${ev.id}/capa`}
                  alt=""
                  className="h-40 w-full object-cover"
                />
              ) : (
                <div className="h-40 bg-gradient-to-br from-viva-800 to-viva-600" />
              )}
              <div className="p-4 space-y-2">
                <h2 className="font-semibold text-viva-950 group-hover:text-viva-800">{ev.titulo}</h2>
                <p className="text-xs text-viva-600">
                  {new Date(ev.iniciaEm).toLocaleString('pt-BR')}
                  {ev.palestrante ? ` · ${ev.palestrante.nome}` : ''}
                </p>
                {ev.jaInscrito && (
                  <span className="inline-block text-[11px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                    Inscrito
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export default ConteudosMedicoPage;
