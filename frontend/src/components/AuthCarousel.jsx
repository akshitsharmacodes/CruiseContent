import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Quote, Sparkles, Zap, LayoutDashboard } from 'lucide-react';

const slides = [
  {
    id: 1,
    title: "10x your content output.",
    description: "CruiseContent uses advanced AI to instantly generate high-converting social media posts that sound exactly like you.",
    icon: <Zap className="w-8 h-8 text-amber-400" />,
    image: "/hero_landing.png"
  },
  {
    id: 2,
    title: "Loved by creators.",
    description: "\"I literally just type 'we launched a new feature today' and it writes the perfect Twitter thread instantly. Magic.\"",
    author: "David Chen, Founder @ TechStart",
    icon: <Quote className="w-8 h-8 text-primary" />,
    image: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&q=80&w=800"
  },
  {
    id: 3,
    title: "One dashboard. All platforms.",
    description: "Review, edit, and blast your content across X, Facebook, and Instagram simultaneously.",
    icon: <LayoutDashboard className="w-8 h-8 text-emerald-400" />,
    image: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&q=80&w=800"
  }
];

export default function AuthCarousel() {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrent((prev) => (prev + 1) % slides.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="w-full h-full relative rounded-3xl overflow-hidden bg-card border border-border shadow-2xl flex flex-col">
      <AnimatePresence mode="wait">
        <motion.div
          key={current}
          initial={{ opacity: 0, scale: 1.05 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="absolute inset-0 z-0"
        >
          <img
            src={slides[current].image}
            alt={slides[current].title}
            className="w-full h-full object-cover opacity-40 mix-blend-overlay"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-background/20" />
        </motion.div>
      </AnimatePresence>

      <div className="relative z-10 flex flex-col justify-end h-full p-12">
        <AnimatePresence mode="wait">
          <motion.div
            key={current}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.5 }}
          >
            <div className="mb-6 bg-secondary/50 backdrop-blur-md w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg border border-border/50">
              {slides[current].icon}
            </div>
            <h2 className="text-3xl lg:text-4xl font-bold tracking-tight text-foreground mb-4 leading-tight">
              {slides[current].title}
            </h2>
            <p className="text-lg text-muted-foreground leading-relaxed max-w-md">
              {slides[current].description}
            </p>
            {slides[current].author && (
              <p className="mt-4 text-sm font-semibold text-foreground">
                — {slides[current].author}
              </p>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Indicators */}
        <div className="flex items-center gap-2 mt-12">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === current ? 'w-8 bg-primary' : 'w-4 bg-muted hover:bg-primary/50'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
