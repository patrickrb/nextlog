'use client';

import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

interface YearlyStatsData {
  year: number;
  count: number;
}

interface YearlyStatsChartProps {
  data: YearlyStatsData[];
}

export function YearlyStatsChart({ data }: YearlyStatsChartProps) {
  const chartConfig = {
    count: {
      label: "QSOs",
      color: "hsl(var(--chart-1))",
    },
  };

  return (
    <ChartContainer config={chartConfig} className="h-[300px]">
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="year" />
        <YAxis />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey="count" fill="var(--color-count)" />
      </BarChart>
    </ChartContainer>
  );
}