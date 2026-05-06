'use client';

import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Cell,
} from 'recharts';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent } from '@/components/ui/Card';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/shadcn-chart';

const defaultGradients = {
  accent: ['hsl(var(--secondary))', 'hsl(var(--secondary) / 0.35)'],
  success: ['hsl(var(--success))', 'hsl(var(--success) / 0.35)'],
  surface: ['hsl(var(--muted))', 'hsl(var(--border))'],
};

interface GradientAreaProps {
  data: Array<Record<string, string | number>>;
  dataKey: string;
  xKey?: string;
  height?: number;
  color?: string[];
  showGrid?: boolean;
}

export function GradientAreaChart({
  data,
  dataKey,
  xKey = 'name',
  height = 200,
  color = defaultGradients.accent,
  showGrid = true,
}: GradientAreaProps) {
  const gradientId = `gradient-${dataKey}`;
  const config = {
    [dataKey]: {
      label: dataKey,
      color: color[0],
    },
  } satisfies ChartConfig;

  return (
    <ChartContainer config={config} className="w-full" style={{ height }}>
        <AreaChart data={data} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color[0]} stopOpacity={0.3} />
              <stop offset="100%" stopColor={color[1] || color[0]} stopOpacity={0} />
            </linearGradient>
          </defs>
          {showGrid && (
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="hsl(var(--border))"
              strokeOpacity={0.4}
              vertical={false}
            />
          )}
          <XAxis
            dataKey={xKey}
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            dy={8}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            dx={-4}
          />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Area
            type="monotone"
            dataKey={dataKey}
            stroke={color[0]}
            strokeWidth={2}
            fill={`url(#${gradientId})`}
            dot={false}
            activeDot={{
              r: 5,
              fill: color[0],
              stroke: 'hsl(var(--card))',
              strokeWidth: 2,
            }}
          />
        </AreaChart>
    </ChartContainer>
  );
}

interface GradientBarProps {
  data: Array<Record<string, string | number>>;
  dataKey: string;
  xKey?: string;
  height?: number;
  color?: string;
  showGrid?: boolean;
  rounded?: boolean;
}

export function GradientBarChart({
  data,
  dataKey,
  xKey = 'name',
  height = 200,
  color = defaultGradients.accent[0],
  showGrid = true,
}: GradientBarProps) {
  const barGradientId = `bar-gradient-${dataKey}`;
  const config = {
    [dataKey]: {
      label: dataKey,
      color,
    },
  } satisfies ChartConfig;

  return (
    <ChartContainer config={config} className="w-full" style={{ height }}>
        <BarChart data={data} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id={barGradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.9} />
              <stop offset="100%" stopColor={color} stopOpacity={0.4} />
            </linearGradient>
          </defs>
          {showGrid && (
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="hsl(var(--border))"
              strokeOpacity={0.4}
              vertical={false}
            />
          )}
          <XAxis
            dataKey={xKey}
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            dy={8}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            dx={-4}
          />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Bar
            dataKey={dataKey}
            fill={`url(#${barGradientId})`}
            radius={[6, 6, 0, 0]}
          >
            {data.map((_, index) => (
              <Cell key={`cell-${index}`} />
            ))}
          </Bar>
        </BarChart>
    </ChartContainer>
  );
}

interface StatCardProps {
  label: string;
  value: string | number;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  icon?: React.ReactNode;
}

export function StatCard({ label, value, trend, trendValue, icon }: StatCardProps) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-5">
        <div className="flex items-center justify-between">
          {icon && <div className="text-secondary [&_svg]:size-5">{icon}</div>}
          {trend && (
            <Badge variant={trend === 'down' ? 'danger' : trend === 'up' ? 'success' : 'default'}>
              {trendValue || ''}
            </Badge>
          )}
        </div>
        <span className="text-3xl font-semibold text-foreground tracking-tight">
          {value}
        </span>
        <span className="text-xs text-muted-foreground font-medium">
          {label}
        </span>
      </CardContent>
    </Card>
  );
}
