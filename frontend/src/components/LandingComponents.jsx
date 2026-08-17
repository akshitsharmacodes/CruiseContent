import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, MessageSquare, Zap, Play, ChevronDown, CheckCircle2 } from 'lucide-react';
import { FaFacebook, FaInstagram } from 'react-icons/fa';
import { FaXTwitter } from 'react-icons/fa6';
import { Button } from '@/components/ui/button';

// 1. Trusted By Marquee
export function TrustedByMarquee() {
  const logos = [
    "ACME Corp", "GlobalTech", "StartUp Inc", "VentureLabs", "DesignCo",
    "ACME Corp", "GlobalTech", "StartUp Inc", "VentureLabs", "DesignCo"
  ];
  return (
    <div className="w-full py-10 overflow-hidden border-t border-border/50 bg-secondary/10 flex flex-col items-center">
      <p className="text-sm font-semibold text-muted-foreground mb-6 uppercase tracking-widest">Trusted by innovative teams worldwide</p>
      <div className="flex space-x-12 animate-marquee whitespace-nowrap">
        {logos.map((logo, i) => (
          <span key={i} className="text-xl font-bold text-muted-foreground/50">{logo}</span>
        ))}
      </div>
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes marquee {
          0% { transform: translateX(0%); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee {
          display: inline-flex;
          animation: marquee 20s linear infinite;
        }
      `}} />
    </div>
  );
}

// 2. Interactive Before & After Demo
export function InteractiveDemo() {
  const [isGenerated, setIsGenerated] = useState(false);

  return (
    <section className="py-24 px-6 lg:px-12 bg-background relative overflow-hidden">
      <div className="max-w-5xl mx-auto text-center">
        <h2 className="text-3xl md:text-5xl font-semibold tracking-tight mb-4">See the magic happen.</h2>
        <p className="text-muted-foreground text-lg mb-12">From a raw thought to a polished post in seconds.</p>
        
        <div className="grid md:grid-cols-2 gap-8 items-center bg-card border border-border/50 rounded-3xl p-6 lg:p-10 shadow-2xl">
          <div className="text-left space-y-4">
            <h3 className="font-semibold text-muted-foreground">1. Your Input</h3>
            <textarea 
              readOnly 
              className="w-full h-32 bg-secondary/50 border border-border rounded-xl p-4 text-foreground font-mono text-sm resize-none"
              value="we just released a new feature. it lets users switch between workspaces easily. this is good for agencies who manage multiple clients."
            />
            <Button 
              onClick={() => setIsGenerated(true)} 
              className="w-full h-12 bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl"
            >
              Generate Post <Zap className="w-4 h-4 ml-2" />
            </Button>
          </div>

          <div className="text-left space-y-4">
            <h3 className="font-semibold text-muted-foreground">2. AI Output</h3>
            <div className={`w-full h-48 bg-background border border-border rounded-xl p-6 transition-all duration-500 relative ${isGenerated ? 'opacity-100 shadow-xl' : 'opacity-50 blur-sm'}`}>
              {!isGenerated && <div className="absolute inset-0 flex items-center justify-center"><Play className="w-8 h-8 text-muted-foreground" /></div>}
              {isGenerated && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">You</div>
                    <div>
                      <p className="font-bold text-sm">Your Brand <span className="text-muted-foreground font-normal">@brand</span></p>
                    </div>
                  </div>
                  <p className="text-sm">🚀 Huge Update! Managing multiple clients just got easier.</p>
                  <p className="text-sm">You can now seamlessly switch between workspaces in one click. Perfect for agencies looking to scale without the friction.</p>
                  <p className="text-sm text-primary">#Update #SaaS #AgencyLife</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// 3. Bento Grid
export function BentoGrid() {
  return (
    <section className="py-24 bg-secondary/20 px-6 lg:px-12 border-t border-border/50">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-semibold tracking-tight mb-4">Everything you need to scale.</h2>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">A powerful suite of tools designed for modern creators.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 auto-rows-[250px]">
          <div className="md:col-span-2 bg-card border border-border/50 rounded-3xl p-8 relative overflow-hidden shadow-sm group">
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl -z-10 group-hover:bg-primary/20 transition-all duration-500" />
            <h3 className="text-2xl font-bold mb-2">Context Injection</h3>
            <p className="text-muted-foreground max-w-sm mb-6">Tell us about your business once. We inject your operational hours, services, and brand tone into every single post.</p>
            <div className="bg-background border border-border rounded-xl p-4 max-w-sm shadow-md">
              <p className="text-xs text-muted-foreground mb-2">System Context applied:</p>
              <div className="flex gap-2 flex-wrap">
                <span className="bg-secondary px-2 py-1 rounded text-xs font-medium">Tone: Professional</span>
                <span className="bg-secondary px-2 py-1 rounded text-xs font-medium">Services: B2B</span>
              </div>
            </div>
          </div>

          <div className="bg-card border border-border/50 rounded-3xl p-8 relative overflow-hidden shadow-sm">
            <h3 className="text-xl font-bold mb-2">Multi-Platform</h3>
            <p className="text-muted-foreground text-sm mb-6">Generate for X, Facebook, and Instagram simultaneously.</p>
            <div className="flex space-x-2">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold"><FaFacebook className="w-5 h-5" /></div>
              <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-800 font-bold"><FaXTwitter className="w-5 h-5" /></div>
              <div className="w-10 h-10 rounded-full bg-pink-100 flex items-center justify-center text-pink-600 font-bold"><FaInstagram className="w-5 h-5" /></div>
            </div>
          </div>

          <div className="bg-primary text-primary-foreground border border-border/50 rounded-3xl p-8 relative overflow-hidden shadow-lg shadow-primary/20 flex flex-col justify-between">
            <div>
              <h3 className="text-xl font-bold mb-2">AI Image Generation</h3>
              <p className="text-primary-foreground/80 text-sm">Stunning visuals generated automatically to match your text.</p>
            </div>
            <Button variant="secondary" className="w-fit rounded-full bg-background text-foreground hover:bg-background/90">Try it out</Button>
          </div>

          <div className="md:col-span-2 bg-card border border-border/50 rounded-3xl p-8 relative overflow-hidden shadow-sm">
            <h3 className="text-2xl font-bold mb-2">Analytics & Scheduling</h3>
            <p className="text-muted-foreground max-w-sm">Coming soon. Review your post performance and schedule them weeks in advance directly from the dashboard.</p>
            <div className="absolute -bottom-10 -right-10 w-64 h-48 bg-secondary/50 border border-border rounded-tl-2xl p-4 rotate-[-5deg]">
              <div className="w-full h-4 bg-muted rounded mb-2" />
              <div className="w-3/4 h-4 bg-primary/50 rounded mb-2" />
              <div className="w-1/2 h-4 bg-muted rounded" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// 4. FAQ Section
export function FAQSection() {
  const faqs = [
    { q: "Do I need my own OpenAI API key?", a: "No, we provide built-in models on the Starter and Pro plans. However, you can use your own key on the Enterprise plan." },
    { q: "Which platforms are supported?", a: "Currently, we support Facebook Pages, X (Twitter), and Instagram (Pro). LinkedIn is coming soon!" },
    { q: "Can I manage multiple businesses?", a: "Yes! Our Pro plan includes Unlimited Workspaces, so you can manage different brands or clients from one account." },
    { q: "Is the generated content unique?", a: "Absolutely. By injecting your specific business context and tone guidelines, the AI ensures every post sounds distinctly like your brand." }
  ];

  return (
    <section className="py-24 px-6 lg:px-12 bg-background border-t border-border/50">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-5xl font-semibold tracking-tight mb-4">Frequently Asked Questions</h2>
          <p className="text-muted-foreground text-lg">Got questions? We've got answers.</p>
        </div>
        <div className="space-y-4">
          {faqs.map((faq, i) => (
            <details key={i} className="group bg-card border border-border/50 rounded-2xl p-6 [&_summary::-webkit-details-marker]:hidden cursor-pointer shadow-sm">
              <summary className="flex items-center justify-between font-semibold text-lg text-foreground">
                {faq.q}
                <ChevronDown className="w-5 h-5 text-muted-foreground transition-transform group-open:rotate-180" />
              </summary>
              <p className="mt-4 text-muted-foreground leading-relaxed">
                {faq.a}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
