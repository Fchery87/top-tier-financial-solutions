'use client';

import * as React from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Mail, Phone, MapPin, CheckCircle } from 'lucide-react';
import { submitContactForm, ApiError } from '@/lib/api';
import { CalEmbed } from '@/components/CalEmbed';
import { PageHeader } from '@/components/PageHeader';

const contactChannels = [
  { icon: Phone, title: 'Phone', line1: '+1 (555) 123-4567', line2: 'Mon-Fri, 9am - 6pm EST' },
  { icon: Mail, title: 'Email', line1: 'info@toptierfinancial.com', line2: 'We usually respond within 24 hours.' },
  { icon: MapPin, title: 'Office', line1: '123 Financial District Blvd', line2: 'New York, NY 10005' },
];

export default function ContactPage() {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isSuccess, setIsSuccess] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const formData = new FormData(event.currentTarget);
    const firstName = formData.get('firstName') as string;
    const lastName = formData.get('lastName') as string;

    try {
      await submitContactForm({
        full_name: `${firstName} ${lastName}`.trim(),
        email: formData.get('email') as string,
        phone_number: (formData.get('phone') as string) || undefined,
        message: (formData.get('message') as string) || undefined,
      });
      setIsSuccess(true);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Something went wrong. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col">
      <PageHeader
        badge="Free Consultation"
        title="Book your free"
        titleHighlight="credit consultation."
        description="Take the first step toward better credit. Schedule a free consultation to discuss your situation and learn exactly how we can help."
      />

      {/* Calendar */}
      <section className="pb-16">
        <div className="container mx-auto px-4 md:px-6">
          <div className="mx-auto max-w-4xl">
            <Card className="overflow-hidden">
              <CalEmbed />
            </Card>
          </div>
        </div>
      </section>

      {/* Divider */}
      <div className="container mx-auto px-4">
        <div className="section-divider" />
      </div>

      {/* Contact Form */}
      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4 md:px-6">
          <div className="mb-14 text-center">
            <p className="font-mono text-[11px] font-medium uppercase tracking-[0.3em] text-secondary">
              Direct line
            </p>
            <h2 className="font-editorial mt-4 text-4xl leading-[1.1] text-foreground md:text-5xl">
              Or send us a <em>message.</em>
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
              Prefer to reach out directly? Use the form below or contact us through any of our channels.
            </p>
          </div>

          <div className="mx-auto grid max-w-6xl grid-cols-1 gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
            {/* Contact Info */}
            <div className="space-y-8">
              <div>
                <h3 className="text-xl font-semibold tracking-tight text-foreground">Contact information</h3>
                <p className="mt-3 leading-7 text-muted-foreground">
                  Have questions about your credit? Ready to get started? Fill out the form or
                  reach us directly — a real person answers.
                </p>
              </div>

              <div className="space-y-px overflow-hidden rounded-xl border border-border bg-border">
                {contactChannels.map((item) => (
                  <div key={item.title} className="flex items-start gap-4 bg-card p-5">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                      <item.icon className="h-[18px] w-[18px] text-secondary" strokeWidth={1.75} />
                    </span>
                    <div className="min-w-0">
                      <h4 className="text-sm font-semibold text-foreground">{item.title}</h4>
                      <p className="mt-0.5 text-sm text-foreground">{item.line1}</p>
                      <p className="mt-0.5 text-[13px] text-muted-foreground">{item.line2}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Form */}
            <Card>
              <CardHeader>
                <CardTitle className="text-xl font-semibold tracking-tight">Send us a message</CardTitle>
                <CardDescription>
                  Fill out the form below and we&apos;ll get back to you as soon as possible.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isSuccess ? (
                  <div className="flex flex-col items-center justify-center space-y-4 py-12 text-center">
                    <span className="flex h-14 w-14 items-center justify-center rounded-full bg-success/10 text-success">
                      <CheckCircle className="h-7 w-7" />
                    </span>
                    <h3 className="text-xl font-semibold tracking-tight text-foreground">Message sent</h3>
                    <p className="max-w-sm text-sm leading-6 text-muted-foreground">
                      Thank you for contacting us. We have received your message and will be in touch shortly.
                    </p>
                    <Button onClick={() => setIsSuccess(false)} variant="outline">
                      Send Another Message
                    </Button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-5">
                    {error && (
                      <div className="rounded-lg border border-destructive/25 bg-destructive/8 p-4 text-sm text-destructive">
                        {error}
                      </div>
                    )}
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <label htmlFor="firstName" className="text-sm font-medium text-foreground">
                          First Name
                        </label>
                        <Input id="firstName" name="firstName" placeholder="John" required />
                      </div>
                      <div className="space-y-2">
                        <label htmlFor="lastName" className="text-sm font-medium text-foreground">
                          Last Name
                        </label>
                        <Input id="lastName" name="lastName" placeholder="Doe" required />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label htmlFor="email" className="text-sm font-medium text-foreground">
                        Email
                      </label>
                      <Input id="email" name="email" type="email" placeholder="john@example.com" required />
                    </div>

                    <div className="space-y-2">
                      <label htmlFor="phone" className="text-sm font-medium text-foreground">
                        Phone <span className="font-normal text-muted-foreground">(optional)</span>
                      </label>
                      <Input id="phone" name="phone" type="tel" placeholder="+1 (555) 000-0000" />
                    </div>

                    <div className="space-y-2">
                      <label htmlFor="message" className="text-sm font-medium text-foreground">
                        Message
                      </label>
                      <Textarea
                        id="message"
                        name="message"
                        placeholder="How can we help you?"
                        className="min-h-[120px]"
                        required
                      />
                    </div>

                    <div className="flex items-center gap-2.5">
                      <input
                        type="checkbox"
                        id="privacy"
                        className="h-4 w-4 rounded border-border accent-[hsl(var(--secondary))]"
                        required
                      />
                      <label htmlFor="privacy" className="text-sm text-muted-foreground">
                        I agree to the{' '}
                        <a href="/privacy" className="text-secondary hover:underline">
                          Privacy Policy
                        </a>
                      </label>
                    </div>

                    <Button type="submit" className="h-12 w-full" disabled={isSubmitting}>
                      {isSubmitting ? 'Sending…' : 'Send Message'}
                    </Button>
                  </form>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </div>
  );
}
