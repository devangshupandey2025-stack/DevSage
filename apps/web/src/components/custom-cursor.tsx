import { useEffect, useRef, useState } from 'react';
import { motion, useMotionValue, useSpring } from 'framer-motion';

type CursorVariant = 'default' | 'pointer' | 'text';

function getVariantForElement(el: Element | null): CursorVariant {
  if (!el) return 'default';

  const cursorAttr = el.closest('[data-cursor]')?.getAttribute('data-cursor');
  if (cursorAttr === 'pointer' || cursorAttr === 'text') return cursorAttr;

  const interactive = el.closest(
    'a, button, [role="button"], summary, input, textarea, select, label',
  );
  if (!interactive) return 'default';

  if (interactive instanceof HTMLInputElement) {
    if (interactive.type === 'text' || interactive.type === 'email') return 'text';
  }
  if (interactive instanceof HTMLTextAreaElement) return 'text';

  return 'pointer';
}

export function CustomCursor() {
  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);

  const dotX = useSpring(rawX, { stiffness: 1200, damping: 45, mass: 0.12 });
  const dotY = useSpring(rawY, { stiffness: 1200, damping: 45, mass: 0.12 });

  const ringX = useSpring(rawX, { stiffness: 420, damping: 38, mass: 0.25 });
  const ringY = useSpring(rawY, { stiffness: 420, damping: 38, mass: 0.25 });

  const glowX = useSpring(rawX, { stiffness: 160, damping: 30, mass: 0.35 });
  const glowY = useSpring(rawY, { stiffness: 160, damping: 30, mass: 0.35 });

  const [enabled, setEnabled] = useState(false);
  const [visible, setVisible] = useState(false);
  const [pressed, setPressed] = useState(false);
  const [variant, setVariant] = useState<CursorVariant>('default');
  const variantRef = useRef<CursorVariant>('default');

  const visibleRef = useRef(false);
  const styleElRef = useRef<HTMLStyleElement | null>(null);

  const rafIdRef = useRef<number | null>(null);
  const lastPosRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const finePointerMq = window.matchMedia('(pointer: fine)');
    const reduceMotionMq = window.matchMedia('(prefers-reduced-motion: reduce)');

    const update = () => {
      setEnabled(finePointerMq.matches && !reduceMotionMq.matches);
    };

    update();

    finePointerMq.addEventListener('change', update);
    reduceMotionMq.addEventListener('change', update);
    return () => {
      finePointerMq.removeEventListener('change', update);
      reduceMotionMq.removeEventListener('change', update);
    };
  }, []);

  useEffect(() => {
    if (!enabled) return;

    document.body.classList.add('has-custom-cursor');

    const styleEl = document.createElement('style');
    styleEl.setAttribute('data-custom-cursor', 'true');
    styleEl.textContent =
      'body.has-custom-cursor{cursor:none !important;}body.has-custom-cursor *{cursor:none !important;}';
    document.head.appendChild(styleEl);
    styleElRef.current = styleEl;

    const initial = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    lastPosRef.current = initial;
    rawX.set(initial.x);
    rawY.set(initial.y);

    const scheduleFrame = () => {
      if (rafIdRef.current != null) return;
      rafIdRef.current = window.requestAnimationFrame(() => {
        rafIdRef.current = null;
        rawX.set(lastPosRef.current.x);
        rawY.set(lastPosRef.current.y);

        const el = document.elementFromPoint(lastPosRef.current.x, lastPosRef.current.y);
        const nextVariant = getVariantForElement(el);
        if (nextVariant !== variantRef.current) {
          variantRef.current = nextVariant;
          setVariant(nextVariant);
        }
      });
    };

    const onPointerMove = (e: PointerEvent) => {
      lastPosRef.current = { x: e.clientX, y: e.clientY };
      if (!visibleRef.current) {
        visibleRef.current = true;
        setVisible(true);
      }
      scheduleFrame();
    };

    const onPointerDown = () => setPressed(true);
    const onPointerUp = () => setPressed(false);
    const onPointerLeave = () => {
      if (!visibleRef.current) return;
      visibleRef.current = false;
      setVisible(false);
    };

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerdown', onPointerDown, { passive: true });
    window.addEventListener('pointerup', onPointerUp, { passive: true });
    window.addEventListener('blur', onPointerLeave);
    document.addEventListener('mouseleave', onPointerLeave);

    return () => {
      document.body.classList.remove('has-custom-cursor');

      if (styleElRef.current) {
        styleElRef.current.remove();
        styleElRef.current = null;
      }

      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('blur', onPointerLeave);
      document.removeEventListener('mouseleave', onPointerLeave);

      if (rafIdRef.current != null) {
        window.cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, [enabled, rawX, rawY]);

  if (!enabled) return null;

  const ringSize = variant === 'pointer' ? 74 : variant === 'text' ? 54 : 44;
  const ringOpacity = visible ? 1 : 0;
  const ringScale = pressed ? 0.92 : 1;

  const dotSize = variant === 'pointer' ? 8 : 6;
  const dotOpacity = visible ? 1 : 0;
  const dotScale = pressed ? 0.78 : variant === 'pointer' ? 1.25 : 1;

  const glowSize = variant === 'pointer' ? 160 : 120;
  const glowOpacity = visible ? (variant === 'pointer' ? 0.35 : 0.22) : 0;
  const glowScale = pressed ? 0.88 : 1;

  const transformTemplate = ({ x, y, scale }: { x?: string; y?: string; scale?: number }) =>
    `translate3d(${x ?? '0px'}, ${y ?? '0px'}, 0) translate(-50%, -50%) scale(${scale ?? 1})`;

  return (
    <>
      <motion.div
        className="fixed top-0 left-0 pointer-events-none z-9997"
        style={{ x: glowX, y: glowY, width: glowSize, height: glowSize }}
        animate={{ opacity: glowOpacity, scale: glowScale }}
        transition={{ type: 'spring', stiffness: 220, damping: 26 }}
        transformTemplate={transformTemplate}
      >
        <div
          className="h-full w-full rounded-full"
          style={{
            background:
              'radial-gradient(circle, rgba(204,255,0,0.35) 0%, rgba(204,255,0,0.10) 35%, rgba(204,255,0,0.0) 70%)',
            filter: 'blur(2px)',
            mixBlendMode: 'difference',
          }}
        />
      </motion.div>

      <motion.div
        className="fixed top-0 left-0 pointer-events-none z-9998 rounded-full mix-blend-difference border"
        style={{ x: ringX, y: ringY }}
        animate={{
          width: ringSize,
          height: ringSize,
          opacity: ringOpacity,
          scale: ringScale,
          borderColor:
            variant === 'pointer' ? 'rgba(204, 255, 0, 0.55)' : 'rgba(255, 255, 255, 0.28)',
          backgroundColor: variant === 'pointer' ? 'rgba(204, 255, 0, 0.10)' : 'rgba(204, 255, 0, 0)',
        }}
        transition={{ type: 'spring', stiffness: 380, damping: 28 }}
        transformTemplate={transformTemplate}
      />

      <motion.div
        className="fixed top-0 left-0 pointer-events-none z-9999 rounded-full mix-blend-difference"
        style={{ x: dotX, y: dotY }}
        animate={{
          width: dotSize,
          height: dotSize,
          opacity: dotOpacity,
          scale: dotScale,
          backgroundColor: variant === 'text' ? 'rgba(255, 255, 255, 0.9)' : 'rgba(204, 255, 0, 1)',
        }}
        transition={{ type: 'spring', stiffness: 900, damping: 40 }}
        transformTemplate={transformTemplate}
      />
    </>
  );
}
