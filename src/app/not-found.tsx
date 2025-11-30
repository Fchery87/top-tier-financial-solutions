import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Home, ArrowLeft, Search } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="text-center max-w-lg">
        <div className="relative mb-8">
          <span className="text-[150px] md:text-[200px] font-serif font-bold text-secondary/10 leading-none select-none">
            404
          </span>
          <div className="absolute inset-0 flex items-center justify-center">
            <Search className="w-16 h-16 md:w-24 md:h-24 text-secondary/50" />
          </div>
        </div>
        
        <h1 className="text-3xl md:text-4xl font-serif font-bold text-foreground mb-4">
          Page Not Found
        </h1>
        
        <p className="text-muted-foreground text-lg mb-8">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button asChild variant="outline" className="gap-2">
            <Link href="javascript:history.back()">
              <ArrowLeft className="w-4 h-4" />
              Go Back
            </Link>
          </Button>
          <Button asChild className="gap-2 bg-secondary text-secondary-foreground hover:bg-secondary/90">
            <Link href="/">
              <Home className="w-4 h-4" />
              Back to Home
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
