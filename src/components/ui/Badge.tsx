import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'active' | 'warning' | 'success' | 'error';
  size?: 'sm' | 'md';
}

export default function Badge({ 
  children, 
  variant = 'default', 
  size = 'sm' 
}: BadgeProps) {
  const variantClasses = {
    default: 'bg-gray-800 text-gray-400',
    active: 'bg-blue-900/20 text-blue-400',
    warning: 'bg-yellow-900/20 text-yellow-400',
    success: 'bg-green-900/20 text-green-400',
    error: 'bg-red-900/20 text-red-400'
  };

  const sizeClasses = {
    sm: 'text-xs px-1 py-0.5',
    md: 'text-sm px-2 py-1'
  };

  return (
    <span className={`inline-flex items-center rounded font-medium ${variantClasses[variant]} ${sizeClasses[size]}`}>
      {children}
    </span>
  );
}
