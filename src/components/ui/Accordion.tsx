'use client';

import * as React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AccordionProps {
  items: {
    title: string;
    content: React.ReactNode;
  }[];
}

export function Accordion({ items }: AccordionProps) {
  const [openIndex, setOpenIndex] = React.useState<number | null>(null);

  return (
    <div className="space-y-4">
      {items.map((item, index) => (
        <div key={index} className="border border-slate-200 rounded-lg overflow-hidden">
          <button
            className="flex w-full items-center justify-between p-4 bg-white hover:bg-slate-50 transition-colors text-left"
            onClick={() => setOpenIndex(openIndex === index ? null : index)}
            aria-expanded={openIndex === index}
          >
            <span className="font-medium text-slate-900">{item.title}</span>
            <ChevronDown
              className={cn(
                "h-5 w-5 text-slate-500 transition-transform duration-200",
                openIndex === index ? "rotate-180" : ""
              )}
            />
          </button>
          <div
            className={cn(
              "bg-slate-50 overflow-hidden transition-all duration-300 ease-in-out",
              openIndex === index ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
            )}
          >
            <div className="p-4 text-slate-600 border-t border-slate-200">
              {item.content}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
