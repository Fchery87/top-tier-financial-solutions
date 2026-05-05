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
        <div key={index} className="border border-border rounded-lg overflow-hidden">
          <button
            className="flex w-full items-center justify-between p-4 bg-background hover:bg-muted transition-colors text-left"
            onClick={() => setOpenIndex(openIndex === index ? null : index)}
            aria-expanded={openIndex === index}
          >
            <span className="font-medium text-foreground">{item.title}</span>
            <ChevronDown
              className={cn(
                "h-5 w-5 text-muted-foreground transition-transform duration-200",
                openIndex === index ? "rotate-180" : ""
              )}
            />
          </button>
          <div
            className={cn(
              "bg-muted overflow-hidden transition-all duration-300 ease-in-out",
              openIndex === index ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
            )}
          >
            <div className="p-4 text-muted-foreground border-t border-border">
              {item.content}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
