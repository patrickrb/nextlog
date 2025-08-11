'use client';

import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

interface BandStatsData {
  band: string;
  count: number;
}

interface BandDistributionChartProps {
  data: BandStatsData[];
}

export function BandDistributionChart({ data }: BandDistributionChartProps) {
  const chartConfig = {
    count: {
      label: "QSOs",
      color: "hsl(var(--chart-3))",
    },
  };

  // Sort bands by frequency order (amateur radio standard)
  const sortedData = [...data].sort((a, b) => {
    const getFrequencyOrder = (band: string) => {
      const bandOrder = ['160M', '80M', '60M', '40M', '30M', '20M', '17M', '15M', '12M', '10M', '6M', '4M', '2M', '1.25M', '70CM', '33CM', '23CM'];
      const index = bandOrder.indexOf(band);
      return index === -1 ? 999 : index;
    };
    return getFrequencyOrder(a.band) - getFrequencyOrder(b.band);
  });

  return (
    <ChartContainer config={chartConfig} className="h-[300px]">
      <BarChart data={sortedData}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis 
          dataKey="band" 
          angle={-45}
          textAnchor="end"
          height={60}
        />
        <YAxis />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey="count" fill="var(--color-count)" />
      </BarChart>
    </ChartContainer>
  );
}