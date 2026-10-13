import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { useRef } from "react";
gsap.registerPlugin(useGSAP);

export function Preloader({ reduced, onDone }: { reduced: boolean; onDone: () => void }) {
  const root = useRef<HTMLDivElement>(null);
  useGSAP(
    () => {
      const scope = root.current;
      if (!scope) return;
      if (reduced) {
        gsap.to(scope, { opacity: 0, duration: 0.14, onComplete: onDone });
        return;
      }
      const light = scope.querySelector("[data-cycle='light']");
      const violet = scope.querySelector("[data-cycle='violet']");
      const core = scope.querySelector("[data-cycle='core']");
      const word = scope.querySelector("[data-wordmark]");
      const lockup = scope.querySelector("[data-lockup]");
      const timeline = gsap.timeline({ defaults: { ease: "power3.out" }, onComplete: onDone });
      timeline
        .from(light, { x: -36, y: -36, opacity: 0, duration: 0.46 })
        .from(violet, { x: 36, y: 36, opacity: 0, duration: 0.46 }, 0.08)
        .to([light, violet], { x: 0, y: 0, duration: 0.42 }, 0.42)
        .from(core, { scale: 0.82, opacity: 0, duration: 0.28, transformOrigin: "50% 50%" }, 0.78)
        .from(word, { opacity: 0, y: 8, duration: 0.28 }, 0.98)
        .to(lockup, { x: -220, y: -180, scale: 0.55, duration: 0.42 }, 1.22)
        .to(scope, { opacity: 0, duration: 0.26 }, 1.42);
      return () => {
        timeline.kill();
      };
    },
    { scope: root, dependencies: [reduced] },
  );

  return (
    <div className="preloader" ref={root} role="status" aria-label="Abrindo o ZenStudies">
      <div className="preloader-lockup" data-lockup>
        <svg width="96" height="96" viewBox="0 0 128 128" aria-hidden="true">
          <rect data-cycle="light" x="14" y="14" width="68" height="68" rx="23" fill="none" stroke="#F5F6F0" strokeWidth="12" />
          <rect data-cycle="violet" x="46" y="46" width="68" height="68" rx="23" fill="none" stroke="#6558E8" strokeWidth="12" />
          <rect data-cycle="core" x="45" y="45" width="38" height="38" rx="12" fill="#73D8B2" stroke="#101C1A" strokeWidth="6" />
        </svg>
        <div className="wordmark" data-wordmark>
          Zen<em>Studies</em>
        </div>
      </div>
    </div>
  );
}
