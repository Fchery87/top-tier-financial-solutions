import { Shield, Scale, FileText } from 'lucide-react';

export default function CompliancePage() {
  return (
    <div className="container mx-auto px-4 md:px-6 py-12 md:py-24">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold tracking-tight text-slate-900 mb-8">Compliance & Consumer Rights</h1>
        
        <div className="prose prose-slate max-w-none">
          <p className="text-xl text-slate-600 mb-12">
            At Top Tier Financial Solutions, we take compliance seriously. We operate in full accordance with all federal and state laws governing credit repair organizations.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
            <div className="bg-slate-50 p-8 rounded-xl">
              <div className="flex items-center gap-3 mb-4">
                <Shield className="h-6 w-6 text-blue-600" />
                <h2 className="text-2xl font-bold m-0">CROA Compliance</h2>
              </div>
              <p className="text-slate-600">
                The Credit Repair Organizations Act (CROA) is a federal law that regulates the credit repair industry. We strictly adhere to CROA by:
              </p>
              <ul className="list-disc pl-6 mt-4 space-y-2 text-slate-600">
                <li>Providing a written contract before services begin.</li>
                <li>Offering a 3-day right to cancel without penalty.</li>
                <li>Not charging upfront fees for services not yet fully performed (where applicable).</li>
                <li>Never making misleading claims about our services or results.</li>
              </ul>
            </div>

            <div className="bg-slate-50 p-8 rounded-xl">
              <div className="flex items-center gap-3 mb-4">
                <Scale className="h-6 w-6 text-blue-600" />
                <h2 className="text-2xl font-bold m-0">FCRA Rights</h2>
              </div>
              <p className="text-slate-600">
                The Fair Credit Reporting Act (FCRA) gives you the right to a fair and accurate credit report. Under the FCRA, you have the right to:
              </p>
              <ul className="list-disc pl-6 mt-4 space-y-2 text-slate-600">
                <li>Know what is in your file.</li>
                <li>Dispute incomplete or inaccurate information.</li>
                <li>Have inaccurate information corrected or removed.</li>
                <li>Access your credit score (though you may have to pay for it).</li>
              </ul>
            </div>
          </div>

          <div className="mb-12">
            <div className="flex items-center gap-3 mb-4">
              <FileText className="h-6 w-6 text-blue-600" />
              <h2 className="text-2xl font-bold m-0">FDCPA Protection</h2>
            </div>
            <p className="text-slate-600">
              The Fair Debt Collection Practices Act (FDCPA) protects you from abusive, unfair, or deceptive debt collection practices. We help you understand these rights and can assist if collectors are violating them.
            </p>
          </div>

          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-6">
            <h3 className="text-lg font-bold text-yellow-800 mb-2">Important Disclaimer</h3>
            <p className="text-yellow-700 text-sm">
              Top Tier Financial Solutions is a credit repair organization. We are not a law firm and do not provide legal advice. If you need legal assistance, please consult with a qualified attorney. Results may vary and are not guaranteed.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
