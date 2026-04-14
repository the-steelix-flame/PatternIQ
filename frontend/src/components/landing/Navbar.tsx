import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";

// 1. Updated Interface for Session Props
interface NavbarProps {
  user?: { name: string; picture?: string; sub?: string } | null;
  onLoginClick: () => void;
  onDashboardClick: () => void;
  onLogoutClick: () => void;
}

// 2. Destructure the new props here
const Navbar = ({ user, onLoginClick, onDashboardClick, onLogoutClick }: NavbarProps) => {
  const [open, setOpen] = useState(false);

  const navLinks = ["Features", "How it Works", "Pricing", "Arena", "Community"];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-md">
      <div className="container mx-auto px-6 h-16 flex items-center justify-between">
        {/* PatternIQ Logo - clicking this stays on landing by default */}
        <a href="/" className="text-xl font-heading font-bold">
          Pattern<span className="text-gradient">IQ</span>
        </a>

        <div className="hidden md:flex items-center gap-8">
          {navLinks.map((l) => (
            <a 
              key={l} 
              href={`#${l.toLowerCase().replace(/\s+/g, '-')}`} 
              className="text-sm font-body text-muted-foreground hover:text-foreground transition-colors"
            >
              {l}
            </a>
          ))}
        </div>

        {/* 3. Desktop Buttons: Conditional Rendering based on Auth */}
        <div className="hidden md:flex items-center gap-3">
          {user ? (
            <>
              <span className="text-sm font-body text-muted-foreground hidden lg:inline-block mr-2">
                Welcome, {user.name}
              </span>
              <Button 
                variant="ghost" 
                className="font-heading text-sm"
                onClick={onLogoutClick}
              >
                Logout
              </Button>
              <Button 
                className="bg-primary text-primary-foreground hover:bg-primary/90 font-heading text-sm"
                onClick={onDashboardClick}
              >
                Go to Dashboard
              </Button>
            </>
          ) : (
            <>
              <Button 
                variant="ghost" 
                className="font-heading text-sm"
                onClick={onLoginClick}
              >
                Log In
              </Button>
              <Button 
                className="bg-primary text-primary-foreground hover:bg-primary/90 font-heading text-sm"
                onClick={onLoginClick}
              >
                Get Started
              </Button>
            </>
          )}
        </div>

        <button onClick={() => setOpen(!open)} className="md:hidden text-foreground">
          {open ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden border-t border-border bg-background overflow-hidden"
          >
            <div className="px-6 py-4 space-y-4">
              {navLinks.map((l) => (
                <a key={l} href="#" className="block text-sm font-body text-muted-foreground">{l}</a>
              ))}
              
              {/* 4. Mobile Menu Buttons: Conditional Rendering */}
              <div className="pt-4 flex flex-col gap-2">
                {user ? (
                  <>
                    <Button 
                      variant="outline" 
                      className="w-full font-heading"
                      onClick={onLogoutClick}
                    >
                      Logout
                    </Button>
                    <Button 
                      className="w-full bg-primary text-primary-foreground font-heading"
                      onClick={onDashboardClick}
                    >
                      Go to Dashboard
                    </Button>
                  </>
                ) : (
                  <Button 
                    className="w-full bg-primary text-primary-foreground font-heading"
                    onClick={onLoginClick}
                  >
                    Get Started
                  </Button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

export default Navbar;