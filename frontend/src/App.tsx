import { useState, useEffect } from 'react'
import './index.css'
import { useKline } from './hooks/useKline'
import TopBar from './components/TopBar'
import StockList from './components/StockList'
import StockInfo from './components/StockInfo'
import Toolbar from './components/Toolbar'
import KLineChartView from './components/Chart'
import Screener from './components/Screener'
import type { DrawingTool, AIScore } from './types'
import { fetchSectorKline, fetchAIScore, fetchSectorPatterns } from './services/api'
import type { KlineItem, Patterns } from './types'

const formatDate = (d: Date): string =>
  d.toISOString().slice(0, 10).replace(/-/g, '')

const defaultDateRange = () => {
  const end = new Date()
  const start = new Date()
  start.setDate(start.getDate() - 365)
  return { start: formatDate(start), end: formatDate(end) }
}

function App() {
  const [selectedTsCode, setSelectedTsCode] = useState<string>('')
  const [selectedStockName, setSelectedStockName] = useState<string>('')
  const [selectedIndustry, setSelectedIndustry] = useState<string>('')
  const [selectedMarket, setSelectedMarket] = useState<string>('')
  const [isSector, setIsSector] = useState<boolean>(false)
  const [sectorKlineData, setSectorKlineData] = useState<KlineItem[]>([])
  const [sectorLoading, setSectorLoading] = useState(false)
  const [sectorAiScore, setSectorAiScore] = useState<AIScore | null>(null)
  const [sectorPatterns, setSectorPatterns] = useState<Patterns | null>(null)
  const [activeTool, setActiveTool] = useState<DrawingTool>(null)
  const [autoDrawPatterns, setAutoDrawPatterns] = useState<boolean>(false)
  const [clearDrawingsSignal, setClearDrawingsSignal] = useState<number>(0)
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>(defaultDateRange)
  const [period, setPeriod] = useState<string>('D')

  const { klineData, patterns, aiScore, loading, loadKline } = useKline()

  // Load kline for stocks
  useEffect(() => {
    if (selectedTsCode && !isSector) {
      loadKline(selectedTsCode, dateRange.start, dateRange.end, period)
    }
  }, [selectedTsCode, dateRange, period, isSector, loadKline])

  // Load kline for sectors
  useEffect(() => {
    if (selectedTsCode && isSector) {
      setSectorLoading(true)
      setSectorAiScore(null)
      setSectorPatterns(null)
      fetchSectorKline({ ts_code: selectedTsCode, start_date: dateRange.start, end_date: dateRange.end })
        .then((res) => setSectorKlineData(res.data))
        .catch(() => {})
        .finally(() => setSectorLoading(false))
      // Fetch patterns and AI score in parallel (non-blocking)
      fetchSectorPatterns({ ts_code: selectedTsCode, start_date: dateRange.start, end_date: dateRange.end })
        .then((res) => setSectorPatterns(res.patterns))
        .catch(() => setSectorPatterns(null))
      fetchAIScore({ ts_code: selectedTsCode })
        .then((res: any) => {
          if (res && typeof res.score === 'number' && Array.isArray(res.signals)) {
            setSectorAiScore(res)
          } else {
            setSectorAiScore(null)
          }
        })
        .catch(() => setSectorAiScore(null))
    }
  }, [selectedTsCode, dateRange, isSector])

  useEffect(() => {
    if (activeTool !== null) {
      const timer = setTimeout(() => setActiveTool(null), 100)
      return () => clearTimeout(timer)
    }
  }, [activeTool])

  const handleSelectStock = (tsCode: string, name: string, industry: string, market: string) => {
    setSelectedTsCode(tsCode)
    setSelectedStockName(name)
    setSelectedIndustry(industry)
    setSelectedMarket(market)
    setIsSector(false)
    setSectorKlineData([])
  }

  const handleSelectSector = (tsCode: string, name: string) => {
    setSelectedTsCode(tsCode)
    setSelectedStockName(name)
    setSelectedIndustry('')
    setSelectedMarket('')
    setIsSector(true)
    setSectorKlineData([])
    setSectorAiScore(null)
    setSectorPatterns(null)
  }

  const handleSelectTool = (tool: DrawingTool) => {
    setActiveTool(tool)
  }

  const handleToggleAutoPatterns = () => {
    setAutoDrawPatterns((prev) => !prev)
  }

  const handleClearDrawings = () => {
    setClearDrawingsSignal((n) => n + 1)
  }

  // Active chart data: sector kline or stock kline
  const activeKlineData = isSector ? sectorKlineData : klineData
  const activeLoading = isSector ? sectorLoading : loading
  const activePatterns = isSector ? sectorPatterns : patterns

  // Derive latest close and pct change
  const latestClose =
    activeKlineData.length > 0 ? activeKlineData[activeKlineData.length - 1].close : undefined

  const latestPctChg: number | undefined =
    activeKlineData.length >= 2
      ? ((activeKlineData[activeKlineData.length - 1].close - activeKlineData[activeKlineData.length - 2].close) /
          activeKlineData[activeKlineData.length - 2].close) *
        100
      : undefined

  return (
    <div className="flex flex-col h-screen bg-gray-950 overflow-hidden">
      <TopBar
        stockName={selectedStockName}
        tsCode={selectedTsCode}
        latestClose={latestClose}
        latestPctChg={latestPctChg}
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
        period={period}
        onPeriodChange={setPeriod}
      />

      <div className="flex flex-1 overflow-hidden">
        <StockList
          onSelectStock={handleSelectStock}
          onSelectSector={handleSelectSector}
          selectedStock={selectedTsCode}
        />

        <div className="flex flex-col flex-1 overflow-hidden">
          {!isSector && (
            <StockInfo
              tsCode={selectedTsCode}
              industry={selectedIndustry}
              market={selectedMarket}
            />
          )}

          <div className="flex flex-1 overflow-hidden">
            <Toolbar
              activeTool={activeTool}
              onSelectTool={handleSelectTool}
              autoDrawPatterns={autoDrawPatterns}
              onToggleAutoPatterns={handleToggleAutoPatterns}
              onClearDrawings={handleClearDrawings}
            />

            <KLineChartView
              data={activeKlineData}
              patterns={activePatterns}
              drawingTool={activeTool}
              autoDrawPatterns={autoDrawPatterns}
              clearDrawingsSignal={clearDrawingsSignal}
              loading={activeLoading}
              onToggleAutoPatterns={handleToggleAutoPatterns}
            />

            <Screener
              onSelectStock={handleSelectStock}
              aiScore={isSector ? sectorAiScore : aiScore}
              stockName={selectedStockName}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
