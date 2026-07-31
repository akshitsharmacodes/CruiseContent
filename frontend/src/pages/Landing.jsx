import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { 
  ArrowRight, Sparkles, Ship, CheckCircle2, BarChart3, Clock, 
  Image as ImageIcon, FileText, Send, User, Activity, 
  Star, Quote, MessageSquare
} from 'lucide-react';
import { motion } from 'framer-motion';
import { FaGithub, FaLinkedin, FaFacebook, FaKey, FaCreditCard, FaInstagram, FaWhatsapp } from "react-icons/fa";
import { FaXTwitter } from "react-icons/fa6";

export default function Landing() {
  const fadeInUp = {
    hidden: { opacity: 0, y: 40 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: "easeOut" } }
  };

  const staggerContainer = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2
      }
    }
  };

  const testimonials = [
    {
      name: "Sarah Jenkins",
      role: "Social Media Manager",
      image: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=150",
      content: "CruiseContent completely changed how I manage my clients' accounts. The context injection feature means I never have to remind it about brand tone."
    },
    {
      name: "David Chen",
      role: "Founder, TechStart",
      image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=150",
      content: "I literally just type 'we launched a new feature today' and it writes the perfect Twitter thread and LinkedIn post instantly. Magic."
    },
    {
      name: "Emily Rodriguez",
      role: "Content Creator",
      image: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&q=80&w=150",
      content: "The dynamic image generation is insane. It creates visuals that perfectly match the text, saving me hours in Photoshop."
    }
  ];

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans relative">
      
      {/* Hero Section */}
      <section className="flex-1 flex flex-col items-center justify-center px-6 pt-32 lg:pt-48 pb-24 text-center max-w-5xl mx-auto relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/5 rounded-full blur-3xl -z-10" />
        
        <motion.div 
          initial="hidden"
          animate="visible"
          variants={staggerContainer}
          className="flex flex-col items-center"
        >
          <motion.div variants={fadeInUp} className="inline-flex items-center rounded-full border border-border/50 bg-background/50 backdrop-blur-sm px-4 py-1.5 text-sm text-muted-foreground mb-8 shadow-sm">
            <span className="flex h-2 w-2 rounded-full bg-primary mr-2 animate-pulse"></span>
            Now powered by GPT-4o & OpenRouter
          </motion.div>
          
          <motion.h1 variants={fadeInUp} className="text-5xl md:text-7xl font-bold tracking-tighter mb-6 text-foreground leading-[1.1]">
            Social media on <br className="hidden md:block"/>
            <span className="text-muted-foreground italic font-serif bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/50">absolute autopilot.</span>
          </motion.h1>
          
          <motion.p variants={fadeInUp} className="text-lg md:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed">
            The editorial-grade automation suite for modern brands. Generate, refine, and deploy cross-platform content directly from your raw thoughts.
          </motion.p>
          
          <motion.div variants={fadeInUp} className="flex flex-col sm:flex-row items-center gap-4 w-full justify-center">
            <Link to="/signup">
              <Button size="lg" className="w-full sm:w-auto bg-primary text-primary-foreground hover:bg-primary/90 rounded-full px-8 h-14 text-base shadow-xl shadow-primary/20 transition-all hover:-translate-y-1">
                Get Started Now <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </Link>
            <Link to="/dashboard">
              <Button variant="outline" size="lg" className="w-full sm:w-auto rounded-full px-8 h-14 text-base border-border hover:bg-secondary transition-all">
                View Demo
              </Button>
            </Link>
          </motion.div>
        </motion.div>
        
        <motion.div 
          initial={{ opacity: 0, y: 100 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.4, ease: "easeOut" }}
          className="mt-24 w-full rounded-2xl overflow-hidden border border-border/50 shadow-2xl relative bg-card"
        >
          <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent z-10 pointer-events-none" />
          <img 
            src="/hero_landing.png" 
            alt="CruiseContent Dashboard showing analytics and post generation" 
            className="w-full h-auto object-cover transform hover:scale-[1.02] transition-transform duration-1000"
          />
        </motion.div>
      </section>

      {/* Workflow Section */}
      <section id="workflow" className="py-24 px-6 lg:px-12 border-t border-border/50 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/5 rounded-full blur-3xl -z-10" />
        <div className="max-w-6xl mx-auto">
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={fadeInUp}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-5xl font-semibold tracking-tight mb-4">How it works.</h2>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">A seamless pipeline from raw idea to published masterpiece.</p>
          </motion.div>

          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
            variants={staggerContainer}
            className="flex flex-col md:flex-row items-center justify-between gap-4 relative"
          >
            <div className="hidden md:block absolute top-1/2 left-0 w-full h-[2px] bg-border/50 -translate-y-1/2 -z-10" />

            {/* Step 1 */}
            <motion.div variants={fadeInUp} className="bg-card border border-border/50 p-6 rounded-2xl w-full md:w-1/4 shadow-lg shadow-black/5 flex flex-col items-center text-center relative">
              <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center mb-4 ring-8 ring-background">
                <FileText className="w-5 h-5 text-foreground" />
              </div>
              <h3 className="font-semibold mb-2">1. Input</h3>
              <p className="text-sm text-muted-foreground">Provide a raw thought, a URL, or an image. We handle the rest.</p>
            </motion.div>

            {/* Step 2 */}
            <motion.div variants={fadeInUp} className="bg-card border border-border/50 p-6 rounded-2xl w-full md:w-1/4 shadow-lg shadow-black/5 flex flex-col items-center text-center relative">
              <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-4 ring-8 ring-background">
                <BarChart3 className="w-5 h-5" />
              </div>
              <h3 className="font-semibold mb-2">2. Classification</h3>
              <p className="text-sm text-muted-foreground">AI detects the perfect tone, goal, and format based on your brand context.</p>
            </motion.div>

            {/* Step 3 */}
            <motion.div variants={fadeInUp} className="bg-card border border-border/50 p-6 rounded-2xl w-full md:w-1/4 shadow-lg shadow-black/5 flex flex-col items-center text-center relative">
              <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center mb-4 ring-8 ring-background">
                <ImageIcon className="w-5 h-5 text-foreground" />
              </div>
              <h3 className="font-semibold mb-2">3. Generation</h3>
              <p className="text-sm text-muted-foreground">Custom text and stunning images are generated simultaneously.</p>
            </motion.div>

            {/* Step 4 */}
            <motion.div variants={fadeInUp} className="bg-card border border-border/50 p-6 rounded-2xl w-full md:w-1/4 shadow-lg shadow-black/5 flex flex-col items-center text-center relative">
              <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center mb-4 ring-8 ring-background shadow-lg shadow-primary/20">
                <Send className="w-5 h-5" />
              </div>
              <h3 className="font-semibold mb-2">4. Publish</h3>
              <p className="text-sm text-muted-foreground">Review and blast your content across all social networks instantly.</p>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Services/Features Section */}
      <section id="services" className="py-24 bg-secondary/30 px-6 lg:px-12 border-t border-border/50">
        <div className="max-w-6xl mx-auto">
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={fadeInUp}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-5xl font-semibold tracking-tight mb-4">Everything you need to scale.</h2>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">We've ripped out the complex integrations so you can focus strictly on what matters: your brand's voice.</p>
          </motion.div>

          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
            variants={staggerContainer}
            className="grid md:grid-cols-3 gap-8"
          >
            <motion.div variants={fadeInUp} className="bg-card border border-border/50 hover:border-primary/30 transition-colors p-8 rounded-2xl flex flex-col items-start shadow-sm hover:shadow-md">
              <div className="p-3 bg-secondary rounded-xl mb-6">
                <Sparkles className="w-6 h-6 text-foreground" />
              </div>
              <h3 className="text-xl font-semibold mb-3">AI Generation</h3>
              <p className="text-muted-foreground leading-relaxed">
                Powered by cutting edge AI, we analyze your raw thoughts or blog URLs and generate platform-optimized posts automatically.
              </p>
            </motion.div>
            
            <motion.div variants={fadeInUp} className="bg-card border border-border/50 hover:border-primary/30 transition-colors p-8 rounded-2xl flex flex-col items-start shadow-sm hover:shadow-md">
              <div className="p-3 bg-secondary rounded-xl mb-6">
                <CheckCircle2 className="w-6 h-6 text-foreground" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Context Injection</h3>
              <p className="text-muted-foreground leading-relaxed">
                Tell us about your business once. We inject your operational hours, services, and brand tone into every single post.
              </p>
            </motion.div>

            <motion.div variants={fadeInUp} className="bg-card border border-border/50 hover:border-primary/30 transition-colors p-8 rounded-2xl flex flex-col items-start shadow-sm hover:shadow-md">
              <div className="p-3 bg-secondary rounded-xl mb-6">
                <Clock className="w-6 h-6 text-foreground" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Cross-Platform</h3>
              <p className="text-muted-foreground leading-relaxed">
                Generate for Twitter, Facebook, and Instagram simultaneously. Review them side-by-side and publish with one click.
              </p>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section id="testimonials" className="py-24 px-6 lg:px-12 border-t border-border/50 relative overflow-hidden">
        <div className="absolute top-1/2 left-0 w-[400px] h-[400px] bg-primary/5 rounded-full blur-3xl -z-10" />
        <div className="max-w-6xl mx-auto">
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={fadeInUp}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-5xl font-semibold tracking-tight mb-4">Loved by creators.</h2>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">See how modern brands are saving hours every single week.</p>
          </motion.div>

          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
            variants={staggerContainer}
            className="grid md:grid-cols-3 gap-6"
          >
            {testimonials.map((testimonial, i) => (
              <motion.div key={i} variants={fadeInUp} className="bg-card border border-border/50 rounded-2xl p-6 shadow-sm flex flex-col h-full">
                <div className="flex items-center gap-2 mb-4 text-amber-400">
                  <Star className="w-4 h-4 fill-current" /><Star className="w-4 h-4 fill-current" /><Star className="w-4 h-4 fill-current" /><Star className="w-4 h-4 fill-current" /><Star className="w-4 h-4 fill-current" />
                </div>
                <p className="text-muted-foreground flex-1 mb-6 leading-relaxed relative">
                  <Quote className="absolute -top-2 -left-2 w-8 h-8 text-secondary -z-10 opacity-50" />
                  "{testimonial.content}"
                </p>
                <div className="flex items-center gap-4 mt-auto">
                  <img src={testimonial.image} alt={testimonial.name} className="w-12 h-12 rounded-full object-cover border-2 border-background shadow-sm" />
                  <div>
                    <h4 className="font-semibold text-sm text-foreground">{testimonial.name}</h4>
                    <p className="text-xs text-muted-foreground">{testimonial.role}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Platforms & API Integration Section */}
      <section id="platforms" className="py-24 px-6 lg:px-12 border-t border-border/50 bg-background/50">
        <div className="max-w-6xl mx-auto">
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={fadeInUp}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-5xl font-semibold tracking-tight mb-4">Integrations & Billing.</h2>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">Total transparency on platforms and AI model access.</p>
          </motion.div>

          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
            variants={staggerContainer}
            className="grid md:grid-cols-2 gap-8"
          >
            {/* Platforms */}
            <motion.div variants={fadeInUp} className="bg-card border border-border/50 p-8 rounded-3xl shadow-sm">
              <div className="p-3 bg-secondary rounded-xl mb-6 inline-flex">
                <Activity className="w-6 h-6 text-foreground" />
              </div>
              <h3 className="text-2xl font-semibold mb-4">Supported Platforms</h3>
              <ul className="space-y-6">
                <li className="flex items-start">
                  <FaFacebook className="w-6 h-6 text-blue-600 mt-1 mr-4 shrink-0" />
                  <div>
                    <h4 className="font-semibold text-foreground">Facebook Pages</h4>
                    <p className="text-sm text-muted-foreground mt-1">Included in all plans (Free Tier). Perfect for broad audience engagement.</p>
                  </div>
                </li>
                <li className="flex items-start">
                  <FaXTwitter className="w-6 h-6 text-foreground mt-1 mr-4 shrink-0" />
                  <div>
                    <h4 className="font-semibold text-foreground">X (Twitter)</h4>
                    <p className="text-sm text-muted-foreground mt-1">Requires purchased credits due to rigid API constraints and X billing models.</p>
                  </div>
                </li>
                <li className="flex items-start">
                  <FaInstagram className="w-6 h-6 text-pink-500 mt-1 mr-4 shrink-0" />
                  <div>
                    <h4 className="font-semibold text-foreground">Instagram</h4>
                    <p className="text-sm text-muted-foreground mt-1">Supported in Pro and Enterprise tiers for visual-first automated publishing.</p>
                  </div>
                </li>
                <li className="flex items-start">
                  <FaWhatsapp className="w-6 h-6 text-green-500 mt-1 mr-4 shrink-0" />
                  <div>
                    <h4 className="font-semibold text-foreground">WhatsApp</h4>
                    <p className="text-sm text-muted-foreground mt-1">Direct messaging and broadcast support via the official WhatsApp Business API.</p>
                  </div>
                </li>
              </ul>
            </motion.div>

            {/* Custom API / Bring Your Own Key */}
            <motion.div variants={fadeInUp} className="bg-card border border-border/50 p-8 rounded-3xl shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-2xl -z-10" />
              <div className="p-3 bg-secondary rounded-xl mb-6 inline-flex">
                <FaKey className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-2xl font-semibold mb-4">Bring Your Own Key</h3>
              <p className="text-muted-foreground leading-relaxed mb-6">
                Want to use a specific, specialized AI model for text or image generation? We support that natively.
              </p>
              <div className="bg-background border border-border rounded-xl p-4 flex items-center gap-4">
                <FaCreditCard className="w-8 h-8 text-muted-foreground" />
                <p className="text-sm text-foreground">
                  Connect your own API key. The API billing will be charged directly to your card by the provider.
                </p>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-24 bg-secondary/30 px-6 lg:px-12 border-t border-border/50">
        <div className="max-w-6xl mx-auto">
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={fadeInUp}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-5xl font-semibold tracking-tight mb-4">Simple, transparent pricing.</h2>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">Start for free, scale when you need to.</p>
          </motion.div>

          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
            variants={staggerContainer}
            className="grid md:grid-cols-3 gap-8 items-center"
          >
            {/* Starter */}
            <motion.div variants={fadeInUp} className="bg-card border border-border/50 p-8 rounded-3xl shadow-sm">
              <h3 className="text-xl font-semibold mb-2">Starter</h3>
              <p className="text-muted-foreground text-sm mb-6">Perfect for trying things out.</p>
              <div className="mb-6"><span className="text-4xl font-bold">$0</span><span className="text-muted-foreground">/mo</span></div>
              <ul className="space-y-3 mb-8">
                {['1 Workspace', '10 AI Generations / mo', 'Basic Text Generation', 'Community Support'].map((feature, i) => (
                  <li key={i} className="flex items-center text-sm text-muted-foreground"><CheckCircle2 className="w-4 h-4 text-primary mr-3 shrink-0" />{feature}</li>
                ))}
              </ul>
              <Button variant="outline" className="w-full rounded-full h-12">Get Started</Button>
            </motion.div>
            
            {/* Pro */}
            <motion.div variants={fadeInUp} className="bg-card border-2 border-primary p-8 rounded-3xl shadow-xl shadow-primary/5 relative transform md:-translate-y-4">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                Most Popular
              </div>
              <h3 className="text-xl font-semibold mb-2">Pro</h3>
              <p className="text-muted-foreground text-sm mb-6">For serious creators and agencies.</p>
              <div className="mb-6"><span className="text-4xl font-bold">$29</span><span className="text-muted-foreground">/mo</span></div>
              <ul className="space-y-3 mb-8">
                {['Unlimited Workspaces', 'Unlimited AI Generations', 'HD Image Generation', 'Context Injection', 'Priority Support'].map((feature, i) => (
                  <li key={i} className="flex items-center text-sm text-foreground"><CheckCircle2 className="w-4 h-4 text-primary mr-3 shrink-0" />{feature}</li>
                ))}
              </ul>
              <Button className="w-full rounded-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground shadow-md shadow-primary/20">Subscribe Now</Button>
            </motion.div>

            {/* Enterprise */}
            <motion.div variants={fadeInUp} className="bg-card border border-border/50 p-8 rounded-3xl shadow-sm">
              <h3 className="text-xl font-semibold mb-2">Enterprise</h3>
              <p className="text-muted-foreground text-sm mb-6">Custom solutions for massive scale.</p>
              <div className="mb-6"><span className="text-4xl font-bold">$99</span><span className="text-muted-foreground">/mo</span></div>
              <ul className="space-y-3 mb-8">
                {['Everything in Pro', 'Custom AI Models', 'API Access', 'Dedicated Account Manager', 'SLA Guarantee'].map((feature, i) => (
                  <li key={i} className="flex items-center text-sm text-muted-foreground"><CheckCircle2 className="w-4 h-4 text-primary mr-3 shrink-0" />{feature}</li>
                ))}
              </ul>
              <Button variant="outline" className="w-full rounded-full h-12">Contact Sales</Button>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* About the Developer & Contact */}
      <section id="developer" className="py-24 px-6 lg:px-12 border-t border-border/50">
        <div className="max-w-6xl mx-auto">
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={staggerContainer}
            className="grid md:grid-cols-2 gap-12 items-center"
          >
            {/* Developer Card */}
            <motion.div variants={fadeInUp} className="bg-card border border-border/50 rounded-3xl p-8 md:p-12 shadow-xl shadow-black/5 flex flex-col md:flex-row items-center gap-8 h-full">
              <div className="w-32 h-32 shrink-0 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border-4 border-background shadow-inner">
                <User className="w-16 h-16 text-primary/50" />
              </div>
              <div className="text-center md:text-left">
                <div className="inline-flex items-center rounded-full bg-secondary px-3 py-1 text-xs font-medium text-foreground mb-4">
                  Founder & Developer
                </div>
                <h2 className="text-3xl font-bold tracking-tight mb-4">Akshit</h2>
                <p className="text-muted-foreground leading-relaxed italic border-l-2 border-primary/30 pl-4 py-1">
                  "A visionary full-stack developer passionate about AI and automation, building tools to empower creators."
                </p>
              </div>
            </motion.div>

            {/* Contact Form */}
            <motion.div variants={fadeInUp} className="bg-card border border-border/50 rounded-3xl p-8 md:p-12 shadow-sm h-full">
              <h3 className="text-2xl font-bold mb-2">Get in touch</h3>
              <p className="text-sm text-muted-foreground mb-6">Have questions? We'd love to hear from you.</p>
              <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-foreground">First Name</label>
                    <Input placeholder="John" className="bg-background" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-foreground">Last Name</label>
                    <Input placeholder="Doe" className="bg-background" />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-foreground">Email</label>
                  <Input type="email" placeholder="john@example.com" className="bg-background" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-foreground">Message</label>
                  <Textarea placeholder="How can we help?" className="bg-background resize-none h-24" />
                </div>
                <Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
                  Send Message <MessageSquare className="w-4 h-4 ml-2" />
                </Button>
              </form>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Fat Footer */}
      <footer className="border-t border-border/50 pt-20 pb-10 px-6 lg:px-12 bg-secondary/20">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-8 mb-16">
            <div className="col-span-2 lg:col-span-2">
              <div className="flex items-center gap-2 mb-6">
                <Ship className="w-6 h-6 text-primary" />
                <span className="font-bold text-xl text-foreground">CruiseContent</span>
              </div>
              <p className="text-muted-foreground text-sm leading-relaxed mb-6 max-w-sm">
                The ultimate AI-powered social media automation suite. Built by creators, for creators.
              </p>
              <div className="flex gap-4">
                <a href="#" className="w-10 h-10 rounded-full bg-background border border-border flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary transition-colors"><FaXTwitter className="w-4 h-4" /></a>
                <a href="#" className="w-10 h-10 rounded-full bg-background border border-border flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary transition-colors"><FaGithub className="w-4 h-4" /></a>
                <a href="#" className="w-10 h-10 rounded-full bg-background border border-border flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary transition-colors"><FaLinkedin className="w-4 h-4" /></a>
              </div>
            </div>
            
            <div>
              <h4 className="font-semibold text-foreground mb-4">Product</h4>
              <ul className="space-y-3 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-primary transition-colors">Features</a></li>
                <li><a href="#pricing" className="hover:text-primary transition-colors">Pricing</a></li>
                <li><a href="#" className="hover:text-primary transition-colors">Integrations</a></li>
                <li><a href="#" className="hover:text-primary transition-colors">Changelog</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold text-foreground mb-4">Company</h4>
              <ul className="space-y-3 text-sm text-muted-foreground">
                <li><a href="#developer" className="hover:text-primary transition-colors">About</a></li>
                <li><a href="#" className="hover:text-primary transition-colors">Blog</a></li>
                <li><a href="#" className="hover:text-primary transition-colors">Careers</a></li>
                <li><a href="#developer" className="hover:text-primary transition-colors">Contact</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold text-foreground mb-4">Legal</h4>
              <ul className="space-y-3 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-primary transition-colors">Privacy Policy</a></li>
                <li><a href="#" className="hover:text-primary transition-colors">Terms of Service</a></li>
                <li><a href="#" className="hover:text-primary transition-colors">Cookie Policy</a></li>
              </ul>
            </div>
          </div>
          
          <div className="pt-8 border-t border-border/50 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
            <p>© 2026 CruiseContent. All rights reserved.</p>
            <p className="flex items-center gap-1">Designed with <HeartIcon className="w-4 h-4 text-red-500" /> by Akshit</p>
          </div>
        </div>
      </footer>
      
    </div>
  );
}

function HeartIcon(props) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="currentColor"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
    </svg>
  )
}
