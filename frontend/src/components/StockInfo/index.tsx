import { useEffect, useState } from 'react';
import { fetchFundamentals } from '../../services/api';
import type { StockFundamentals } from '../../types';

interface Props {
  tsCode: string;
  industry: string;
  market: string;
}

function fmt(v: number | null | undefined, decimals = 2): string {
  if (v == null) return '-';
  return v.toFixed(decimals);
}

function fmtBillion(v: number | null | undefined): string {
  if (v == null) return '-';
  if (v >= 10000) return `${(v / 10000).toFixed(2)}万亿`;
  return `${v.toFixed(2)}亿`;
}

function PctChange({ value }: { value: number | null | undefined }) {
  if (value == null) return <span className="text-gray-400">-</span>;
  const color = value > 0 ? 'text-red-400' : value < 0 ? 'text-green-400' : 'text-gray-300';
  const sign = value > 0 ? '+' : '';
  return <span className={color}>{sign}{value.toFixed(2)}%</span>;
}

function StatItem({ label, value, highlight }: { label: string; value: React.ReactNode; highlight?: boolean }) {
  return (
    <div className={`flex flex-col gap-0.5 px-3 py-1.5 flex-shrink-0 ${highlight ? 'bg-gray-800/60 rounded' : ''}`}>
      <span className="text-gray-500 text-[10px] leading-none">{label}</span>
      <span className={`text-xs font-medium leading-none ${highlight ? 'text-white' : 'text-gray-200'}`}>
        {value}
      </span>
    </div>
  );
}

function Divider() {
  return <div className="w-px bg-gray-700/60 self-stretch my-1 flex-shrink-0" />;
}

export default function StockInfo({ tsCode, industry, market }: Props) {
  const [data, setData] = useState<StockFundamentals | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!tsCode) {
      setData(null);
      return;
    }
    setLoading(true);
    setData(null);
    fetchFundamentals(tsCode)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [tsCode]);

  if (!tsCode) return null;

  const v = data?.valuation;
  const p = data?.performance;
  const inc = data?.income;
  const div = data?.dividend;
  const concepts = data?.concepts ?? [];

  return (
    <div
      className="flex items-center border-b border-gray-800 bg-gray-900/50 overflow-x-auto flex-shrink-0 h-12 px-2"
      style={{ scrollbarWidth: 'none' }}
    >
      {/* Industry / Market tags */}
      <div className="flex items-center gap-1.5 px-2 flex-shrink-0">
        {industry && (
          <span className="px-1.5 py-0.5 text-[10px] bg-blue-900/50 text-blue-300 rounded border border-blue-700/40">
            {industry}
          </span>
        )}
        {market && (
          <span className="px-1.5 py-0.5 text-[10px] bg-gray-700/50 text-gray-400 rounded border border-gray-600/40">
            {market}
          </span>
        )}
      </div>

      {loading ? (
        <span className="text-xs text-gray-500 px-4">加载中...</span>
      ) : (
        <>
          <Divider />

          {/* Market Cap — core highlight */}
          <StatItem
            label="总市值"
            value={<span className="text-yellow-400 font-semibold">{fmtBillion(v?.total_mv)}</span>}
            highlight
          />
          <StatItem label="流通市值" value={fmtBillion(v?.circ_mv)} />

          <Divider />

          {/* Valuation */}
          <StatItem label="PE(TTM)" value={fmt(v?.pe_ttm)} />
          <StatItem label="PB" value={fmt(v?.pb)} />
          <StatItem label="股息率" value={v?.dv_ttm != null ? `${fmt(v.dv_ttm)}%` : '-'} />

          <Divider />

          {/* Performance — core highlights */}
          <StatItem
            label="归母净利润"
            value={<span className="text-white font-semibold">{inc?.net_profit != null ? fmtBillion(inc.net_profit) : '-'}</span>}
            highlight
          />
          <StatItem
            label="营业收入"
            value={inc?.total_revenue != null ? fmtBillion(inc.total_revenue) : '-'}
          />
          <StatItem
            label="净利润增速"
            value={<PctChange value={p?.netprofit_yoy} />}
            highlight
          />
          <StatItem label="营收增速" value={<PctChange value={p?.or_yoy} />} />

          <Divider />

          {/* Ratios */}
          <StatItem label="ROE" value={p?.roe != null ? `${fmt(p.roe)}%` : '-'} />
          <StatItem label="EPS" value={fmt(p?.eps)} />
          <StatItem label="负债率" value={p?.debt_to_assets != null ? `${fmt(p.debt_to_assets)}%` : '-'} />

          {div && (
            <>
              <Divider />
              <StatItem
                label="每股分红"
                value={div.cash_div_tax != null ? `¥${div.cash_div_tax.toFixed(3)}` : '-'}
              />
            </>
          )}

          {concepts.length > 0 && (
            <>
              <Divider />
              <div className="flex items-center gap-1 px-2 flex-shrink-0">
                {concepts.slice(0, 5).map((c) => (
                  <span
                    key={c}
                    className="px-1.5 py-0.5 text-[10px] bg-purple-900/40 text-purple-300 rounded border border-purple-700/30 whitespace-nowrap"
                  >
                    {c}
                  </span>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
