import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { LoggedReading } from "@/lib/devices-api";

type ReadingsChartProps = {
  readings: LoggedReading[];
};

type ChartPoint = {
  ts: number;
  label: string;
  temperature: number;
  humidity: number;
};

function formatTimeLabel(ms: number): string {
  const d = new Date(ms);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

export default function ReadingsChart({ readings }: ReadingsChartProps) {
  const data: ChartPoint[] = readings.map((r) => {
    const ms = new Date(r.ts).getTime();
    return {
      ts: ms,
      label: formatTimeLabel(ms),
      temperature: r.temperature,
      humidity: r.humidity,
    };
  });

  if (data.length === 0) {
    return (
      <div className="flex h-72 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/60 text-sm text-slate-500">
        No logged readings yet. Start logging to begin recording data.
      </div>
    );
  }

  return (
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{ top: 12, right: 16, left: 0, bottom: 8 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: "#64748b" }}
            stroke="#cbd5e1"
            minTickGap={32}
          />
          <YAxis
            yAxisId="temp"
            orientation="left"
            tick={{ fontSize: 11, fill: "#dc2626" }}
            stroke="#fecaca"
            tickFormatter={(v: number) => `${v}°`}
            domain={["auto", "auto"]}
          />
          <YAxis
            yAxisId="hum"
            orientation="right"
            tick={{ fontSize: 11, fill: "#2563eb" }}
            stroke="#bfdbfe"
            tickFormatter={(v: number) => `${v}%`}
            domain={[0, 100]}
          />
          <Tooltip
            contentStyle={{
              borderRadius: 12,
              border: "1px solid #e2e8f0",
              boxShadow: "0 10px 25px rgba(15, 23, 42, 0.08)",
              fontSize: 12,
            }}
            labelFormatter={(_label, payload) => {
              const first = Array.isArray(payload) ? payload[0] : undefined;
              const ts = (first?.payload as { ts?: number } | undefined)?.ts;
              return typeof ts === "number"
                ? new Date(ts).toLocaleString()
                : "";
            }}
            formatter={(value, name) => {
              const num = typeof value === "number" ? value : Number(value);
              if (name === "Temperature")
                return [`${Number.isFinite(num) ? num.toFixed(1) : value} °C`, name];
              if (name === "Humidity")
                return [`${Number.isFinite(num) ? num.toFixed(1) : value} %`, name];
              return [value as never, name];
            }}
          />
          <Legend
            wrapperStyle={{ fontSize: 12 }}
            iconType="circle"
          />
          <Line
            yAxisId="temp"
            type="monotone"
            dataKey="temperature"
            name="Temperature"
            stroke="#dc2626"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
            isAnimationActive={false}
          />
          <Line
            yAxisId="hum"
            type="monotone"
            dataKey="humidity"
            name="Humidity"
            stroke="#2563eb"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
