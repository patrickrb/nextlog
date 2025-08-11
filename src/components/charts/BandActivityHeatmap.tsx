'use client';

import { ChartContainer } from '@/components/ui/chart';
import { ResponsiveContainer } from 'recharts';

interface HeatmapData {
  hour: number;
  day: number;
  qsos: number;
  dayName: string;
}

interface BandActivityHeatmapProps {
  data: HeatmapData[];
}

export function BandActivityHeatmap({ data }: BandActivityHeatmapProps) {
  const chartConfig = {
    qsos: {
      label: "QSOs",
      color: "hsl(var(--chart-4))",
    },
  };

  const maxQsos = Math.max(...data.map(d => d.qsos));
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const hours = Array.from({ length: 24 }, (_, i) => i);

  const getIntensity = (qsos: number) => {
    if (qsos === 0) return 0;
    return (qsos / maxQsos) * 0.8 + 0.2; // Min opacity of 0.2, max of 1.0
  };

  const getQsoCount = (hour: number, day: number) => {
    const item = data.find(d => d.hour === hour && d.day === day);
    return item ? item.qsos : 0;
  };

  return (
    <div className="w-full">
      <ChartContainer config={chartConfig} className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <div className="grid grid-cols-25 gap-1 p-4">
            {/* Header with hour labels */}
            <div className="col-span-1"></div>
            {hours.map(hour => (
              <div key={hour} className="text-xs text-center text-muted-foreground">
                {hour}
              </div>
            ))}
            
            {/* Heatmap grid */}
            {dayNames.map((dayName, dayIndex) => (
              <div key={dayIndex} className="contents">
                <div className="text-xs text-right text-muted-foreground pr-2 flex items-center">
                  {dayName}
                </div>
                {hours.map(hour => {
                  const qsos = getQsoCount(hour, dayIndex);
                  const intensity = getIntensity(qsos);
                  return (
                    <div
                      key={`${dayIndex}-${hour}`}
                      className="aspect-square rounded-sm border border-border/50 flex items-center justify-center text-xs cursor-pointer transition-colors hover:border-border"
                      style={{
                        backgroundColor: qsos > 0 
                          ? `hsl(var(--chart-4) / ${intensity})` 
                          : 'hsl(var(--muted))',
                      }}
                      title={`${dayName} ${hour}:00 - ${qsos} QSOs`}
                    >
                      {qsos > 0 ? qsos : ''}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </ResponsiveContainer>
      </ChartContainer>
      
      {/* Legend */}
      <div className="flex items-center justify-center gap-2 mt-4 text-xs text-muted-foreground">
        <span>Less</span>
        <div className="flex gap-1">
          {[0, 0.2, 0.4, 0.6, 0.8, 1.0].map(intensity => (
            <div
              key={intensity}
              className="w-3 h-3 rounded-sm border border-border/50"
              style={{
                backgroundColor: intensity === 0 
                  ? 'hsl(var(--muted))' 
                  : `hsl(var(--chart-4) / ${intensity})`,
              }}
            />
          ))}
        </div>
        <span>More</span>
      </div>
    </div>
  );
}