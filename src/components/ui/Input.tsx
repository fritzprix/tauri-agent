import React from "react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  containerClassName?: string;
  variant?: "default" | "terminal";
}

export default function Input({
  label,
  error,
  className = "",
  containerClassName = "",
  variant = "default",
  ...props
}: InputProps) {
  const baseClasses =
    variant === "terminal"
      ? "w-full bg-transparent border-none outline-none text-green-400 px-0 py-1 terminal-input"
      : "w-full bg-transparent border border-gray-600 rounded px-3 py-2 text-green-400 focus:border-green-400 focus:outline-none transition-colors";

  // For terminal variant, render input directly without wrapper
  if (variant === "terminal") {
    return <input className={`${baseClasses} ${className}`} {...props} />;
  }

  // For default variant, use wrapper div
  return (
    <div className={containerClassName}>
      {label && (
        <label className="block text-gray-400 mb-2 font-medium">{label}</label>
      )}
      <input
        className={`${baseClasses} ${error ? "border-red-400" : ""} ${className}`}
        {...props}
      />
      {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
    </div>
  );
}
