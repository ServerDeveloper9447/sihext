import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  className,
  disabled,
  ...props
}) => {
  const baseStyles =
    'group relative inline-flex items-center justify-center font-medium rounded-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-sarvam-bg focus:ring-sarvam-indigo disabled:opacity-40 disabled:cursor-not-allowed select-none cursor-pointer tracking-wide';

  const variants = {
    primary:
      'bg-gradient-to-b from-[#3a3f5c] to-[#1e2033] hover:from-[#484e70] hover:to-[#252840] text-white border border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_2px_8px_rgba(0,0,0,0.35)] active:scale-[0.98]',
    secondary:
      'bg-[#1a1d2c] hover:bg-[#22273b] text-sarvam-text border border-sarvam-border hover:border-sarvam-borderHover shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] active:scale-[0.98]',
    outline:
      'border border-sarvam-indigo/35 hover:bg-sarvam-indigo/10 text-sarvam-indigoLight hover:border-sarvam-indigo/60',
    danger:
      'bg-rose-600/80 hover:bg-rose-600 text-white border border-rose-500/40 shadow-sm active:scale-[0.98]',
    ghost:
      'hover:bg-sarvam-card text-sarvam-secondary hover:text-white',
  };

  const sizes = {
    sm: 'text-xs px-3 py-1.5 gap-1.5',
    md: 'text-xs px-4 py-2 gap-2',
    lg: 'text-sm px-6 py-2.5 gap-2.5',
  };

  return (
    <button
      className={twMerge(clsx(baseStyles, variants[variant], sizes[size], className))}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <svg
          className="animate-spin -ml-1 mr-2 h-3.5 w-3.5 text-current"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          ></circle>
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          ></path>
        </svg>
      ) : (
        leftIcon
      )}
      {children}
      {!isLoading && rightIcon}
    </button>
  );
};
