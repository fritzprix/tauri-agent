import React from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
  children: React.ReactNode;
}

export default function Button({
  variant = "secondary",
  size = "md",
  className = "",
  children,
  ...props
}: ButtonProps) {
  const baseClasses =
    "inline-flex items-center justify-center font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-green-400 focus:ring-offset-2 focus:ring-offset-black disabled:opacity-50 disabled:cursor-not-allowed";

  const variantClasses = {
    primary:
      "bg-green-900/20 border border-green-400 text-green-400 hover:bg-green-900/40",
    secondary:
      "bg-gray-800 border border-gray-600 text-gray-400 hover:bg-gray-700",
    danger:
      "bg-red-900/20 border border-red-400 text-red-400 hover:bg-red-900/40",
    ghost: "text-gray-500 hover:text-green-400 border-none bg-transparent",
  };

  const sizeClasses = {
    sm: "px-2 py-1 text-xs rounded",
    md: "px-3 py-2 text-sm rounded",
    lg: "px-6 py-3 text-base rounded-lg",
  };

  return (
    <button
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
