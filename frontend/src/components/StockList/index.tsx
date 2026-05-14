import { useState, useEffect } from 'react';
import { Search, ChevronLeft, ChevronRight, RefreshCw, Star, BarChart2, Loader2 } from 'lucide-react';
import { useStocks } from '../../hooks/useStocks';
import { syncStocks, fetchSectorList, fetchSectorRank } from '../../services/api';
import type { SectorIndex, SectorRankResult } from '../../types';

const STARS_KEY = 'starred_stocks';

function loadStars(): Set<string> {
  try {
    const arr = JSON.parse(localStorage.getItem(STARS_KEY) || '[]');
    return new Set(arr);
  } catch {
    return new Set();
  }
}

function saveStars(stars: Set<string>) {
  localStorage.setItem(STARS_KEY, JSON.stringify([...stars]));
}

function scoreColor(score: number): string {
  if (score >= 70) return 'text-red-400';
  if (score >= 60) return 'text-orange-400';
  if (score >= 45) return 'text-yellow-400';
  if (score >= 35) return 'text-blue-400';
  return 'text-green-400';
}

function PctBadge({ v }: { v: number }) {
  const color = v > 0 ? 'text-red-400' : v < 0 ? 'text-green-400' : 'text-gray-400';
  return <span className={color}>{v > 0 ? '+' : ''}{v.toFixed(2)}%</span>;
}

interface Props {
  onSelectStock: (tsCode: string, name: string, industry: string, market: string) => void;
  selectedStock: string;
  onSelectSector: (tsCode: string, name: string) => void;
}

