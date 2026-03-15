import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { TrainingHistoryPoint } from './GameCanvas';

type MetricsChartProps = {
  history: TrainingHistoryPoint[];
};

export function MetricsChart({ history }: MetricsChartProps) {
  if (history.length === 0) {
    return (
      <div className="chart-empty">
        <p>Generation history appears after the first generation completes.</p>
      </div>
    );
  }

  return (
    <div className="chart-shell">
      <div className="chart-frame">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={history}
            margin={{ top: 12, right: 18, left: 4, bottom: 8 }}
          >
            <CartesianGrid stroke="rgba(115, 129, 152, 0.18)" vertical={false} />
            <XAxis
              dataKey="generation"
              tick={{ fill: '#738198', fontSize: 11 }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              yAxisId="fitness"
              tick={{ fill: '#738198', fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={44}
            />
            <YAxis
              yAxisId="species"
              orientation="right"
              tick={{ fill: '#738198', fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={36}
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={{
                borderRadius: 14,
                border: '1px solid rgba(20, 32, 52, 0.1)',
                background: 'rgba(255, 255, 255, 0.96)',
                boxShadow: '0 16px 40px rgba(15, 23, 40, 0.08)',
              }}
              labelStyle={{ color: '#0f1728', fontWeight: 700 }}
            />
            <Legend
              wrapperStyle={{
                paddingTop: 12,
                fontSize: 12,
                color: '#4c5a70',
              }}
            />
            <Line
              yAxisId="fitness"
              type="monotone"
              dataKey="max_fitness"
              name="Max fitness"
              stroke="#1261ff"
              strokeWidth={3}
              dot={false}
              activeDot={{ r: 4 }}
              isAnimationActive={false}
            />
            <Line
              yAxisId="fitness"
              type="monotone"
              dataKey="avg_fitness"
              name="Avg fitness"
              stroke="#1f9d6a"
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 4 }}
              isAnimationActive={false}
            />
            <Line
              yAxisId="species"
              type="monotone"
              dataKey="species_count"
              name="Species"
              stroke="#c26a19"
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 4 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
