import React from 'react';


interface DropdownOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface DropdownProps<T> {
  options: DropdownOption[];
  value?: T;
  onChange: (value: T) => void;
  placeholder: string;
  disabled?: boolean;
  className?: string;
  variant?: 'default' | 'compact';
}

export function Dropdown<T>({ options, value, onChange, placeholder, disabled, className = '', variant = 'default' }: DropdownProps<T>) {
  const baseClasses = `w-full appearance-none rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 transition-colors duration-200`;
  const variantClasses = {
    default: `bg-gray-800 border border-green-600/30 text-green-300 focus:ring-green-500/50 focus:border-green-500 disabled:bg-gray-900/50 disabled:text-gray-500`,
    compact: `bg-transparent border-none text-green-300 focus:ring-green-500/50 p-1`,
  };

  return (
    <div className={`relative ${className}`}>
      <select
        value={typeof value === "string" ? value : `${value}`}
        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => onChange(e.target.value as T)}
        disabled={disabled}
        className={`${baseClasses} ${variantClasses[variant]} disabled:cursor-not-allowed`}
      >
        <option value="" disabled>{placeholder}</option>
        {options.map(option => (
          <option key={option.value} value={option.value} disabled={option.disabled} className="bg-gray-800">
            {option.label}
          </option>
        ))}
      </select>
      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-green-500">
        <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
          <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
        </svg>
      </div>
    </div>
  );
};
