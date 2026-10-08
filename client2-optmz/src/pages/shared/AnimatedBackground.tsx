import type { ReactNode } from "react";

export function AnimatedBackground({ children }: { children?: ReactNode }) {
  return (
    <div className="relative">
      <div className="fixed inset-0 pointer-events-none z-0 bg-[radial-gradient(ellipse_at_0%_0%,rgba(70,72,212,0.04)_0%,transparent_50%),radial-gradient(ellipse_at_100%_100%,rgba(129,39,207,0.04)_0%,transparent_50%),radial-gradient(ellipse_at_50%_0%,rgba(84,92,114,0.02)_0%,transparent_50%)]" />
      <div className="fixed top-[10%] right-[5%] w-75 h-75 rounded-full bg-[rgba(70,72,212,0.06)] blur-[80px] pointer-events-none z-0 animate-[float_8s_ease-in-out_infinite]" />
      <div className="fixed bottom-[10%] left-[5%] w-62.5 h-62.5 rounded-full bg-[rgba(129,39,207,0.05)] blur-[80px] pointer-events-none z-0 animate-[float_10s_ease-in-out_infinite_2s]" />
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0) scale(1); }
          50% { transform: translateY(-30px) scale(1.05); }
        }
        @keyframes pulse-glow {
          0%, 100% { box-shadow: 0 0 20px rgba(70,72,212,0.2); }
          50% { box-shadow: 0 0 40px rgba(70,72,212,0.4); }
        }
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(-20px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      <div className="relative z-10">{children}</div>
    </div>
  );
}