// ── Sector Panel ──────────────────────────────────────────────────────────────
function SectorPanel({ onSelectSector, selectedStock, stars, toggleStar }: {
  onSelectSector: (ts: string, name: string) => void;
  selectedStock: string;
  stars: Set<string>;
  toggleStar: (tsCode: string, e: React.MouseEvent) => void;
}) {
  const [sectorList, setSectorList] = useState<{ indices: SectorIndex[]; sectors: SectorIndex[] }>({ indices: [], sectors: [] });
  const [rankData, setRankData] = useState<SectorRankResult[]>([]);
  const [rankLoading, setRankLoading] = useState(false);
  const [view, setView] = useState<'list' | 'rank'>('list');
  const [error, setError] = useState('');

  useEffect(() => {
    fetchSectorList()
      .then(setSectorList)
      .catch(() => {});
  }, []);

  const handleLoadRank = async () => {
    setRankLoading(true);
    setError('');
    try {
      const res = await fetchSectorRank();
      setRankData(res.data);
      setView('rank');
    } catch {
      setError('获取板块排名失败');
    } finally {
      setRankLoading(false);
    }
  };

  const allItems = [...sectorList.indices, ...sectorList.sectors];

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-1 px-2 py-2 border-b border-gray-800">
        <button
          onClick={() => setView('list')}
          className={`flex-1 py-1 text-xs rounded transition-colors ${view === 'list' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}
        >
          列表
        </button>
        <button
          onClick={handleLoadRank}
          disabled={rankLoading}
          className={`flex-1 py-1 text-xs rounded transition-colors flex items-center justify-center gap-1 ${view === 'rank' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}
        >
          {rankLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
          强势排名
        </button>
      </div>

      {error && <div className="text-red-400 text-[10px] px-3 py-1">{error}</div>}

      <div className="flex-1 overflow-y-auto">
        {view === 'list' ? (
          <>
            {allItems.length === 0 ? (
              <div className="text-gray-500 text-xs text-center mt-8">加载中...</div>
            ) : (
              <>
                {sectorList.indices.length > 0 && (
                  <div className="px-3 py-1 text-[10px] text-gray-500 bg-gray-800/40">主要指数</div>
                )}
                {sectorList.indices.map((item) => (
                  <div
                    key={item.ts_code}
                    onClick={() => onSelectSector(item.ts_code, item.name)}
                    className={`flex items-center gap-1.5 px-3 py-2 cursor-pointer border-b border-gray-800 transition-colors ${
                      selectedStock === item.ts_code ? 'bg-blue-900/40 border-l-2 border-l-blue-500' : 'hover:bg-gray-800/60'
                    }`}
                  >
                    <button
                      onClick={(e) => toggleStar(item.ts_code, e)}
                      className={`flex-shrink-0 transition-colors ${stars.has(item.ts_code) ? 'text-yellow-400' : 'text-gray-600 hover:text-gray-400'}`}
                    >
                      <Star className={`w-3.5 h-3.5 ${stars.has(item.ts_code) ? 'fill-current' : ''}`} />
                    </button>
                    <div className="flex flex-col flex-1 min-w-0">
                      <span className="text-sm text-white">{item.name}</span>
                      <span className="text-[10px] text-gray-500">{item.ts_code}</span>
                    </div>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-900/40 text-blue-300 flex-shrink-0">指数</span>
                  </div>
                ))}
                {sectorList.sectors.length > 0 && (
                  <div className="px-3 py-1 text-[10px] text-gray-500 bg-gray-800/40">申万行业</div>
                )}
                {sectorList.sectors.map((item) => (
                  <div
                    key={item.ts_code}
                    onClick={() => onSelectSector(item.ts_code, item.name)}
                    className={`flex items-center gap-1.5 px-3 py-2 cursor-pointer border-b border-gray-800 transition-colors ${
                      selectedStock === item.ts_code ? 'bg-blue-900/40 border-l-2 border-l-blue-500' : 'hover:bg-gray-800/60'
                    }`}
                  >
                    <button
                      onClick={(e) => toggleStar(item.ts_code, e)}
                      className={`flex-shrink-0 transition-colors ${stars.has(item.ts_code) ? 'text-yellow-400' : 'text-gray-600 hover:text-gray-400'}`}
                    >
                      <Star className={`w-3.5 h-3.5 ${stars.has(item.ts_code) ? 'fill-current' : ''}`} />
                    </button>
                    <span className="text-sm text-white flex-1 truncate">{item.name}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-900/40 text-purple-300 flex-shrink-0">板块</span>
                  </div>
                ))}
              </>
            )}
          </>
        ) : (
          <>
            {rankData.length === 0 ? (
              <div className="text-gray-500 text-xs text-center mt-8">暂无数据</div>
            ) : (
              <>
                <div className="flex items-center px-2 py-1 text-[10px] text-gray-600 border-b border-gray-800">
                  <div className="w-8 text-center">评分</div>
                  <div className="flex-1 pl-2">板块</div>
                  <div className="w-14 text-right">今涨跌</div>
                  <div className="w-14 text-right">5日</div>
                </div>
                {rankData.map((r) => (
                  <div
                    key={r.ts_code}
                    onClick={() => onSelectSector(r.ts_code, r.name)}
                    className={`flex items-center px-2 py-1.5 cursor-pointer hover:bg-gray-800/60 border-b border-gray-800/40 ${
                      selectedStock === r.ts_code ? 'bg-blue-900/40 border-l-2 border-l-blue-500' : ''
                    }`}
                  >
                    <button
                      onClick={(e) => toggleStar(r.ts_code, e)}
                      className={`flex-shrink-0 mr-1 transition-colors ${stars.has(r.ts_code) ? 'text-yellow-400' : 'text-gray-600 hover:text-gray-400'}`}
                    >
                      <Star className={`w-3 h-3 ${stars.has(r.ts_code) ? 'fill-current' : ''}`} />
                    </button>
                    <div className={`w-8 text-center text-xs font-bold ${scoreColor(r.score)}`}>
                      {r.score}
                    </div>
                    <div className="flex-1 pl-2 min-w-0">
                      <div className="text-xs text-white truncate">{r.name}</div>
                      <div className="text-[10px] text-gray-500">{r.recommendation}</div>
                    </div>
                    <div className="w-14 text-right text-[10px]">
                      <PctBadge v={r.pct_chg_1d} />
                    </div>
                    <div className="w-14 text-right text-[10px]">
                      <PctBadge v={r.pct_chg_5d} />
                    </div>
                  </div>
                ))}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── Main StockList Component ──────────────────────────────────────────────────
export default function StockList({ onSelectStock, selectedStock, onSelectSector }: Props) {
  const { stocks, total, loading, keyword, setKeyword, asset, setAsset, page, setPage, reload } = useStocks();
  const [syncing, setSyncing] = useState(false);
  const [stars, setStars] = useState<Set<string>>(loadStars);
  const [showStarsOnly, setShowStarsOnly] = useState(false);
  const [mainTab, setMainTab] = useState<'stocks' | 'sectors'>('stocks');

  // Persist stars
  useEffect(() => {
    saveStars(stars);
  }, [stars]);

  const toggleStar = (tsCode: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setStars((prev) => {
      const next = new Set(prev);
      if (next.has(tsCode)) next.delete(tsCode);
      else next.add(tsCode);
      return next;
    });
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      await syncStocks();
      reload();
    } finally {
      setSyncing(false);
    }
  };

  const totalPages = Math.ceil(total / 50);
  const displayedStocks = showStarsOnly ? stocks.filter((s) => stars.has(s.ts_code)) : stocks;

  return (
    <div className="w-72 h-full bg-gray-900 border-r border-gray-700 flex flex-col">
      {/* Top-level tab: Stocks / Sectors */}
      <div className="flex border-b border-gray-700 flex-shrink-0">
        <button
          onClick={() => setMainTab('stocks')}
          className={`flex-1 py-2 text-xs font-medium transition-colors ${mainTab === 'stocks' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-400 hover:text-white'}`}
        >
          股票
        </button>
        <button
          onClick={() => setMainTab('sectors')}
          className={`flex-1 py-2 text-xs font-medium transition-colors flex items-center justify-center gap-1 ${mainTab === 'sectors' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-400 hover:text-white'}`}
        >
          <BarChart2 className="w-3 h-3" />
          板块
        </button>
      </div>

      {mainTab === 'sectors' ? (
        <SectorPanel onSelectSector={onSelectSector} selectedStock={selectedStock} stars={stars} toggleStar={toggleStar} />
      ) : (
        <>
          <div className="p-3 border-b border-gray-700">
            <div className="flex items-center gap-2 mb-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="搜索代码/名称..."
                  value={keyword}
                  onChange={(e) => { setKeyword(e.target.value); setPage(1); }}
                  className="w-full pl-9 pr-3 py-2 bg-gray-800 border border-gray-600 rounded text-sm text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
                />
              </div>
              <button
                onClick={handleSync}
                disabled={syncing}
                className="p-2 bg-gray-800 border border-gray-600 rounded hover:bg-gray-700 text-gray-300"
                title="同步股票列表"
              >
                <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
              </button>
            </div>
            <div className="flex gap-1">
              {[{ label: '全部', value: '' }, { label: '股票', value: 'E' }, { label: 'ETF', value: 'FD' }].map((tab) => (
                <button
                  key={tab.value}
                  onClick={() => { setAsset(tab.value); setPage(1); }}
                  className={`flex-1 py-1.5 text-xs rounded transition-colors ${
                    asset === tab.value ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
              <button
                onClick={() => setShowStarsOnly((v) => !v)}
                title="只看自选"
                className={`px-2 py-1.5 rounded transition-colors ${showStarsOnly ? 'bg-yellow-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
              >
                <Star className={`w-3.5 h-3.5 ${showStarsOnly ? 'fill-current' : ''}`} />
              </button>
            </div>
            {showStarsOnly && (
              <div className="mt-1 text-[10px] text-yellow-400">自选 {stars.size} 只</div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center h-32 text-gray-400 text-sm">加载中...</div>
            ) : displayedStocks.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-gray-400 text-sm">
                {showStarsOnly ? '暂无自选股票' : '暂无数据，请先同步'}
              </div>
            ) : (
              displayedStocks.map((stock) => (
                <div
                  key={stock.ts_code}
                  onClick={() => onSelectStock(stock.ts_code, stock.name, stock.industry || '', stock.market || '')}
                  className={`flex items-center justify-between px-3 py-2 cursor-pointer border-b border-gray-800 transition-colors ${
                    selectedStock === stock.ts_code
                      ? 'bg-blue-900/40 border-l-2 border-l-blue-500'
                      : 'hover:bg-gray-800/60'
                  }`}
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <button
                      onClick={(e) => toggleStar(stock.ts_code, e)}
                      className={`flex-shrink-0 transition-colors ${stars.has(stock.ts_code) ? 'text-yellow-400' : 'text-gray-600 hover:text-gray-400'}`}
                    >
                      <Star className={`w-3.5 h-3.5 ${stars.has(stock.ts_code) ? 'fill-current' : ''}`} />
                    </button>
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm text-white font-mono">{stock.symbol}</span>
                      <span className="text-xs text-gray-400 truncate">{stock.name}</span>
                    </div>
                  </div>
                  <span className={`text-xs px-1.5 py-0.5 rounded flex-shrink-0 ${
                    stock.asset === 'FD'
                      ? 'bg-purple-900/50 text-purple-300'
                      : stock.market === '创业板'
                      ? 'bg-orange-900/50 text-orange-300'
                      : stock.market === '科创板'
                      ? 'bg-green-900/50 text-green-300'
                      : 'bg-gray-700 text-gray-300'
                  }`}>
                    {stock.asset === 'FD' ? 'ETF' : stock.market || '主板'}
                  </span>
                </div>
              ))
            )}
          </div>

          <div className="p-2 border-t border-gray-700 flex items-center justify-between text-xs text-gray-400">
            <span>共 {showStarsOnly ? displayedStocks.length : total} 只</span>
            {!showStarsOnly && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page <= 1}
                  className="p-1 hover:text-white disabled:opacity-30"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span>{page}/{totalPages || 1}</span>
                <button
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page >= totalPages}
                  className="p-1 hover:text-white disabled:opacity-30"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
