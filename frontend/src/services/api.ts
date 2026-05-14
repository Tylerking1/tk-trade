import axios from 'axios';
import type { StockListResponse, KlineResponse, Patterns, ScreenerStrategy, ScreenerResult, AIScore, StockFundamentals, ScoreRankJob, SectorIndex, SectorRankResult } from '../types';

const api = axios.create({
  baseURL: 'http://localhost:8000/api',
  timeout: 30000,
});

export async function fetchStockList(params: {
  keyword?: string;
  asset?: string;
  market?: string;
  page?: number;
  page_size?: number;
}): Promise<StockListResponse> {
  const { data } = await api.get('/stocks/list', { params });
  return data;
}

export async function syncStocks(): Promise<{ message: string }> {
  const { data } = await api.get('/stocks/sync');
  return data;
}

export async function fetchKlineData(params: {
  ts_code: string;
  start_date?: string;
  end_date?: string;
  period?: string;
}): Promise<KlineResponse> {
  const { data } = await api.get('/kline/daily', { params });
  return data;
}

export async function fetchPatterns(params: {
  ts_code: string;
  start_date?: string;
  end_date?: string;
}): Promise<{ patterns: Patterns }> {
  const { data } = await api.get('/patterns/detect', { params });
  return data;
}

export async function fetchStrategies(): Promise<{ strategies: ScreenerStrategy[] }> {
  const { data } = await api.get('/screener/strategies');
  return data;
}

export async function fetchIndustries(): Promise<{ industries: string[] }> {
  const { data } = await api.get('/screener/industries');
  return data;
}

export async function runScreener(params: {
  strategy: string;
  market?: string;
  industry?: string;
  exclude_st?: boolean;
  limit?: number;
}): Promise<{ strategy: string; total: number; data: ScreenerResult[] }> {
  const { data } = await api.post('/screener/run', null, { params });
  return data;
}

export async function fetchAIScore(params: {
  ts_code: string;
  start_date?: string;
  end_date?: string;
}): Promise<AIScore> {
  const { data } = await api.get('/screener/ai-score', { params });
  return data;
}

export async function fetchFundamentals(ts_code: string): Promise<StockFundamentals> {
  const { data } = await api.get(`/stocks/fundamentals/${ts_code}`);
  return data;
}

export async function startScoreRank(params: {
  market?: string;
  industry?: string;
  exclude_st?: boolean;
  min_score?: number;
  limit?: number;
}): Promise<{ job_id: string; total: number }> {
  const { data } = await api.post('/screener/score-rank/start', null, { params });
  return data;
}

export async function pollScoreRank(job_id: string, top?: number): Promise<ScoreRankJob> {
  const { data } = await api.get(`/screener/score-rank/${job_id}`, { params: { top } });
  return data;
}

export async function cancelScoreRank(job_id: string): Promise<void> {
  await api.delete(`/screener/score-rank/${job_id}`);
}

export async function fetchSectorList(): Promise<{ indices: SectorIndex[]; sectors: SectorIndex[] }> {
  const { data } = await api.get('/sectors/list');
  return data;
}

export async function fetchSectorKline(params: {
  ts_code: string;
  start_date?: string;
  end_date?: string;
}): Promise<KlineResponse> {
  const { data } = await api.get('/sectors/kline', { params });
  return data;
}

export async function fetchSectorRank(): Promise<{ data: SectorRankResult[]; total: number }> {
  const { data } = await api.get('/sectors/rank');
  return data;
}
