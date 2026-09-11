import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
  className?: string;
}

export const Toggle: React.FC<ToggleProps> = ({
  checked,
  onChange,
  label,
  description,
  disabled = false,
  className,
}) => {
  return (
    <label
      className={twMerge(
        clsx(
          'flex items-center justify-between gap-3 cursor-pointer select-none',
          disabled && 'opacity-40 cursor-not-allowed',
          className
        )
      )}
    >
      {(label || description) && (
        <div className="flex flex-col">
          {label && <span className="text-xs font-semibold text-sarvam-text tracking-wide">{label}</span>}
          {description && <span className="text-[11px] text-sarvam-secondary leading-normal">{description}</span>}
        </div>
      )}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={clsx(
          'relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border border-white/10 transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-sarvam-indigo focus:ring-offset-2 focus:ring-offset-sarvam-bg',
          checked ? 'bg-sarvam-indigoDark' : 'bg-[#181b28]'
        )}
      >
        <span
          aria-hidden="true"
          className={clsx(
            'pointer-events-none inline-block h-3.5 w-3.5 my-auto transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out',
            checked ? 'translate-x-4 bg-sarvam-indigoLight' : 'translate-x-0.5 bg-sarvam-tertiary'
          )}
        />
      </button>
    </label>
  );
};
