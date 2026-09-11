import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'brand' | 'success' | 'warning' | 'danger' | 'neutral';
  size?: 'sm' | 'md';
  icon?: React.ReactNode;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'brand',
  size = 'md',
  icon,
  className,
}) => {
  const baseStyles = 'inline-flex items-center font-medium rounded-full select-none tracking-wide';

  const variants = {
    brand: 'bg-[#1c2238] text-sarvam-indigoLight border border-sarvam-indigo/30',
    success: 'bg-emerald-950/40 text-emerald-400 border border-emerald-500/30',
    warning: 'bg-amber-950/40 text-amber-300 border border-amber-500/30',
    danger: 'bg-rose-950/40 text-rose-300 border border-rose-500/30',
    neutral: 'bg-[#181b28] text-sarvam-secondary border border-sarvam-border',
  };

  const sizes = {
    sm: 'text-[10px] px-2.5 py-0.5 gap-1',
    md: 'text-xs px-3 py-1 gap-1.5',
  };

  return (
    <span className={twMerge(clsx(baseStyles, variants[variant], sizes[size], className))}>
      {icon}
      {children}
    </span>
  );
};
