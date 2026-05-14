import { useState, useEffect, useRef, useCallback } from 'react';
import { Filter, Play, Loader2, Brain, BarChart3, X, History } from 'lucide-react';
import type { ScreenerStrategy, ScreenerResult, AIScore, ScoreRankResult } from '../../types';
import { fetchStrategies, fetchIndustries, runScreener, startScoreRank, pollScoreRank, cancelScoreRank } from '../../services/api';

interface Props {
  onSelectStock: (tsCode: string, name: string, industry: string, market: string) => void;
  aiScore: AIScore | null;
  stockName: string;
}

interface HistoryRecord {
  id: string;
  timestamp: number;
  type: 'strategy' | 'score';
  params: Record<string, string | number | boolean>;
  resultCount: number;
  results: (ScreenerResult | ScoreRankResult)[];
}

const HISTORY_KEY = 'screener_history';
const MAX_HISTORY = 10;

function saveHistory(record: HistoryRecord) {
  try {
    const existing: HistoryRecord[] = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
    const updated = [record, ...existing].slice(0, MAX_HISTORY);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
  } catch {
    // ignore storage errors
  }
}

function loadHistory(): HistoryRecord[] {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
  } catch {
    return [];
  }
}

function scoreColor(score: number): string {
  if (score >= 70) return 'text-red-400';
  if (score >= 60) return 'text-orange-400';
  if (score >= 45) return 'text-yellow-400';
  if (score >= 35) return 'text-blue-400';
  return 'text-green-400';
}

function scoreBg(score: number): string {
  if (score >= 70) return 'bg-red-500/20 border-red-500/40';
  if (score >= 60) return 'bg-orange-500/20 border-orange-500/40';
  if (score >= 45) return 'bg-yellow-500/20 border-yellow-500/40';
  return 'bg-gray-700/40 border-gray-600/40';
}

function fmt(v: number | null | undefined, d = 1): string {
  return v == null ? '-' : v.toFixed(d);
}

