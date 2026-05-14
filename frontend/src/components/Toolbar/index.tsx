import {
  MousePointer2,
  Minus,
  TrendingUp,
  Square,
  GitBranch,
  BarChart3,
  Sparkles,
  Trash2,
} from 'lucide-react';
import type { DrawingTool } from '../../types';

interface Props {
  activeTool: DrawingTool;
  onSelectTool: (tool: DrawingTool) => void;
  autoDrawPatterns: boolean;
  onToggleAutoPatterns: () => void;
  onClearDrawings: () => void;
}

const TOOLS: { key: DrawingTool; label: string; icon: typeof Minus }[] = [
  { key: 'horizontalLine', label: '水平线', icon: Minus },
  { key: 'trendLine', label: '趋势线', icon: TrendingUp },
  { key: 'rectangle', label: '矩形', icon: Square },
  { key: 'parallelChannel', label: '平行通道', icon: GitBranch },
  { key: 'fibonacciRetracement', label: '斐波那契', icon: BarChart3 },
];

export default function Toolbar({
  activeTool,
  onSelectTool,
  autoDrawPatterns,
  onToggleAutoPatterns,
  onClearDrawings,
}: Props) {
  return (
    <div className="w-12 h-full bg-gray-900 border-r border-gray-700 flex flex-col items-center py-2 gap-1">
      <button
        onClick={() => onSelectTool(null)}
        className={`p-2 rounded transition-colors ${
          activeTool === null ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'
        }`}
        title="选择"
      >
        <MousePointer2 className="w-5 h-5" />
      </button>

      <div className="w-8 border-t border-gray-700 my-1" />

      {TOOLS.map((tool) => (
        <button
          key={tool.key}
          onClick={() => onSelectTool(tool.key)}
          className={`p-2 rounded transition-colors ${
            activeTool === tool.key
              ? 'bg-blue-600 text-white'
              : 'text-gray-400 hover:bg-gray-800 hover:text-white'
          }`}
          title={tool.label}
        >
          <tool.icon className="w-5 h-5" />
        </button>
      ))}

      <div className="w-8 border-t border-gray-700 my-1" />

      <button
        onClick={onToggleAutoPatterns}
        className={`p-2 rounded transition-colors ${
          autoDrawPatterns ? 'bg-green-700 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'
        }`}
        title={autoDrawPatterns ? '关闭自动画线' : '开启自动画线'}
      >
        <Sparkles className="w-5 h-5" />
      </button>

      <div className="flex-1" />

      <button
        onClick={onClearDrawings}
        className="p-2 rounded text-gray-400 hover:bg-red-900/50 hover:text-red-400 transition-colors"
        title="清除画线"
      >
        <Trash2 className="w-5 h-5" />
      </button>
    </div>
  );
}
