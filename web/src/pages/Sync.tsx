import { ErrorBox, Loading, PageHeader } from '../components/ui';
import { api } from '../data';
import { fmtDateTime, fmtInt, relativeTime } from '../lib/format';
import { useAsync } from '../lib/useAsync';
import { StatusDot } from './Overview';

function duration(a: string, b: string | null) {
  if (!b) return '';
  const s = Math.round((new Date(b).getTime() - new Date(a).getTime()) / 1000);
  return `${s} сек`;
}

export default function Sync() {
  const q = useAsync(() => api.getIngestRuns(), []);
  if (q.loading) return <Loading />;
  if (q.error) return <ErrorBox message={q.error} onRetry={q.reload} />;
  const runs = q.data ?? [];

  return (
    <div>
      <PageHeader title="Синхронизация" sub="Данните от Instagram се теглят автоматично всеки ден сутрин (05:17 UTC)." />

      <div className="panel mb-6">
        <h2 className="panel-title">Как да пуснеш синхронизация ръчно</h2>
        <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm text-cream-dim marker:text-brand-yellow">
          <li>Отвори GitHub хранилището snimaipro-social-hub и избери раздела Actions.</li>
          <li>В списъка вляво избери работния процес за синхронизация (ingest).</li>
          <li>Натисни Run workflow, после зеления бутон Run workflow.</li>
          <li>След около минута презареди тази страница. Новият запис ще се появи отдолу.</li>
        </ol>
        <p className="mt-3 text-xs text-cream-dim">Instagram обновява статистиките със закъснение до 48 часа, затова най-новите публикации са отбелязани като непълни.</p>
      </div>

      <h2 className="panel-title mb-3">Последни изпълнения</h2>
      {runs.length === 0 ? (
        <div className="panel text-cream-dim">Още няма изпълнения.</div>
      ) : (
        <ul className="space-y-2">
          {runs.map((r) => (
            <li key={r.id} className="panel !p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <StatusDot status={r.status} />
                <span className="tabular text-sm text-cream-dim">{fmtDateTime(r.started_at)} ({relativeTime(r.started_at)})</span>
              </div>
              <p className="mt-2 text-sm">
                <span className="tabular font-semibold">{fmtInt(r.posts_synced)}</span> публикации
                {r.finished_at && <span className="text-cream-dim"> · {duration(r.started_at, r.finished_at)}</span>}
              </p>
              {r.message && <p className="mt-1 text-sm text-cream-dim">{r.message}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
