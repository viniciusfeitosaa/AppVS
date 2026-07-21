import type { EmailPainelResumo } from '../types';

type Props = {
  resumo?: EmailPainelResumo;
  loading?: boolean;
};

const EmailStatsCards = ({ resumo, loading }: Props) => {
  const cards = [
    { label: 'Rascunhos', value: resumo?.rascunhos ?? 0, tone: 'bg-amber-50 text-amber-900 border-amber-200' },
    { label: 'Enviados', value: resumo?.enviados ?? 0, tone: 'bg-emerald-50 text-emerald-900 border-emerald-200' },
    { label: 'Falhas', value: resumo?.falhas ?? 0, tone: 'bg-red-50 text-red-900 border-red-200' },
    { label: 'Total', value: resumo?.total ?? 0, tone: 'bg-viva-50 text-viva-900 border-viva-200' },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map((card) => (
        <div key={card.label} className={`rounded-xl border p-4 ${card.tone}`}>
          <p className="text-xs font-medium uppercase tracking-wide opacity-80">{card.label}</p>
          <p className="text-2xl font-bold font-display mt-1">
            {loading ? '—' : card.value}
          </p>
        </div>
      ))}
    </div>
  );
};

export default EmailStatsCards;
