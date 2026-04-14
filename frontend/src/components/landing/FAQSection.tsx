import { motion } from "framer-motion";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const faqs = [
  { q: "Do I need to know coding or Python?", a: "Absolutely not. PatternIQ's AI engine understands plain English descriptions of trading strategies and converts them into optimized code automatically." },
  { q: "What markets are supported?", a: "We currently support NSE, BSE, MCX for Indian markets and NASDAQ, NYSE, S&P 500 for US markets. More exchanges are being added monthly." },
  { q: "How accurate is the backtesting?", a: "Our engine uses tick-level historical data with realistic slippage, brokerage, and impact cost modeling. Results are as close to real execution as possible." },
  { q: "Is my data secure?", a: "Yes. All data is encrypted at rest and in transit. We never share your strategies or portfolio data with third parties. SOC 2 compliance in progress." },
  { q: "Can I connect my real broker account?", a: "Currently in beta — we support read-only portfolio sync with Zerodha, Groww, and Angel One. Full execution support coming in Q3 2026." },
  { q: "What's the Arena and how does scoring work?", a: "The Arena presents daily quizzes based on real market events. Correct answers earn Reputation Points (RP). Weekly tournaments offer bonus RP and badges." },
];

const FAQSection = () => (
  <section className="py-24 border-t border-border">
    <div className="container mx-auto px-6 max-w-3xl">
      <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-12">
        <h2 className="text-4xl md:text-5xl font-heading font-bold mb-4">Frequently Asked Questions</h2>
      </motion.div>
      <Accordion type="single" collapsible className="space-y-4">
        {faqs.map((f, i) => (
          <AccordionItem key={i} value={`faq-${i}`} className="border border-border rounded-xl px-6 bg-card">
            <AccordionTrigger className="font-heading font-semibold text-left hover:no-underline">{f.q}</AccordionTrigger>
            <AccordionContent className="text-muted-foreground font-body">{f.a}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  </section>
);

export default FAQSection;
