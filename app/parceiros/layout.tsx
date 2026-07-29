// ORCALY_AFFILIATE_VISUAL_V2
import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Orçaly Parceiros",
  description:
    "Portal de indicações do Orçaly com acompanhamento de cadastros, vendas, comissões e pagamentos via Pix.",
};

export default function ParceirosLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <>
      <style>{`
        @keyframes partnerFadeUp {
          from {
            opacity: 0;
            transform: translate3d(0, 22px, 0);
          }
          to {
            opacity: 1;
            transform: translate3d(0, 0, 0);
          }
        }

        @keyframes partnerFloat {
          0%, 100% { transform: translate3d(0, 0, 0); }
          50% { transform: translate3d(0, -12px, 0); }
        }

        @keyframes partnerDrift {
          0% { transform: translate3d(-3%, -2%, 0) scale(1); }
          50% { transform: translate3d(4%, 3%, 0) scale(1.08); }
          100% { transform: translate3d(-3%, -2%, 0) scale(1); }
        }

        @keyframes partnerShine {
          0% { transform: translateX(-130%) skewX(-18deg); }
          55%, 100% { transform: translateX(230%) skewX(-18deg); }
        }

        @keyframes partnerPulseRing {
          0% {
            transform: scale(.82);
            opacity: .55;
          }
          100% {
            transform: scale(1.3);
            opacity: 0;
          }
        }

        @keyframes partnerProgress {
          from { width: 0; }
          to { width: var(--partner-progress, 100%); }
        }

        .partner-fade-up {
          animation: partnerFadeUp .72s cubic-bezier(.2,.8,.2,1) both;
        }

        .partner-delay-1 { animation-delay: .08s; }
        .partner-delay-2 { animation-delay: .16s; }
        .partner-delay-3 { animation-delay: .24s; }
        .partner-delay-4 { animation-delay: .32s; }

        .partner-float {
          animation: partnerFloat 5.5s ease-in-out infinite;
        }

        .partner-drift {
          animation: partnerDrift 11s ease-in-out infinite;
        }

        .partner-shine {
          position: relative;
          overflow: hidden;
          isolation: isolate;
        }

        .partner-shine::after {
          content: "";
          position: absolute;
          inset: -45% auto -45% -35%;
          width: 34%;
          background: linear-gradient(
            90deg,
            transparent,
            rgba(255,255,255,.38),
            transparent
          );
          animation: partnerShine 4.8s ease-in-out infinite;
          pointer-events: none;
          z-index: -1;
        }

        .partner-pulse-ring {
          animation: partnerPulseRing 2.2s ease-out infinite;
        }

        .partner-progress {
          animation: partnerProgress 1s cubic-bezier(.2,.8,.2,1) both;
        }

        [data-partner-portal] a,
        [data-partner-portal] button,
        [data-partner-portal] input,
        [data-partner-portal] select {
          -webkit-tap-highlight-color: transparent;
        }

        [data-partner-portal] article,
        [data-partner-portal] section,
        [data-partner-portal] aside {
          backface-visibility: hidden;
        }

        [data-partner-card] {
          transition:
            transform .25s ease,
            box-shadow .25s ease,
            border-color .25s ease;
        }

        [data-partner-card]:hover {
          transform: translateY(-3px);
          box-shadow: 0 24px 60px rgba(5,36,92,.10);
          border-color: rgba(37,99,235,.16);
        }

        @media (prefers-reduced-motion: reduce) {
          .partner-fade-up,
          .partner-float,
          .partner-drift,
          .partner-shine::after,
          .partner-pulse-ring,
          .partner-progress {
            animation: none !important;
          }

          [data-partner-card] {
            transition: none;
          }

          [data-partner-card]:hover {
            transform: none;
          }
        }
      `}</style>
      {children}
    </>
  );
}
