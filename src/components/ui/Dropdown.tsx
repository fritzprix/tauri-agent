import { useState, useRef, useEffect } from 'react';

interface DropdownOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface DropdownProps {
  options: DropdownOption[];
  value?: string;
  placeholder?: string;
  onChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
}

export default function Dropdown({ 
  options, 
  value, 
  placeholder = "> select option", 
  onChange, 
  className = "",
  disabled = false 
}: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find(option => option.value === value);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (optionValue: string) => {
    onChange(optionValue);
    setIsOpen(false);
  };

  return (
    <div ref={dropdownRef} className={`relative font-mono ${className}`}>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`
          w-full px-3 py-2 text-left bg-black border border-green-500 text-green-400
          focus:outline-none focus:border-green-300 focus:shadow-lg focus:shadow-green-500/20
          ${disabled 
            ? 'bg-gray-900 border-gray-600 text-gray-500 cursor-not-allowed' 
            : 'hover:border-green-300 hover:text-green-300 cursor-pointer transition-colors duration-200'
          }
          ${isOpen ? 'border-green-300 text-green-300 shadow-lg shadow-green-500/20' : ''}
        `}
      >
        <span className="block truncate">
          {selectedOption ? `> ${selectedOption.label}` : placeholder}
        </span>
        <span className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
          <span
            className={`text-green-500 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          >
            ▼
          </span>
        </span>
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-black border border-green-500 shadow-xl shadow-green-500/30 max-h-60 overflow-auto">
          <div className="border-b border-green-700 px-3 py-1 text-green-300 text-xs font-mono">
            === SELECT OPTION ===
          </div>
          {options.map((option, index) => (
            <button
              key={option.value}
              type="button"
              onClick={() => !option.disabled && handleSelect(option.value)}
              disabled={option.disabled}
              className={`
                w-full px-3 py-2 text-left font-mono text-sm transition-colors duration-150
                ${option.disabled 
                  ? 'text-gray-600 cursor-not-allowed' 
                  : 'text-green-400 hover:bg-green-900/30 hover:text-green-300 cursor-pointer'
                }
                ${value === option.value ? 'bg-green-900/50 text-green-200 border-l-2 border-green-400' : ''}
              `}
            >
              <span className="text-green-600 mr-2">[{index + 1}]</span>
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
