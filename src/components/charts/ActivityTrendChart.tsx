'use client';

import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid } from 'recharts';

interface ActivityData {
  date: string;
  qsos: number;
}

interface ActivityTrendChartProps {
  data: ActivityData[];
  timeUnit?: 'day' | 'week' | 'month';
}

export function ActivityTrendChart({ data, timeUnit = 'month' }: ActivityTrendChartProps) {
  const chartConfig = {
    qsos: {
      label: "QSOs",
      color: "hsl(var(--chart-2))",
    },
  };

  const formatXAxisLabel = (tickItem: string) => {
    const date = new Date(tickItem);
    switch (timeUnit) {
      case 'day':
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      case 'week':
        return `Week ${Math.ceil(date.getDate() / 7)}`;
      case 'month':
        return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      default:
        return tickItem;
    }
  };

  return (
    <ChartContainer config={chartConfig} className="h-[300px]">
      <AreaChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis 
          dataKey="date" 
          tickFormatter={formatXAxisLabel}
          type="category"
        />
        <YAxis />
        <ChartTooltip 
          content={<ChartTooltipContent />}
          labelFormatter={(value) => {
            const date = new Date(value);
            return date.toLocaleDateString('en-US', { 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            });
          }}
        />
        <Area 
          type="monotone" 
          dataKey="qsos" 
          stroke="var(--color-qsos)" 
          fillOpacity={0.6}
          fill="var(--color-qsos)" 
        />
      </AreaChart>
    </ChartContainer>
  );
}