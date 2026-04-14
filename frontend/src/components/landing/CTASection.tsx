import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

// 1. Define the Interface for Props
interface CTASectionProps {
  onCtaClick: () => void;
}

// 2. Destructure the onCtaClick prop
const CTASection = ({ onCtaClick }: CTASectionProps) => (
  <section className="py-24 relative overflow-hidden">
    <div className="absolute inset-0 bg-primary/5" />
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full opacity-30"
      style={{ background: 'radial-gradient(circle, hsl(195 100% 50% / 0.1), transparent 70%)' }} />
    <div className="container mx-auto px-6 relative z-10">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="text-center max-w-3xl mx-auto"
      >
        <h2 className="text-4xl md:text-6xl font-heading font-bold mb-6">Ready to Master the Market?</h2>
        <p className="text-xl text-muted-foreground font-body mb-8">Join 5,000+ traders using PatternIQ to find their edge. Start for free — no credit card required.</p>
        
        {/* 3. Attach the onCtaClick handler to the button */}
        <Button 
          size="lg" 
          className="bg-primary text-primary-foreground hover:bg-primary/90 font-heading font-semibold text-lg px-10 py-7 gap-2 group"
          onClick={onCtaClick}
        >
          Get Started for Free
          <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
        </Button>
      </motion.div>
    </div>
  </section>
);

export default CTASection;