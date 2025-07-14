import React from 'react';

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  containerClassName?: string;
}

export default function Textarea({ 
  label, 
  error, 
  className = '', 
  containerClassName = '',
  ...props 
}: TextareaProps) {
  const baseClasses = 'w-full bg-gray-800 border border-gray-600 rounded px-3 py-3 text-green-400 placeholder-gray-600 focus:border-green-400 focus:outline-none resize-none transition-colors';
  
  return (
    <div className={containerClassName}>
      {label && (
        <label className="block text-gray-400 mb-2 font-medium">
          {label}
        </label>
      )}
      <textarea 
        className={`${baseClasses} ${error ? 'border-red-400' : ''} ${className}`}
        {...props}
      />
      {error && (
        <p className="text-red-400 text-xs mt-1">{error}</p>
      )}
    </div>
  );
}
