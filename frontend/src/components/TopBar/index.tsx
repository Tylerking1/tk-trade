import React from 'react'

interface TopBarProps {
  stockName: string
  tsCode: string
  latestClose?: number
  latestPctChg?: number
  dateRange: { start: string; end: string }
  onDateRangeChange: (range: { start: string; end: string }) => void
  period: string
  onPeriodChange: (p: string) => void
}

const formatDate = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, '')

const QUICK_RANGES = [
  { label: '近1月', days: 30 },
  { label: '近3月', days: 90 },
  { label: '近1年', days: 365 },
  { label: '近3年', days: 1095 },
]

const PERIODS = [
  { label: '日K', value: 'D' },
  { label: '周K', value: 'W' },
  { label: '月K', value: 'M' },
]

const TopBar: React.FC<TopBarProps> = ({
  stockName,
  tsCode,
  latestClose,
  latestPctChg,
  dateRange,
  onDateRangeChange,
  period,
  onPeriodChange,
}) => {
  const isUp = latestPctChg !== undefined && latestPctChg >= 0
  const priceColor = latestPctChg === undefined
    ? 'text-gray-300'
    : isUp
    ? 'text-red-400'
    : 'text-green-400'

  const pctChgDisplay =
    latestPctChg !== undefined
      ? `${latestPctChg >= 0 ? '+' : ''}${latestPctChg.toFixed(2)}%`
      : '--'

  const handleQuickRange = (days: number) => {
    const end = new Date()
    const start = new Date()
    start.setDate(start.getDate() - days)
    onDateRangeChange({ start: formatDate(start), end: formatDate(end) })
  }

  // Convert YYYYMMDD to YYYY-MM-DD for <input type="date">
  const toInputDate = (s: string) =>
    s.length === 8 ? `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}` : s

  // Convert YYYY-MM-DD back to YYYYMMDD
  const fromInputDate = (s: string) => s.replace(/-/g, '')

  return (
    <div className="flex items-center justify-between px-4 h-12 bg-gray-900 border-b border-gray-700 flex-shrink-0">
      {/* Left: stock info */}
      <div className="flex items-center gap-3 min-w-0">
        <span className="text-white font-semibold text-sm truncate">{stockName}</span>
        <span className="text-gray-400 text-xs font-mono">{tsCode}</span>
      </div>

      {/* Center: price info */}
      <div className="flex items-center gap-4">
        <span className={`text-lg font-bold tabular-nums ${priceColor}`}>
          {latestClose !== undefined ? latestClose.toFixed(2) : '--'}
        </span>
        <span className={`text-sm tabular-nums ${priceColor}`}>{pctChgDisplay}</span>
      </div>

      {/* Period selector */}
      <div className="flex items-center gap-1">
        {PERIODS.map(({ label, value }) => (
          <button
            key={value}
            onClick={() => onPeriodChange(value)}
            className={`px-2 py-0.5 text-xs rounded transition-colors cursor-pointer border-none ${
              period === value
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Right: date range controls */}
      <div className="flex items-center gap-2">
        {QUICK_RANGES.map(({ label, days }) => (
          <button
            key={label}
            onClick={() => handleQuickRange(days)}
            className="px-2 py-0.5 text-xs rounded bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white transition-colors cursor-pointer border-none"
          >
            {label}
          </button>
        ))}

        <div className="flex items-center gap-1 ml-2">
          <input
            type="date"
            value={toInputDate(dateRange.start)}
            onChange={(e) =>
              onDateRangeChange({ ...dateRange, start: fromInputDate(e.target.value) })
            }
            className="bg-gray-800 text-gray-300 text-xs px-2 py-0.5 rounded border border-gray-600 focus:outline-none focus:border-blue-500 cursor-pointer"
          />
          <span className="text-gray-500 text-xs">-</span>
          <input
            type="date"
            value={toInputDate(dateRange.end)}
            onChange={(e) =>
              onDateRangeChange({ ...dateRange, end: fromInputDate(e.target.value) })
            }
            className="bg-gray-800 text-gray-300 text-xs px-2 py-0.5 rounded border border-gray-600 focus:outline-none focus:border-blue-500 cursor-pointer"
          />
        </div>
      </div>
    </div>
  )
}

export default TopBar
