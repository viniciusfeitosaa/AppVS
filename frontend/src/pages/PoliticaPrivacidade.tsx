import { Link } from 'react-router-dom';

const ATUALIZACAO = '27 de abril de 2026';

export default function PoliticaPrivacidade() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
      <p className="text-xs font-medium uppercase tracking-wide text-viva-600">Documento jurídico</p>
      <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-viva-950 sm:text-4xl">
        Política de Privacidade
      </h1>
      <p className="mt-2 text-sm text-viva-700">
        Última atualização: <time dateTime="2026-04-27">{ATUALIZACAO}</time>
      </p>

      <div className="mt-10 space-y-8 text-base leading-relaxed text-viva-900">
        <section>
          <h2 className="font-display text-xl font-bold text-viva-900">1. Quem somos e abrangência</h2>
          <p className="mt-3">
            Esta Política de Privacidade aplica-se ao site institucional e ao ambiente digital de apoio à gestão de
            rotina de profissionais de saúde vinculados ou contratados pela <strong>Viva Saúde</strong> (ou pela
            instituição parceira que disponibilize o acesso), doravante denominada <strong>Controladora</strong>, em
            conformidade com a Lei n.º 13.709/2018 (Lei Geral de Proteção de Dados Pessoais — LGPD).
          </p>
          <p className="mt-3">
            O portal de acesso (por exemplo, área do associado) destina-se a funcionalidades de{' '}
            <strong>gestão administrativa e operacional</strong>, tais como cadastro e identificação profissional,
            organização de escalas e plantões, registro de ponto ou frequência, envio e guarda de documentos
            administrativos, relatórios de gestão e demais recursos disponibilizados em cada implantação. O escopo
            exato pode variar conforme contrato e configuração da instituição.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-bold text-viva-900">2. Dados pessoais que podem ser tratados</h2>
          <p className="mt-3">Conforme o uso da plataforma, podem ser tratados, entre outros:</p>
          <ul className="mt-3 list-disc space-y-2 pl-5">
            <li>
              <strong>Identificação e contato:</strong> nome, CPF ou documento equivalente, registro profissional (por
              exemplo CRM), e-mail, telefone e dados de perfil necessários ao acesso.
            </li>
            <li>
              <strong>Dados profissionais e operacionais:</strong> vínculo com unidades ou equipes, escalas, plantões,
              registros de jornada ou ponto, indicadores e relatórios gerados no sistema.
            </li>
            <li>
              <strong>Documentação administrativa:</strong> arquivos ou informações enviados voluntariamente pelos
              usuários ou pela instituição para cumprimento de processos internos, quando a funcionalidade existir.
            </li>
            <li>
              <strong>Dados inseridos em módulos de gestão:</strong> quando previsto na implantação, informações
              digitadas pela instituição em fluxos de trabalho (por exemplo, identificação de paciente ou prontuário
              em relatórios de procedimentos), <strong>exclusivamente</strong> para as finalidades definidas pela
              Controladora e com base legal adequada, incluindo hipóteses de dados sensíveis em saúde nos termos da
              LGPD.
            </li>
            <li>
              <strong>Dados técnicos:</strong> endereço IP, tipo de dispositivo, registros de data e hora de acesso e
              logs de segurança, na medida necessária à prestação do serviço e à proteção da informação.
            </li>
          </ul>
          <p className="mt-3 text-sm text-viva-800">
            A Controladora orienta o tratamento ao princípio da necessidade e da minimização: são coletados apenas
            dados compatíveis com as finalidades descritas e pelo tempo necessário.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-bold text-viva-900">3. Finalidades do tratamento</h2>
          <p className="mt-3">Os dados pessoais são utilizados para:</p>
          <ul className="mt-3 list-disc space-y-2 pl-5">
            <li>Viabilizar cadastro, autenticação e gestão de contas de acesso;</li>
            <li>Apoiar a organização da rotina assistencial e administrativa (escalas, plantões, ponto, relatórios);</li>
            <li>Cumprir obrigações legais, regulatórias ou contratuais aplicáveis à instituição;</li>
            <li>Prevenir fraudes, incidentes de segurança e uso indevido da plataforma;</li>
            <li>Prestação de suporte técnico e comunicações operacionais relacionadas ao serviço;</li>
            <li>Exercício regular de direitos em processo administrativo, arbitral ou judicial, quando necessário.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-display text-xl font-bold text-viva-900">4. Bases legais (LGPD)</h2>
          <p className="mt-3">O tratamento poderá se fundamentar, conforme o caso, em:</p>
          <ul className="mt-3 list-disc space-y-2 pl-5">
            <li>Execução de contrato ou de procedimentos preliminares (art. 7º, V);</li>
            <li>Cumprimento de obrigação legal ou regulatória (art. 7º, II);</li>
            <li>Exercício regular de direitos (art. 7º, VI);</li>
            <li>Legítimo interesse, observados os direitos e liberdades fundamentais do titular (art. 7º, IX), quando
              aplicável e com avaliação de proporcionalidade;</li>
            <li>Consentimento, quando exigido e registrado de forma específica (art. 7º, I), inclusive para dados
              sensíveis quando o fundamento for o art. 11, II da LGPD.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-display text-xl font-bold text-viva-900">5. Compartilhamento e operadores</h2>
          <p className="mt-3">
            Os dados poderão ser acessados por prestadores de serviço que atuem como <strong>operadores</strong> (por
            exemplo, hospedagem, infraestrutura de nuvem ou suporte técnico), mediante contrato ou cláusulas que
            limitem o tratamento ao estritamente necessário, nos termos do art. 41 da LGPD.
          </p>
          <p className="mt-3">
            Não vendemos listas de titulares. Qualquer compartilhamento com terceiros fora desse contexto observará base
            legal aplicável e, quando couber, comunicação prévia à Controladora e aos titulares.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-bold text-viva-900">6. Transferência internacional</h2>
          <p className="mt-3">
            Caso algum provedor de infraestrutura armazene dados fora do Brasil, a Controladora exigirá garantias
            compatíveis com a LGPD (incluindo cláusulas contratuais padrão ou instrumento equivalente, quando aplicável)
            e informará os titulares quando houver obrigação legal de fazê-lo.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-bold text-viva-900">7. Prazo de conservação</h2>
          <p className="mt-3">
            Os dados serão mantidos pelo tempo necessário ao cumprimento das finalidades, respeitados prazos legais de
            guarda de documentos trabalhistas, fiscais, regulatórios ou prazos decorrentes de litígio. Após o período
            aplicável, serão eliminados ou anonimizados, salvo quando a lei exigir conservação.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-bold text-viva-900">8. Segurança da informação</h2>
          <p className="mt-3">
            Adotamos medidas técnicas e administrativas razoáveis para proteger os dados contra acessos não autorizados,
            perda acidental, alteração indevida ou divulgação. Nenhum sistema é isento de risco; em caso de incidente
            com relevância para os titulares, a Controladora adotará os procedimentos previstos na legislação,
            inclusive comunicações exigidas à Autoridade Nacional de Proteção de Dados (ANPD) e aos titulares, quando
            aplicável.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-bold text-viva-900">9. Direitos do titular</h2>
          <p className="mt-3">O titular poderá solicitar, conforme a LGPD:</p>
          <ul className="mt-3 list-disc space-y-2 pl-5">
            <li>Confirmação da existência de tratamento;</li>
            <li>Acesso aos dados;</li>
            <li>Correção de dados incompletos, inexatos ou desatualizados;</li>
            <li>Anonimização, bloqueio ou eliminação de dados desnecessários ou tratados em desconformidade;</li>
            <li>Portabilidade, nas hipóteses legais;</li>
            <li>Informação sobre compartilhamentos;</li>
            <li>Revogação do consentimento, quando o tratamento tiver se baseado nele.</li>
          </ul>
          <p className="mt-3">
            O exercício dos direitos poderá ser limitado pela legislação (por exemplo, quando a informação for
            indispensável à defesa da Controladora ou sujeita a sigilo regulatório).
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-bold text-viva-900">10. Como entrar em contato</h2>
          <p className="mt-3">
            Para dúvidas sobre esta Política ou para exercer seus direitos, utilize o canal oficial da instituição. Em
            particular, pedidos relacionados à proteção de dados podem ser encaminhados para:{' '}
            <a href="mailto:contato@sejavivasaude.com.br" className="font-medium text-viva-700 underline hover:text-viva-900">
              contato@sejavivasaude.com.br
            </a>
            , com assunto indicando
            &ldquo;LGPD — proteção de dados&rdquo;, ou pelos meios divulgados no site institucional.
          </p>
          <p className="mt-3 text-sm text-viva-800">
            <strong>Endereço para correspondência:</strong> Rua Serra de Botucatu, 1195, Sala 103 — Vila Gomes Cardim,
            São Paulo — SP, Brasil.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-bold text-viva-900">11. Cookies e tecnologias similares</h2>
          <p className="mt-3">
            O site institucional ou o aplicativo podem utilizar cookies ou tecnologias equivalentes para funcionamento
            técnico, preferências e estatísticas agregadas. Detalhes específicos poderão constar em documento de
            Política de Cookies, quando publicado.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-bold text-viva-900">12. Alterações</h2>
          <p className="mt-3">
            Esta Política poderá ser atualizada para refletir mudanças legislativas, regulatórias ou nas funcionalidades
            da plataforma. A data da última versão será indicada no início do documento. Alterações relevantes poderão
            ser comunicadas pelos canais habituais de contato com os titulares ou por aviso no próprio sistema, quando
            adequado.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-bold text-viva-900">13. Autoridade supervisora</h2>
          <p className="mt-3">
            Sem prejuízo de qualquer canal interno, o titular poderá apresentar reclamação à Autoridade Nacional de
            Proteção de Dados (ANPD), conforme o art. 18, § 1º da LGPD.
          </p>
        </section>
      </div>

      <p className="mt-12 border-t border-viva-200 pt-8 text-center text-sm text-viva-700">
        <Link to="/" className="font-medium text-viva-800 underline hover:text-viva-950">
          Voltar à página inicial
        </Link>
      </p>
    </article>
  );
}
