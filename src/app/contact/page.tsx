'use client';

import * as React from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Mail, Phone, MapPin, CheckCircle, Calendar, Sparkles } from 'lucide-react';
import { submitContactForm, ApiError } from '@/lib/api';
import { CalEmbed } from '@/components/CalEmbed';
import { motion } from 'framer-motion';
import { GradientOrbs, AnimatedGrid, NoiseOverlay } from '@/components/ui/AnimatedBackground';

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
        phone_number: formData.get('phone') as string || undefined,
        message: formData.get('message') as string || undefined,
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
      {/* Hero Section */}
      <section className="relative pt-32 pb-20 md:pt-40 md:pb-28 overflow-hidden">
        <GradientOrbs className="opacity-60" />
        <AnimatedGrid className="opacity-30" />
        <NoiseOverlay opacity={0.02} />
        <div className="absolute inset-0 bg-gradient-to-b from-background/70 via-background/50 to-background z-[1]" />
        
        <div className="container relative z-10 mx-auto px-4 md:px-6 text-center">
          <motion.div
            initial={{ opacity: 0, filter: "blur(10px)" }}
            animate={{ opacity: 1, filter: "blur(0px)" }}
            transition={{ duration: 0.6 }}
            className="mb-8"
          >
            <div className="relative inline-flex group">
              <div className="absolute -inset-1 bg-secondary/20 rounded-full blur-md" />
              <div className="relative inline-flex items-center gap-3 px-6 py-3 rounded-full bg-background/80 backdrop-blur-sm border border-secondary/30 text-foreground text-sm font-medium uppercase tracking-widest">
                <Calendar className="w-4 h-4 text-secondary" />
                Free Consultation
                <Sparkles className="w-4 h-4 text-secondary" />
              </div>
            </div>
          </motion.div>
          
          <motion.h1
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-serif font-bold tracking-tight leading-[1.1] mb-8"
          >
            <span className="text-foreground">Book Your Free</span>
            <span className="text-gradient-gold block"> Credit Consultation</span>
          </motion.h1>
          
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="flex items-center justify-center gap-4 mb-8"
          >
            <div className="h-px w-12 md:w-20 bg-gradient-to-r from-transparent to-secondary/50" />
            <div className="w-2 h-2 rounded-full bg-secondary animate-pulse" />
            <div className="h-px w-12 md:w-20 bg-gradient-to-l from-transparent to-secondary/50" />
          </motion.div>
          
          <motion.p
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-lg md:text-xl lg:text-2xl text-muted-foreground leading-relaxed font-light max-w-3xl mx-auto"
          >
            Take the first step towards better credit. Schedule a free consultation with our experts 
            to discuss your credit situation and learn how we can help.
          </motion.p>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent z-[2]" />
      </section>

      {/* Calendar Section */}
      <section className="py-16 bg-background relative">
        <div className="container mx-auto px-4 md:px-6">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="max-w-4xl mx-auto"
          >
            <Card className="bg-card/80 backdrop-blur-sm border-border/50 overflow-hidden">
              <CalEmbed />
            </Card>
          </motion.div>
        </div>
      </section>

      {/* Divider */}
      <div className="container mx-auto px-4">
        <div className="decorative-line" />
      </div>

      {/* Contact Form Section */}
      <section className="py-24 md:py-32 bg-background relative overflow-hidden">
        <GradientOrbs className="opacity-30" />
        <NoiseOverlay opacity={0.02} />
        
        <div className="container relative z-10 mx-auto px-4 md:px-6">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-serif font-bold mb-4 text-foreground">
              Or Send Us a <span className="text-gradient-gold">Message</span>
            </h2>
            <p className="text-lg text-muted-foreground">
              Prefer to reach out directly? Use the form below or contact us through any of our channels.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 max-w-6xl mx-auto">
            {/* Contact Info */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="space-y-8"
            >
              <div>
                <h3 className="text-2xl font-serif font-bold text-foreground mb-4">Contact Information</h3>
                <p className="text-lg text-muted-foreground">
                  Have questions about your credit? Ready to start your journey to financial freedom? 
                  Fill out the form or reach out to us directly.
                </p>
              </div>

              <div className="space-y-6">
                {[
                  { icon: Phone, title: "Phone", line1: "+1 (555) 123-4567", line2: "Mon-Fri, 9am - 6pm EST" },
                  { icon: Mail, title: "Email", line1: "info@toptierfinancial.com", line2: "We usually respond within 24 hours." },
                  { icon: MapPin, title: "Office", line1: "123 Financial District Blvd", line2: "New York, NY 10005" },
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-4 group">
                    <div className="p-4 rounded-xl bg-secondary/10 text-secondary group-hover:bg-secondary group-hover:text-white transition-all duration-300">
                      <item.icon className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="font-bold text-foreground">{item.title}</h3>
                      <p className="text-muted-foreground">{item.line1}</p>
                      <p className="text-sm text-muted-foreground/70">{item.line2}</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Contact Form */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <Card className="bg-card/80 backdrop-blur-sm border-border/50">
                <CardHeader>
                  <CardTitle className="font-serif text-2xl">Send us a Message</CardTitle>
                  <CardDescription>
                    Fill out the form below and we&apos;ll get back to you as soon as possible.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {isSuccess ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
                      <div className="p-4 bg-secondary/20 rounded-full text-secondary">
                        <CheckCircle className="h-12 w-12" />
                      </div>
                      <h3 className="text-2xl font-serif font-bold text-foreground">Message Sent!</h3>
                      <p className="text-muted-foreground">
                        Thank you for contacting us. We have received your message and will be in touch shortly.
                      </p>
                      <Button onClick={() => setIsSuccess(false)} variant="outline" className="rounded-full">
                        Send Another Message
                      </Button>
                    </div>
                  ) : (
                    <form onSubmit={handleSubmit} className="space-y-5">
                      {error && (
                        <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
                          {error}
                        </div>
                      )}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label htmlFor="firstName" className="text-sm font-medium text-foreground">First Name</label>
                          <Input id="firstName" name="firstName" placeholder="John" required className="bg-background/50" />
                        </div>
                        <div className="space-y-2">
                          <label htmlFor="lastName" className="text-sm font-medium text-foreground">Last Name</label>
                          <Input id="lastName" name="lastName" placeholder="Doe" required className="bg-background/50" />
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <label htmlFor="email" className="text-sm font-medium text-foreground">Email</label>
                        <Input id="email" name="email" type="email" placeholder="john@example.com" required className="bg-background/50" />
                      </div>

                      <div className="space-y-2">
                        <label htmlFor="phone" className="text-sm font-medium text-foreground">Phone (Optional)</label>
                        <Input id="phone" name="phone" type="tel" placeholder="+1 (555) 000-0000" className="bg-background/50" />
                      </div>

                      <div className="space-y-2">
                        <label htmlFor="message" className="text-sm font-medium text-foreground">Message</label>
                        <Textarea id="message" name="message" placeholder="How can we help you?" className="min-h-[120px] bg-background/50" required />
                      </div>

                      <div className="flex items-center gap-2">
                        <input type="checkbox" id="privacy" className="h-4 w-4 rounded border-border text-secondary focus:ring-secondary" required />
                        <label htmlFor="privacy" className="text-sm text-muted-foreground">
                          I agree to the <a href="/privacy" className="text-secondary hover:underline">Privacy Policy</a>
                        </label>
                      </div>

                      <Button type="submit" className="w-full h-12 bg-secondary text-secondary-foreground hover:bg-secondary/90 rounded-full" disabled={isSubmitting}>
                        {isSubmitting ? 'Sending...' : 'Send Message'}
                      </Button>
                    </form>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </section>
    </div>
  );
}
