"use client";

import * as React from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { Lightbulb, Scale, Clock, AlertTriangle, Target, BadgeCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Loader2 } from "lucide-react";
import { useAdminRole } from "@/contexts/AdminContext";

interface MethodologyStat {
  methodology: string;
  total: number;
  deleted: number;
  success_rate: number;
  avg_rounds: number;
}

interface BureauPattern {
  total: number;
  avg_response_days: number | null;
  deleted_rate: number;
  no_response_rate: number;
}

interface ReasonCodeStat {
  code: string;
  total: number;
  deleted: number;
  success_rate: number;
}

interface CreditorStat {
  creditor: string;
  total: number;
  deleted: number;
  success_rate: number;
}

interface DisputeInsightsResponse {
  range: string;
  avg_time_to_deletion_days: number | null;
  methodology_effectiveness: MethodologyStat[];
  bureau_response_patterns: Record<string, BureauPattern>;
  reason_code_effectiveness: ReasonCodeStat[];
  creditor_effectiveness: CreditorStat[];
  recommendations: string[];
}

export function DisputeInsights() {
  const { userId } = useAdminRole();
  const preferencesKey = userId
    ? `admin-results-default-range:${userId}`
    : "admin-results-default-range";
  const [data, setData] = React.useState<DisputeInsightsResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [range, setRange] = React.useState<"week" | "month" | "all">(() => {
    if (typeof window === "undefined") return "month";
    const saved = window.localStorage.getItem(preferencesKey);
    if (saved === "week" || saved === "month" || saved === "all") return saved;
    return "month";
  });

  React.useEffect(() => {
    let cancelled = false;

    async function fetchInsights(currentRange: "week" | "month" | "all") {
      setLoading(true);
      try {
        const response = await fetch(
          `/api/admin/disputes/insights?range=${currentRange}`
        );
        if (!response.ok) return;
        const json: DisputeInsightsResponse = await response.json();
        if (!cancelled) setData(json);
      } catch (error) {
        console.error("Error fetching dispute insights:", error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchInsights(range);
    return () => {
      cancelled = true;
    };
  }, [range]);

  if (loading) {
    return (
      <Card className="bg-card/80 backdrop-blur-sm border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-serif flex items-center gap-2">
            <Lightbulb className="w-5 h-5 text-secondary" />
            Dispute Insights
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center py-6">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return null;
  }

  const methodologies = data.methodology_effectiveness;
  const bureauPatterns = data.bureau_response_patterns;
  const reasonCodes = data.reason_code_effectiveness || [];
  const creditors = data.creditor_effectiveness || [];

  return (
    <Card className="bg-card/80 backdrop-blur-sm border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg font-serif flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-secondary" />
              Dispute Insights
            </CardTitle>
            <CardDescription>
              Methodology performance & bureau response behavior
            </CardDescription>
          </div>
          <div className="flex rounded-lg border border-border overflow-hidden text-[11px]">
            {["week", "month", "all"].map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setRange(value as "week" | "month" | "all")}
                className={`px-2 py-1 transition-colors ${
                  range === value
                    ? "bg-secondary text-primary"
                    : "bg-background hover:bg-muted text-muted-foreground"
                }`}
              >
                {value === "week"
                  ? "This Week"
                  : value === "month"
                  ? "This Month"
                  : "All Time"}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Avg time to deletion */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/40 border border-border/50">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-secondary" />
            <span className="text-sm font-medium">Avg time-to-deletion</span>
          </div>
          <span className="text-sm font-semibold">
            {typeof data.avg_time_to_deletion_days === "number"
              ? `${data.avg_time_to_deletion_days.toFixed(1)} days`
              : "—"}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Methodology effectiveness */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
              <Scale className="w-3 h-3" /> Methodology effectiveness
            </p>
            {methodologies.length === 0 ? (
              <p className="text-xs text-muted-foreground">Not enough data yet.</p>
            ) : (
              <div className="space-y-1">
                {methodologies.map((m) => (
                  <Link
                    key={m.methodology}
                    href={`/admin/disputes?methodology=${encodeURIComponent(
                      m.methodology
                    )}&outcome=deleted`}
                    className="block rounded-md hover:bg-muted/60 transition-colors"
                  >
                    <motion.div
                      initial={{ opacity: 0, x: -5 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex items-center justify-between text-xs py-1 px-2"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="truncate font-medium">
                          {m.methodology === "standard" ? "Standard" : m.methodology}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {m.deleted}/{m.total} deleted • avg R
                          {m.avg_rounds.toFixed(1)}
                        </p>
                      </div>
                      <span className="ml-2 text-xs font-semibold text-green-500">
                        {m.success_rate}%
                      </span>
                    </motion.div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Bureau response patterns */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> Bureau response patterns
            </p>
            {Object.keys(bureauPatterns).length === 0 ? (
              <p className="text-xs text-muted-foreground">Not enough data yet.</p>
            ) : (
              <div className="space-y-1">
                {(["transunion", "experian", "equifax"] as const)
                  .filter((b) => bureauPatterns[b])
                  .map((bureau) => {
                    const stats = bureauPatterns[bureau];
                    if (!stats) return null;
                    const label =
                      bureau === "transunion"
                        ? "TransUnion"
                        : bureau === "experian"
                        ? "Experian"
                        : "Equifax";
                    return (
                      <Link
                        key={bureau}
                        href={`/admin/disputes?bureau=${bureau}&outcome=deleted`}
                        className="block rounded-md hover:bg-muted/60 transition-colors"
                      >
                        <motion.div
                          initial={{ opacity: 0, x: 5 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="flex items-center justify-between text-xs py-1 px-2"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="font-medium">{label}</p>
                            <p className="text-[11px] text-muted-foreground">
                              {stats.avg_response_days !== null
                                ? `${stats.avg_response_days.toFixed(1)}d avg response`
                                : "No responses recorded"}
                            </p>
                          </div>
                          <div className="text-right ml-2 text-[11px] text-muted-foreground">
                            <p>Deleted: {stats.deleted_rate}%</p>
                            <p>No response: {stats.no_response_rate}%</p>
                          </div>
                        </motion.div>
                      </Link>
                    );
                  })}
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Reason code effectiveness */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
              <Target className="w-3 h-3" /> Top reason codes
            </p>
            {reasonCodes.length === 0 ? (
              <p className="text-xs text-muted-foreground">Not enough data yet.</p>
            ) : (
              <div className="space-y-1">
                {reasonCodes.map((r) => (
                  <div key={r.code} className="flex items-center justify-between text-xs py-1 px-2 rounded-md bg-muted/40">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{r.code}</p>
                      <p className="text-[11px] text-muted-foreground">{r.deleted}/{r.total} deleted</p>
                    </div>
                    <span className="ml-2 text-xs font-semibold text-green-500">{r.success_rate}%</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Creditor effectiveness */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
              <BadgeCheck className="w-3 h-3" /> Furnisher results
            </p>
            {creditors.length === 0 ? (
              <p className="text-xs text-muted-foreground">Not enough data yet.</p>
            ) : (
              <div className="space-y-1">
                {creditors.map((c) => (
                  <div key={c.creditor} className="flex items-center justify-between text-xs py-1 px-2 rounded-md bg-muted/40">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{c.creditor}</p>
                      <p className="text-[11px] text-muted-foreground">{c.deleted}/{c.total} deleted</p>
                    </div>
                    <span className="ml-2 text-xs font-semibold text-green-500">{c.success_rate}%</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {data.recommendations && data.recommendations.length > 0 && (
          <div className="p-3 rounded-lg bg-muted/40 border border-border/60">
            <p className="text-xs font-semibold text-muted-foreground mb-2">Recommendations</p>
            <ul className="list-disc list-inside space-y-1 text-xs text-muted-foreground">
              {data.recommendations.map((rec, idx) => (
                <li key={idx}>{rec}</li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
