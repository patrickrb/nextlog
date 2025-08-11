'use client';

import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { PieChart, Pie, Cell, Legend } from 'recharts';

interface ModeStatsData {
  mode: string;
  count: number;
}

interface ModeDistributionChartProps {
  data: ModeStatsData[];
}

const COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

export function ModeDistributionChart({ data }: ModeDistributionChartProps) {
  const chartConfig = data.reduce((config, item, index) => {
    config[item.mode] = {
      label: item.mode,
      color: COLORS[index % COLORS.length],
    };
    return config;
  }, {} as Record<string, { label: string; color: string }>);

  return (
    <ChartContainer config={chartConfig} className="h-[300px]">
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          labelLine={false}
          label={({ mode, percent }) => `${mode} ${((percent || 0) * 100).toFixed(0)}%`}
          outerRadius={80}
          fill="#8884d8"
          dataKey="count"
          nameKey="mode"
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <ChartTooltip content={<ChartTooltipContent />} />
        <Legend />
      </PieChart>
    </ChartContainer>
  );
}