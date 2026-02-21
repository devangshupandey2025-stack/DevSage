import React, { useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';

export function Preloader() {
    const containerRef = useRef<HTMLDivElement>(null);
    const textRef = useRef<SVGTextElement>(null);

    useLayoutEffect(() => {
        const ctx = gsap.context(() => {
            // Create a GSAP timeline
            const tl = gsap.timeline();

            // Initial State: no fill, stroke visible, dashed out
            // We use a large dash array to guarantee it covers the text outline
            gsap.set(textRef.current, {
                strokeDasharray: 500,
                strokeDashoffset: 500,
                stroke: '#DFFF00',
                strokeWidth: 3,
                fill: 'transparent',
                transformOrigin: '50% 50%',
            });

            tl
                // 1. The Draw: animate stroke offset to 0
                .to(textRef.current, {
                    strokeDashoffset: 0,
                    duration: 1.2,
                    ease: 'power2.inOut',
                })

                // 2. The Flash: stroke vanishes, changes to solid fill instantly, with a scale pulse
                .to(
                    textRef.current,
                    {
                        stroke: 'transparent',
                        fill: '#DFFF00',
                        duration: 0.1,
                    },
                    '>'
                )
                .to(
                    textRef.current,
                    {
                        scale: 1.1,
                        duration: 0.1,
                        yoyo: true,
                        repeat: 1, // pulses out to 1.1 and back to 1.0
                        ease: 'power1.inOut',
                    },
                    '<' // Starts at the same time as the fill step
                )

                // 3. The Reveal: zoom in and fade
                .to(
                    containerRef.current,
                    {
                        scale: 3,
                        opacity: 0,
                        duration: 1,
                        ease: 'power3.inOut',
                        delay: 0.2, // Tiny pause so user can see the filled logo before it fades
                    }
                );
        }, containerRef); // Scoped to this container

        return () => ctx.revert(); // Cleanup on unmount
    }, []);

    return (
        <div
            ref={containerRef}
            className="fixed inset-0 z-[999] flex items-center justify-center bg-[#111] overflow-hidden pointer-events-none"
        >
            <svg
                width="300"
                height="200"
                viewBox="0 0 300 200"
                className="overflow-visible"
                xmlns="http://www.w3.org/2000/svg"
            >
                <text
                    ref={textRef}
                    x="50%"
                    y="50%"
                    dominantBaseline="middle"
                    textAnchor="middle"
                    fontSize="100"
                    fontWeight="bold"
                    fontFamily="sans-serif"
                    className="tracking-tighter"
                >
                    ds
                </text>
            </svg>
        </div>
    );
}
