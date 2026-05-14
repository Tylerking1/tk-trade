export interface Stock {
  ts_code: string;
  symbol: string;
  name: string;
  area: string;
  industry: string;
  market: string;
  list_date: string;
  asset: string;
}

export interface StockListResponse {
  total: number;
  page: number;
  page_size: number;
  data: Stock[];
}

export interface KlineItem {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  turnover: number;
}

export interface Indicators {
  [key: string]: (number | null)[];
}

export interface KlineResponse {
  data: KlineItem[];
  indicators: Indicators;
}

export interface SupportResistanceLevel {
  price: number;
  date: string;
  strength: number;
}

export interface ChannelPattern {
  type: 'ascending' | 'descending' | 'horizontal';
  upper_start: { date: string; price: number };
  upper_end: { date: string; price: number };
  lower_start: { date: string; price: number };
  lower_end: { date: string; price: number };
  slope: number;
}

export interface BoxPattern {
  type: 'box';
  upper: number;
  lower: number;
  start_date: string;
  end_date: string;
  touches_upper: number;
  touches_lower: number;
}

export interface HeadShouldersPattern {
  type: 'head_shoulders_top' | 'head_shoulders_bottom';
  left_shoulder: { date: string; price: number };
  head: { date: string; price: number };
  right_shoulder: { date: string; price: number };
  neckline_start: { date: string; price: number };
  neckline_end: { date: string; price: number };
}

export interface Patterns {
  support_resistance?: {
    resistance: SupportResistanceLevel[];
    support: SupportResistanceLevel[];
  };
  channel?: ChannelPattern;
  box?: BoxPattern;
  head_shoulders_top?: HeadShouldersPattern;
  head_shoulders_bottom?: HeadShouldersPattern;
}

export interface ScreenerStrategy {
  key: string;
  name: string;
  category: string;
}

export interface ScreenerResult {
  ts_code: string;
  name: string;
  close: number;
  pct_chg: number;
  vol: number;
}

export interface AISignal {
  name: string;
  type: 'bullish' | 'bearish';
  weight: number;
}

export interface AIScore {
  score: number;
  signals: AISignal[];
  recommendation: string;
}

export interface StockFundamentals {
  valuation?: {
    pe_ttm: number | null;
    pb: number | null;
    dv_ttm: number | null;
    total_mv: number | null;
    circ_mv: number | null;
    turnover_rate: number | null;
  };
  performance?: {
    end_date: string;
    eps: number | null;
    roe: number | null;
    roa: number | null;
    netprofit_yoy: number | null;
    or_yoy: number | null;
    bps: number | null;
    debt_to_assets: number | null;
  };
  income?: {
    end_date: string;
    total_revenue: number | null;
    net_profit: number | null;
  };
  dividend?: {
    cash_div_tax: number | null;
    div_proc: string;
    ex_date: string | null;
    pay_date: string | null;
  };
  concepts?: string[];
}

export type DrawingTool =
  | 'horizontalLine'
  | 'trendLine'
  | 'rectangle'
  | 'parallelChannel'
  | 'fibonacciRetracement'
  | null;

export interface ScoreRankResult {
  ts_code: string;
  name: string;
  composite: number;
  tech_score: number;
  fund_score: number;
  recommendation: string;
  close: number;
  pct_chg: number;
  pe_ttm: number | null;
  roe: number | null;
  netprofit_yoy: number | null;
  total_mv: number | null;
}

export interface ScoreRankJob {
  status: 'running' | 'done';
  progress: number;
  total: number;
  data: ScoreRankResult[];
}

export interface SectorIndex {
  ts_code: string;
  name: string;
  type: 'index' | 'sector';
}

export interface SectorRankResult {
  ts_code: string;
  name: string;
  score: number;
  recommendation: string;
  signals: AISignal[];
  pct_chg_1d: number;
  pct_chg_5d: number;
  close: number;
  vol_ratio: number;
}
