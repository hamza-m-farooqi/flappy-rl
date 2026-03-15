import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

export type GenerationStat = {
  generation: number;
  max_fitness: number;
  avg_fitness: number;
  species_count: number;
};

type MetricsDashboardProps = {
  statsHistory: GenerationStat[];
};

export function MetricsDashboard({ statsHistory }: MetricsDashboardProps) {
  if (!statsHistory || statsHistory.length === 0) {
    return (
      <div style={{ height: 250, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f9fafb', borderRadius: '4px', border: '1px solid #e5e7eb' }}>
        <p style={{ color: '#6b7280', fontSize: '14px' }}>Waiting for generation metrics...</p>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: 300, backgroundColor: '#fff', borderRadius: '4px', border: '1px solid #eee', padding: '16px 16px 16px 0' }}>
      <ResponsiveContainer>
        <LineChart data={statsHistory} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
          <XAxis
            dataKey="generation"
            tick={{ fontSize: 12, fill: '#666' }}
            tickLine={false}
            axisLine={{ stroke: '#ddd' }}
          />
          <YAxis
            yAxisId="left"
            tick={{ fontSize: 12, fill: '#666' }}
            tickLine={false}
            axisLine={{ stroke: '#ddd' }}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={{ fontSize: 12, fill: '#666' }}
            tickLine={false}
            axisLine={{ stroke: '#ddd' }}
          />
          <Tooltip
            contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', border: '1px solid #ddd', borderRadius: '4px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}
            itemStyle={{ fontSize: '13px', padding: '2px 0' }}
            labelStyle={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}
          />
          <Legend wrapperStyle={{ fontSize: '13px', paddingTop: '10px' }} />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="max_fitness"
            name="Max Fitness"
            stroke="#2196F3"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 6 }}
            isAnimationActive={false}
          />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="avg_fitness"
            name="Avg Fitness"
            stroke="#4CAF50"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 6 }}
            isAnimationActive={false}
          />
          <Line
            yAxisId="right"
            type="stepAfter"
            dataKey="species_count"
            name="Species"
            stroke="#FF9800"
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
