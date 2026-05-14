import { useEffect, useRef, useCallback, useState } from 'react';
import { init, dispose, type Chart, type Nullable, type LineType, TooltipShowRule } from 'klinecharts';
import type { KlineItem, Patterns } from '../../types';

interface Props {
  data: KlineItem[];
  patterns: Patterns | null;
  drawingTool: string | null;
  autoDrawPatterns: boolean;
  onToggleAutoPatterns: () => void;
  clearDrawingsSignal: number;
  loading?: boolean;
}

const SUB_INDICATOR_OPTIONS = [
  { key: 'VOL', name: '成交量' },
  { key: 'MACD', name: 'MACD' },
  { key: 'KDJ', name: 'KDJ' },
  { key: 'RSI', name: 'RSI' },
  { key: 'BOLL', name: 'BOLL' },
  { key: 'WR', name: 'WR' },
  { key: 'DMI', name: 'DMI' },
  { key: 'OBV', name: 'OBV' },
];

export default function KLineChartView({
  data,
  patterns,
  drawingTool,
  autoDrawPatterns,
  onToggleAutoPatterns,
  clearDrawingsSignal,
  loading,
}: Props) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<Nullable<Chart>>(null);
  const dataRef = useRef<KlineItem[]>([]);  // survives StrictMode double-init
  const [activeSubIndicators, setActiveSubIndicators] = useState<string[]>(['VOL', 'MACD']);
  const activeRef = useRef<string[]>(['VOL', 'MACD']);
  const subPaneIds = useRef<Record<string, string>>({});

  // Initialize chart
  useEffect(() => {
    if (!chartRef.current) return;

    chartInstance.current = init(chartRef.current, {
      styles: {
        grid: {
          show: true,
          horizontal: { color: 'rgba(255,255,255,0.05)' },
          vertical: { color: 'rgba(255,255,255,0.05)' },
        },
        candle: {
          bar: {
            upColor: '#F44336',
            downColor: '#4CAF50',
            upBorderColor: '#F44336',
            downBorderColor: '#4CAF50',
            upWickColor: '#F44336',
            downWickColor: '#4CAF50',
          },
          priceMark: {
            last: { show: true, line: { show: true, size: 1 }, text: { show: true, color: '#fff', size: 12, paddingLeft: 4, paddingRight: 4, paddingTop: 2, paddingBottom: 2, borderRadius: 2 } },
          },
          tooltip: {
            showRule: TooltipShowRule.Always,
            text: { size: 12, color: '#ccc', marginLeft: 8, marginTop: 6, marginRight: 8, marginBottom: 0 },
          },
        },
        indicator: {
          tooltip: {
            showRule: TooltipShowRule.Always,
            text: { size: 12, color: '#ccc', marginLeft: 8, marginTop: 6, marginRight: 8, marginBottom: 0 },
          },
        },
        xAxis: {
          tickText: { color: '#888', size: 11 },
        },
        yAxis: {
          tickText: { color: '#888', size: 11 },
        },
        separator: {
          color: 'rgba(255,255,255,0.1)',
        },
        crosshair: {
          show: true,
          horizontal: {
            show: true,
            line: { show: true, style: 'dashed' as LineType, color: 'rgba(255,255,255,0.3)', size: 1 },
            text: { show: true, color: '#fff', size: 11, paddingLeft: 4, paddingRight: 4, paddingTop: 2, paddingBottom: 2, borderRadius: 2, backgroundColor: '#333' },
          },
          vertical: {
            show: true,
            line: { show: true, style: 'dashed' as LineType, color: 'rgba(255,255,255,0.3)', size: 1 },
            text: { show: true, color: '#fff', size: 11, paddingLeft: 4, paddingRight: 4, paddingTop: 2, paddingBottom: 2, borderRadius: 2, backgroundColor: '#333' },
          },
        },
      },
    });

    chartInstance.current?.createIndicator('MA', false, { id: 'candle_pane' });

    const volId = chartInstance.current?.createIndicator('VOL', false);
    if (volId) subPaneIds.current['VOL'] = volId;

    const macdId = chartInstance.current?.createIndicator('MACD', false);
    if (macdId) subPaneIds.current['MACD'] = macdId;

    // Apply any existing data — handles React StrictMode double-init where
    // the data effect won't re-fire after the second init because data didn't change
    if (dataRef.current.length > 0) {
      chartInstance.current?.applyNewData(
        dataRef.current.map((item) => ({
          timestamp: item.timestamp,
          open: item.open,
          high: item.high,
          low: item.low,
          close: item.close,
          volume: item.volume,
          turnover: item.turnover,
        }))
      );
    }

    // ResizeObserver after init so chartInstance is valid
    const ro = new ResizeObserver(() => {
      chartInstance.current?.resize();
    });
    ro.observe(chartRef.current);

    return () => {
      ro.disconnect();
      // chartRef.current is null during StrictMode cleanup — dispose via instance ref instead
      // eslint-disable-next-line react-hooks/exhaustive-deps
      dispose(chartInstance.current ?? chartRef.current!);
    };
  }, []);

  // Apply K-line data
  useEffect(() => {
    if (!chartInstance.current || !data.length) return;
    dataRef.current = data;  // keep ref in sync
    chartInstance.current.applyNewData(
      data.map((item) => ({
        timestamp: item.timestamp,
        open: item.open,
        high: item.high,
        low: item.low,
        close: item.close,
        volume: item.volume,
        turnover: item.turnover,
      }))
    );
    // Resize after data to ensure correct rendering
    requestAnimationFrame(() => chartInstance.current?.resize());
  }, [data]);

  // Drawing tool
  useEffect(() => {
    if (!chartInstance.current || !drawingTool) return;

    const toolMap: Record<string, string> = {
      horizontalLine: 'horizontalStraightLine',
      trendLine: 'segment',
      rectangle: 'rect',
      parallelChannel: 'parallelStraightLine',
      fibonacciRetracement: 'fibonacciLine',
    };

    const klineToolName = toolMap[drawingTool];
    if (klineToolName) chartInstance.current.createOverlay(klineToolName);
  }, [drawingTool]);

  // Clear drawings signal
  useEffect(() => {
    chartInstance.current?.removeOverlay();
  }, [clearDrawingsSignal]);

  // Auto draw patterns
  useEffect(() => {
    if (!chartInstance.current) return;
    if (!autoDrawPatterns) {
      chartInstance.current.removeOverlay();
      return;
    }
    if (!patterns) return;

    chartInstance.current.removeOverlay();

    patterns.support_resistance?.resistance?.forEach((level) => {
      chartInstance.current?.createOverlay({
        name: 'horizontalStraightLine',
        points: [{ value: level.price }],
        styles: { line: { color: '#FF5252', size: 1, style: 'dashed' as LineType } },
      });
    });

    patterns.support_resistance?.support?.forEach((level) => {
      chartInstance.current?.createOverlay({
        name: 'horizontalStraightLine',
        points: [{ value: level.price }],
        styles: { line: { color: '#4CAF50', size: 1, style: 'dashed' as LineType } },
      });
    });

    if (patterns.channel) {
      const ch = patterns.channel;
      const color = ch.type === 'ascending' ? '#FF9800' : '#2196F3';
      const s = dateToTimestamp(ch.upper_start.date);
      const e = dateToTimestamp(ch.upper_end.date);
      chartInstance.current?.createOverlay({ name: 'segment', points: [{ timestamp: s, value: ch.upper_start.price }, { timestamp: e, value: ch.upper_end.price }], styles: { line: { color, size: 2 } } });
      chartInstance.current?.createOverlay({ name: 'segment', points: [{ timestamp: s, value: ch.lower_start.price }, { timestamp: e, value: ch.lower_end.price }], styles: { line: { color, size: 2 } } });
    }

    if (patterns.box) {
      const b = patterns.box;
      chartInstance.current?.createOverlay({ name: 'rect', points: [{ timestamp: dateToTimestamp(b.start_date), value: b.upper }, { timestamp: dateToTimestamp(b.end_date), value: b.lower }], styles: { line: { color: '#9C27B0', size: 1, style: 'dashed' as LineType } } });
    }

    if (patterns.head_shoulders_top) drawHeadShoulders(patterns.head_shoulders_top, '#FF5252');
    if (patterns.head_shoulders_bottom) drawHeadShoulders(patterns.head_shoulders_bottom, '#4CAF50');
  }, [patterns, autoDrawPatterns]);

  const drawHeadShoulders = useCallback((hs: NonNullable<Patterns['head_shoulders_top']>, color: string) => {
    if (!chartInstance.current) return;
    chartInstance.current.createOverlay({ name: 'segment', points: [{ timestamp: dateToTimestamp(hs.left_shoulder.date), value: hs.left_shoulder.price }, { timestamp: dateToTimestamp(hs.head.date), value: hs.head.price }], styles: { line: { color, size: 2 } } });
    chartInstance.current.createOverlay({ name: 'segment', points: [{ timestamp: dateToTimestamp(hs.head.date), value: hs.head.price }, { timestamp: dateToTimestamp(hs.right_shoulder.date), value: hs.right_shoulder.price }], styles: { line: { color, size: 2 } } });
    chartInstance.current.createOverlay({ name: 'segment', points: [{ timestamp: dateToTimestamp(hs.neckline_start.date), value: hs.neckline_start.price }, { timestamp: dateToTimestamp(hs.neckline_end.date), value: hs.neckline_end.price }], styles: { line: { color: '#FFEB3B', size: 1, style: 'dashed' as LineType } } });
  }, []);

  // Toggle sub-indicator on/off
  const toggleSubIndicator = useCallback((key: string) => {
    const chart = chartInstance.current;
    if (!chart) return;

    const current = activeRef.current;
    if (current.includes(key)) {
      const paneId = subPaneIds.current[key];
      if (paneId) {
        chart.removeIndicator(paneId, key);
        delete subPaneIds.current[key];
      }
      const next = current.filter((k) => k !== key);
      activeRef.current = next;
      setActiveSubIndicators(next);
    } else {
      let paneId: string | null = null;
      if (key === 'BOLL') {
        chart.createIndicator('BOLL', false, { id: 'candle_pane' });
        paneId = 'candle_pane';
      } else {
        paneId = chart.createIndicator(key, false) as string | null;
      }
      if (paneId) subPaneIds.current[key] = paneId;
      const next = [...current, key];
      activeRef.current = next;
      setActiveSubIndicators(next);
    }
  }, []);

  return (
    <div ref={wrapperRef} className="relative flex-1 flex flex-col bg-gray-950 overflow-hidden" style={{ minHeight: 0 }}>
      {/* Indicator toggle bar */}
      <div className="flex items-center px-4 py-2 border-b border-gray-800 flex-shrink-0 gap-1">
        {SUB_INDICATOR_OPTIONS.map((ind) => (
          <button
            key={ind.key}
            onClick={() => toggleSubIndicator(ind.key)}
            className={`px-2 py-1 text-xs rounded transition-colors ${
              activeSubIndicators.includes(ind.key)
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            {ind.name}
          </button>
        ))}
        <button
          onClick={onToggleAutoPatterns}
          className={`px-2 py-1 text-xs rounded transition-colors ${
            autoDrawPatterns
              ? 'bg-blue-600 text-white'
              : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
          }`}
        >
          形态线
        </button>
      </div>

      {/* Chart container: absolute fill ensures klinecharts gets real pixel dimensions */}
      <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
        <div
          ref={chartRef}
          style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
        />
      </div>

      {loading && (
        <div className="absolute inset-0 bg-gray-950/80 flex items-center justify-center z-10">
          <div className="flex flex-col items-center gap-2">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-gray-400 text-sm">加载中...</span>
          </div>
        </div>
      )}
    </div>
  );
}

function dateToTimestamp(dateStr: string): number {
  return new Date(dateStr.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3')).getTime();
}
