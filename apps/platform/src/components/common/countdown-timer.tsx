import { useEffect, useState, useRef } from 'react';

interface CountdownTimerProps {
  targetDate: string;
  label?: string;
  className?: string;
}

function calculateTimeLeft(target: Date) {
  const now = new Date();
  const diff = target.getTime() - now.getTime();
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, expired: true };
  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((diff / (1000 * 60)) % 60),
    seconds: Math.floor((diff / 1000) % 60),
    expired: false,
  };
}

export function CountdownTimer({ targetDate, label, className }: CountdownTimerProps) {
  const target = useRef(new Date(targetDate));
  const [time, setTime] = useState(() => calculateTimeLeft(target.current));

  useEffect(() => {
    const interval = setInterval(() => {
      setTime(calculateTimeLeft(target.current));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  if (time.expired) {
    return (
      <div className={className}>
        {label && <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/25 mb-2">{label}</p>}
        <p className="text-sm font-semibold text-[#CCFF00]">Deadline passed</p>
      </div>
    );
  }

  const segments = [
    { value: time.days, label: 'Days' },
    { value: time.hours, label: 'Hrs' },
    { value: time.minutes, label: 'Min' },
    { value: time.seconds, label: 'Sec' },
  ];

  return (
    <div className={className}>
      {label && <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/25 mb-2">{label}</p>}
      <div className="flex items-center gap-2">
        {segments.map((seg, i) => (
          <div key={seg.label} className="flex items-center gap-2">
            <div className="flex flex-col items-center">
              <span className="text-xl font-black tabular-nums text-white">
                {String(seg.value).padStart(2, '0')}
              </span>
              <span className="text-[9px] uppercase tracking-wider text-white/25 font-medium">
                {seg.label}
              </span>
            </div>
            {i < segments.length - 1 && (
              <span className="text-white/15 text-lg font-light mb-3">:</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
