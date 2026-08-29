import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  glow?: boolean;
}

export const Card: React.FC<CardProps> = ({ children, glow = false, className, ...props }) => {
  return (
    <div
      className={twMerge(
        clsx(
          'rounded-xl p-4 transition-all duration-200',
          glow ? 'glass-panel-glow' : 'glass-panel',
          className
        )
      )}
      {...props}
    >
      {children}
    </div>
  );
};