function PctBadge({ v }: { v: number | null | undefined }) {
  if (v == null) return <span className="text-gray-500">-</span>;
  const color = v > 0 ? 'text-red-400' : v < 0 ? 'text-green-400' : 'text-gray-400';
  return <span className={color}>{v > 0 ? '+' : ''}{v.toFixed(1)}%</span>;
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function paramsLabel(rec: HistoryRecord): string {
  const p = rec.params;
  const parts: string[] = [];
  if (rec.type === 'strategy') {
    parts.push(String(p.strategyName || p.strategy));
  } else {
    parts.push(`评分≥${p.min_score}`);
  }
  if (p.market) parts.push(String(p.market));
  if (p.industry) parts.push(String(p.industry));
  if (p.exclude_st) parts.push('排除ST');
  return parts.join(' · ');
}

// ── Shared filter controls ──────────────────────────────────────────────────
interface FilterBarProps {
  industries: string[];
  industry: string;
  setIndustry: (v: string) => void;
  excludeST: boolean;
  setExcludeST: (v: boolean) => void;
}

function FilterBar({ industries, industry, setIndustry, excludeST, setExcludeST }: FilterBarProps) {
  return (
    <div className="space-y-1.5">
      <div>
        <div className="text-[10px] text-gray-500 mb-1">板块/行业</div>
        <select
          value={industry}
          onChange={(e) => setIndustry(e.target.value)}
          className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1.5 text-xs text-white"
        >
          <option value="">全部行业</option>
          {industries.map((ind) => (
            <option key={ind} value={ind}>{ind}</option>
          ))}
        </select>
      </div>
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={excludeST}
          onChange={(e) => setExcludeST(e.target.checked)}
          className="accent-blue-500"
        />
        <span className="text-xs text-gray-300">排除ST股票</span>
      </label>
    </div>
  );
}

// ── History Panel ────────────────────────────────────────────────────────────
interface HistoryPanelProps {
  onRestore: (rec: HistoryRecord) => void;
  onClose: () => void;
}

function HistoryPanel({ onRestore, onClose }: HistoryPanelProps) {
  const [records, setRecords] = useState<HistoryRecord[]>(loadHistory);

  const handleClear = () => {
    localStorage.removeItem(HISTORY_KEY);
    setRecords([]);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-800">
        <span className="text-xs text-gray-300 font-medium">选股历史记录</span>
        <div className="flex gap-2">
          {records.length > 0 && (
            <button onClick={handleClear} className="text-[10px] text-gray-500 hover:text-red-400">
              清空
            </button>
          )}
          <button onClick={onClose} className="text-gray-500 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {records.length === 0 ? (
          <div className="text-gray-500 text-xs text-center mt-8 px-4">
            <History className="w-8 h-8 mx-auto mb-2 opacity-20" />
            暂无历史记录
          </div>
        ) : (
          records.map((rec) => (
            <div
              key={rec.id}
              onClick={() => onRestore(rec)}
              className="px-3 py-2 border-b border-gray-800/50 cursor-pointer hover:bg-gray-800/60"
            >
              <div className="flex items-center justify-between">
                <span className={`text-[10px] px-1.5 py-0.5 rounded ${rec.type === 'strategy' ? 'bg-blue-500/20 text-blue-400' : 'bg-purple-500/20 text-purple-400'}`}>
                  {rec.type === 'strategy' ? '策略' : '评分'}
                </span>
                <span className="text-[10px] text-gray-500">{formatTime(rec.timestamp)}</span>
              </div>
              <div className="text-xs text-gray-300 mt-0.5 truncate">{paramsLabel(rec)}</div>
              <div className="text-[10px] text-gray-500">找到 {rec.resultCount} 只股票</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ── Score Rank Tab ──────────────────────────────────────────────────────────
interface ScoreRankTabProps {
  industries: string[];
  onSelectStock: Props['onSelectStock'];
  onSaveHistory: (rec: HistoryRecord) => void;
  restoredResults?: ScoreRankResult[];
}

function ScoreRankTab({ industries, onSelectStock, onSaveHistory, restoredResults }: ScoreRankTabProps) {
  const [market, setMarket] = useState('');
  const [industry, setIndustry] = useState('');
  const [excludeST, setExcludeST] = useState(false);
  const [minScore, setMinScore] = useState(60);
  const [scanLimit, setScanLimit] = useState(300);
  const [jobId, setJobId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [total, setTotal] = useState(0);
  const [results, setResults] = useState<ScoreRankResult[]>(restoredResults || []);
  const [status, setStatus] = useState<'idle' | 'running' | 'done'>(restoredResults ? 'done' : 'idle');
  const [error, setError] = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const handleStart = async () => {
    setError('');
    setResults([]);
    setProgress(0);
    try {
      const res = await startScoreRank({ market, industry, exclude_st: excludeST, min_score: minScore, limit: scanLimit });
      setJobId(res.job_id);
      setTotal(res.total);
      setStatus('running');

      pollRef.current = setInterval(async () => {
        try {
          const poll = await pollScoreRank(res.job_id, 50);
          setProgress(poll.progress);
          setResults(poll.data);
          if (poll.status === 'done') {
            stopPolling();
            setStatus('done');
            onSaveHistory({
              id: res.job_id,
              timestamp: Date.now(),
              type: 'score',
              params: { market, industry, exclude_st: excludeST, min_score: minScore, limit: scanLimit },
              resultCount: poll.data.length,
              results: poll.data,
            });
          }
        } catch {
          stopPolling();
          setStatus('done');
          setError('轮询失败');
        }
      }, 1500);
    } catch {
      setError('启动失败，请重试');
      setStatus('idle');
    }
  };

  const handleCancel = async () => {
    stopPolling();
    if (jobId) await cancelScoreRank(jobId).catch(() => {});
    setStatus('done');
    setJobId(null);
  };

  useEffect(() => () => stopPolling(), [stopPolling]);

  const pct = total > 0 ? Math.round((progress / total) * 100) : 0;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="p-3 border-b border-gray-800 space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <div className="text-[10px] text-gray-500 mb-1">市场</div>
            <select
              value={market}
              onChange={(e) => setMarket(e.target.value)}
              className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1.5 text-xs text-white"
            >
              <option value="">全部A股</option>
              <option value="主板">主板</option>
              <option value="创业板">创业板</option>
              <option value="科创板">科创板</option>
            </select>
          </div>
          <div>
            <div className="text-[10px] text-gray-500 mb-1">最低评分</div>
            <select
              value={minScore}
              onChange={(e) => setMinScore(Number(e.target.value))}
              className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1.5 text-xs text-white"
            >
              <option value={50}>50+</option>
              <option value={55}>55+</option>
              <option value={60}>60+</option>
              <option value={65}>65+</option>
              <option value={70}>70+</option>
            </select>
          </div>
        </div>

        <FilterBar
          industries={industries}
          industry={industry}
          setIndustry={setIndustry}
          excludeST={excludeST}
          setExcludeST={setExcludeST}
        />

        <div>
          <div className="text-[10px] text-gray-500 mb-1">扫描数量（越多越慢）</div>
          <select
            value={scanLimit}
            onChange={(e) => setScanLimit(Number(e.target.value))}
            className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1.5 text-xs text-white"
          >
            <option value={100}>100只（约1分钟）</option>
            <option value={300}>300只（约3分钟）</option>
            <option value={500}>500只（约5分钟）</option>
            <option value={0}>全部（约1小时）</option>
          </select>
        </div>

        {status === 'running' ? (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-400 flex items-center gap-1.5">
                <Loader2 className="w-3 h-3 animate-spin" />
                扫描中 {progress}/{total === 0 ? '全部' : total}，已找到 {results.length} 只
              </span>
              <button onClick={handleCancel} className="text-gray-500 hover:text-white">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all duration-300"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        ) : (
          <button
            onClick={handleStart}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded text-sm transition-colors"
          >
            <BarChart3 className="w-4 h-4" />
            开始综合评分选股
          </button>
        )}
        {error && <div className="text-red-400 text-xs">{error}</div>}
      </div>

      <div className="flex-1 overflow-y-auto">
        {results.length === 0 && status !== 'running' ? (
          <div className="text-gray-500 text-xs text-center mt-8 px-4 leading-relaxed">
            <BarChart3 className="w-10 h-10 mx-auto mb-2 opacity-20" />
            综合评分 = 技术面(60%) + 基本面(40%)<br/>
            考虑MACD、均线、RSI等技术信号<br/>
            以及ROE、净利润增速、估值等基本面
          </div>
        ) : (
          <>
            {results.length > 0 && (
              <div className="px-3 py-1.5 text-[10px] text-gray-500 border-b border-gray-800 flex justify-between">
                <span>共 {results.length} 只 (评分≥{minScore})</span>
                {status === 'done' && <span className="text-green-400">扫描完成</span>}
              </div>
            )}
            {results.length > 0 && (
              <div className="flex items-center px-2 py-1 text-[10px] text-gray-600 border-b border-gray-800">
                <div className="w-10 text-center">评分</div>
                <div className="flex-1 pl-2">股票</div>
                <div className="w-12 text-right">PE</div>
                <div className="w-12 text-right">ROE</div>
                <div className="w-14 text-right">净利增速</div>
              </div>
            )}
            {results.map((r) => (
              <div
                key={r.ts_code}
                onClick={() => onSelectStock(r.ts_code, r.name, '', '')}
                className="flex items-center px-2 py-1.5 cursor-pointer hover:bg-gray-800/60 border-b border-gray-800/40"
              >
                <div className={`w-10 h-8 flex items-center justify-center rounded border text-xs font-bold flex-shrink-0 ${scoreBg(r.composite)}`}>
                  <span className={scoreColor(r.composite)}>{r.composite}</span>
                </div>
                <div className="flex-1 pl-2 min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-white font-mono truncate">{r.name}</span>
                    <PctBadge v={r.pct_chg} />
                  </div>
                  <div className="text-[10px] text-gray-500">{r.ts_code} · {r.close}</div>
                </div>
                <div className="w-12 text-right text-[10px] text-gray-300">{fmt(r.pe_ttm)}</div>
                <div className="w-12 text-right text-[10px] text-gray-300">
                  {r.roe != null ? <span className={r.roe >= 15 ? 'text-red-400' : ''}>{fmt(r.roe)}%</span> : '-'}
                </div>
                <div className="w-14 text-right">
                  <PctBadge v={r.netprofit_yoy} />
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

// ── Main Screener Component ────────────────────────────────────────────────
export default function Screener({ onSelectStock, aiScore, stockName }: Props) {
  const [strategies, setStrategies] = useState<ScreenerStrategy[]>([]);
  const [industries, setIndustries] = useState<string[]>([]);
  const [selectedStrategy, setSelectedStrategy] = useState('');
  const [industry, setIndustry] = useState('');
  const [excludeST, setExcludeST] = useState(false);
  const [results, setResults] = useState<ScreenerResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'ai' | 'screener' | 'score' | 'history'>('ai');
  const [restoredScoreResults, setRestoredScoreResults] = useState<ScoreRankResult[] | undefined>(undefined);
  const [historyVersion, setHistoryVersion] = useState(0);

  useEffect(() => {
    fetchStrategies().then((res) => {
      setStrategies(res.strategies);
      if (res.strategies.length > 0) setSelectedStrategy(res.strategies[0].key);
    });
    fetchIndustries().then((res) => setIndustries(res.industries)).catch(() => {});
  }, []);

  const handleRun = async () => {
    if (!selectedStrategy) return;
    setLoading(true);
    setError('');
    try {
      const res = await runScreener({ strategy: selectedStrategy, industry, exclude_st: excludeST, limit: 50 });
      setResults(res.data);
      const strategyName = strategies.find((s) => s.key === selectedStrategy)?.name || selectedStrategy;
      saveHistory({
        id: `${Date.now()}`,
        timestamp: Date.now(),
        type: 'strategy',
        params: { strategy: selectedStrategy, strategyName, industry, exclude_st: excludeST },
        resultCount: res.data.length,
        results: res.data,
      });
      setHistoryVersion((v) => v + 1);
    } catch {
      setError('选股失败，请检查网络或后端服务');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveHistory = useCallback((rec: HistoryRecord) => {
    saveHistory(rec);
    setHistoryVersion((v) => v + 1);
  }, []);

  const handleRestoreHistory = (rec: HistoryRecord) => {
    if (rec.type === 'strategy') {
      setResults(rec.results as ScreenerResult[]);
      const params = rec.params;
      if (params.strategy) setSelectedStrategy(String(params.strategy));
      if (typeof params.industry === 'string') setIndustry(params.industry);
      if (typeof params.exclude_st === 'boolean') setExcludeST(params.exclude_st);
      setActiveTab('screener');
    } else {
      setRestoredScoreResults(rec.results as ScoreRankResult[]);
      setActiveTab('score');
    }
  };

  const historyCount = loadHistory().length;

  return (
    <div className="w-80 h-full bg-gray-900 border-l border-gray-700 flex flex-col">
      {/* Tabs */}
      <div className="flex border-b border-gray-700 flex-shrink-0">
        {([
          { key: 'ai', label: 'AI分析' },
          { key: 'screener', label: '策略' },
          { key: 'score', label: '评分' },
          { key: 'history', label: `历史${historyCount > 0 ? `(${historyCount})` : ''}` },
        ] as const).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 py-2 text-xs font-medium transition-colors ${
              activeTab === tab.key
                ? 'text-blue-400 border-b-2 border-blue-400'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* AI Analysis Tab */}
      {activeTab === 'ai' && (
        <div className="flex-1 overflow-y-auto p-4">
          {!aiScore || !Array.isArray(aiScore.signals) ? (
            <div className="text-gray-400 text-sm text-center mt-8">
              <Brain className="w-12 h-12 mx-auto mb-3 opacity-30" />
              请选择股票查看AI分析
            </div>
          ) : (
            <div>
              <div className="text-center mb-4">
                <div className="text-sm text-gray-400 mb-1">{stockName}</div>
                <div className={`text-5xl font-bold ${scoreColor(aiScore.score)}`}>
                  {aiScore.score}
                </div>
                <div className={`text-lg font-medium mt-1 ${scoreColor(aiScore.score)}`}>
                  {aiScore.recommendation}
                </div>
              </div>
              <div className="space-y-2">
                <div className="text-xs text-gray-400 uppercase tracking-wide mb-2">信号详情</div>
                {aiScore.signals.map((signal, i) => (
                  <div key={i} className="flex items-center justify-between py-1.5 px-2 rounded bg-gray-800/50">
                    <span className="text-sm text-gray-300">{signal.name}</span>
                    <span className={`text-sm font-mono ${signal.type === 'bullish' ? 'text-red-400' : 'text-green-400'}`}>
                      {signal.weight > 0 ? '+' : ''}{signal.weight}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Strategy Screener Tab */}
      {activeTab === 'screener' && (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="p-3 border-b border-gray-800 space-y-2">
            <select
              value={selectedStrategy}
              onChange={(e) => setSelectedStrategy(e.target.value)}
              className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-white"
            >
              {strategies.map((s) => (
                <option key={s.key} value={s.key}>[{s.category}] {s.name}</option>
              ))}
            </select>
            <FilterBar
              industries={industries}
              industry={industry}
              setIndustry={setIndustry}
              excludeST={excludeST}
              setExcludeST={setExcludeST}
            />
            <button
              onClick={handleRun}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white py-2 rounded text-sm transition-colors"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              {loading ? '选股中...' : '开始选股'}
            </button>
            {error && <div className="text-red-400 text-xs mt-1">{error}</div>}
          </div>
          <div className="flex-1 overflow-y-auto">
            {results.length === 0 ? (
              <div className="text-gray-400 text-sm text-center mt-8">
                <Filter className="w-12 h-12 mx-auto mb-3 opacity-30" />
                选择策略并点击开始选股
              </div>
            ) : (
              <>
                <div className="px-3 py-2 text-xs text-gray-400 border-b border-gray-800">
                  共 {results.length} 只符合条件
                </div>
                {results.map((stock) => (
                  <div
                    key={stock.ts_code}
                    onClick={() => onSelectStock(stock.ts_code, stock.name, '', '')}
                    className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-gray-800/60 border-b border-gray-800/50"
                  >
                    <div className="flex flex-col">
                      <span className="text-sm text-white font-mono">{stock.ts_code}</span>
                      <span className="text-xs text-gray-400">{stock.name}</span>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-white">{stock.close}</div>
                      <div className={`text-xs ${stock.pct_chg > 0 ? 'text-red-400' : stock.pct_chg < 0 ? 'text-green-400' : 'text-gray-400'}`}>
                        {stock.pct_chg > 0 ? '+' : ''}{stock.pct_chg}%
                      </div>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      )}

      {/* Composite Score Tab */}
      {activeTab === 'score' && (
        <ScoreRankTab
          key={restoredScoreResults ? 'restored' : 'fresh'}
          industries={industries}
          onSelectStock={onSelectStock}
          onSaveHistory={handleSaveHistory}
          restoredResults={restoredScoreResults}
        />
      )}

      {/* History Tab */}
      {activeTab === 'history' && (
        <HistoryPanel
          key={historyVersion}
          onRestore={handleRestoreHistory}
          onClose={() => setActiveTab('ai')}
        />
      )}
    </div>
  );
}
