import { Shield, Scale, FileText, AlertTriangle } from 'lucide-react';

export default function CompliancePage() {
  return (
    <div className="container mx-auto px-4 md:px-6 pt-32 pb-20 md:pt-40 md:pb-28">
      <div className="max-w-4xl mx-auto">
        <p className="mb-4 font-mono text-[11px] font-medium uppercase tracking-[0.28em] text-secondary">
          Consumer Protection
        </p>
        <h1 className="font-display text-4xl md:text-5xl font-light tracking-tight text-foreground mb-6">
          Compliance &amp; Consumer Rights
        </h1>
        <p className="max-w-2xl text-lg leading-8 text-muted-foreground mb-14">
          At Top Tier Financial Solutions, we take compliance seriously. We operate in full
          accordance with all federal and state laws governing credit repair organizations.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="rounded-xl border border-border bg-card p-8">
            <div className="flex items-center gap-3 mb-4">
              <Shield className="h-6 w-6 text-secondary" />
              <h2 className="font-display text-2xl font-normal text-foreground m-0">CROA Compliance</h2>
            </div>
            <p className="text-muted-foreground leading-7">
              The Credit Repair Organizations Act (CROA) is a federal law that regulates the credit
              repair industry. We strictly adhere to CROA by:
            </p>
            <ul className="list-disc pl-6 mt-4 space-y-2 text-muted-foreground">
              <li>Providing a written contract before services begin.</li>
              <li>Offering a 3-day right to cancel without penalty.</li>
              <li>Not charging upfront fees for services not yet fully performed (where applicable).</li>
              <li>Never making misleading claims about our services or results.</li>
            </ul>
          </div>

          <div className="rounded-xl border border-border bg-card p-8">
            <div className="flex items-center gap-3 mb-4">
              <Scale className="h-6 w-6 text-secondary" />
              <h2 className="font-display text-2xl font-normal text-foreground m-0">FCRA Rights</h2>
            </div>
            <p className="text-muted-foreground leading-7">
              The Fair Credit Reporting Act (FCRA) gives you the right to a fair and accurate credit
              report. Under the FCRA, you have the right to:
            </p>
            <ul className="list-disc pl-6 mt-4 space-y-2 text-muted-foreground">
              <li>Know what is in your file.</li>
              <li>Dispute incomplete or inaccurate information.</li>
              <li>Have inaccurate information corrected or removed.</li>
              <li>Access your credit score (though you may have to pay for it).</li>
            </ul>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-8 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <FileText className="h-6 w-6 text-secondary" />
            <h2 className="font-display text-2xl font-normal text-foreground m-0">FDCPA Protection</h2>
          </div>
          <p className="text-muted-foreground leading-7">
            The Fair Debt Collection Practices Act (FDCPA) protects you from abusive, unfair, or
            deceptive debt collection practices. We help you understand these rights and can assist
            if collectors are violating them.
          </p>
        </div>

        <div className="rounded-xl border border-warning/30 bg-warning/[0.07] p-6">
          <h3 className="flex items-center gap-2 text-base font-semibold text-warning mb-2">
            <AlertTriangle className="h-5 w-5" />
            Important Disclaimer
          </h3>
          <p className="text-sm leading-6 text-muted-foreground">
            Top Tier Financial Solutions is a credit repair organization. We are not a law firm and
            do not provide legal advice. If you need legal assistance, please consult with a qualified
            attorney. Results may vary and are not guaranteed.
          </p>
        </div>
      </div>
    </div>
  );
}
