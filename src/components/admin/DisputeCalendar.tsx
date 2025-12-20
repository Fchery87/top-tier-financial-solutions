"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { CalendarDays, Clock, AlertTriangle } from "lucide-react";

interface CalendarDispute {
  id: string;
  client_name: string;
  response_deadline: string | null;
  response_received_at: string | null;
  outcome: string | null;
  bureau: string;
  round: number;
  status: string;
}

interface Props {
  disputes: CalendarDispute[];
}

export function DisputeCalendar({ disputes }: Props) {
  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const startOffset = monthStart.getDay();

  const events = disputes
    .filter((d) => d.response_deadline)
    .map((d) => {
      const deadlineDate = d.response_deadline ? new Date(d.response_deadline) : null;
      const isResolved = !!d.response_received_at || !!d.outcome;
      let status: "overdue" | "urgent" | "open" | "resolved" = "open";
      if (isResolved) status = "resolved";
      if (deadlineDate) {
        const diffDays = Math.ceil((deadlineDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        if (!isResolved) {
          if (diffDays < 0) status = "overdue";
          else if (diffDays <= 7) status = "urgent";
        }
      }

      return {
        id: d.id,
        client: d.client_name,
        bureau: d.bureau,
        round: d.round,
        date: deadlineDate,
        status,
      };
    })
    .filter((e) => e.date);

  const upcoming = [...events]
    .filter((e) => e.status !== "resolved")
    .sort((a, b) => (a.date!.getTime() - b.date!.getTime()))
    .slice(0, 6);

  const days: Array<{ day: number | null; events: typeof events }> = [];
  for (let i = 0; i < startOffset; i++) {
    days.push({ day: null, events: [] });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const dateKey = new Date(today.getFullYear(), today.getMonth(), d).toDateString();
    const dayEvents = events.filter((e) => e.date && e.date.toDateString() === dateKey);
    days.push({ day: d, events: dayEvents });
  }

  const statusColor = (status: string) => {
    switch (status) {
      case "overdue":
        return "bg-red-500";
      case "urgent":
        return "bg-amber-500";
      case "resolved":
        return "bg-emerald-500";
      default:
        return "bg-blue-500";
    }
  };

  return (
    <Card className="bg-card/80 backdrop-blur-sm border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-secondary" /> Deadline Calendar
            </CardTitle>
            <CardDescription>Response clocks for this month</CardDescription>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" /> Overdue</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" /> 7d</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" /> Open</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-7 gap-2 text-xs text-muted-foreground">
          {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((d) => (
            <div key={d} className="text-center font-medium">{d}</div>
          ))}
          {days.map((cell, idx) => (
            <div
              key={idx}
              className={`min-h-[70px] rounded-md border border-border/60 p-1 ${cell.day === today.getDate() ? 'ring-1 ring-secondary' : ''}`}
            >
              <div className="text-right text-[11px] font-semibold text-muted-foreground">{cell.day || ''}</div>
              <div className="flex flex-wrap gap-1 mt-1">
                {cell.events.slice(0, 3).map((evt) => (
                  <span
                    key={evt.id}
                    title={`${evt.client} • ${evt.bureau.toUpperCase()} • R${evt.round}`}
                    className={`w-2 h-2 rounded-full ${statusColor(evt.status)}`}
                  />
                ))}
                {cell.events.length > 3 && (
                  <span className="text-[10px] text-muted-foreground">+{cell.events.length - 3}</span>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            <Clock className="w-4 h-4" /> Upcoming deadlines
          </div>
          {upcoming.length === 0 ? (
            <p className="text-xs text-muted-foreground">No open deadlines this month.</p>
          ) : (
            <div className="space-y-1">
              {upcoming.map((evt) => (
                <div key={evt.id} className="flex items-center justify-between text-xs p-2 rounded-md border border-border/60">
                  <div>
                    <p className="font-medium">{evt.client}</p>
                    <p className="text-[11px] text-muted-foreground">{evt.bureau.toUpperCase()} • Round {evt.round}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${statusColor(evt.status)}`} />
                    <span className="text-[11px] text-muted-foreground">{evt.date?.toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
          {events.some((e) => e.status === 'overdue') && (
            <div className="flex items-center gap-2 text-xs text-red-500 mt-1">
              <AlertTriangle className="w-4 h-4" /> You have overdue disputes that need escalation.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
