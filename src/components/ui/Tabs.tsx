import React from 'react';

interface TabsProps {
  children: React.ReactNode;
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
}

interface TabsListProps {
  children: React.ReactNode;
  className?: string;
}

interface TabsTriggerProps {
  children: React.ReactNode;
  onClick?: () => void;
  isActive?: boolean;
}

interface TabsContentProps {
  value: string;
  children: React.ReactNode;
  activeValue?: string;
}

export function Tabs({ children, defaultValue, value, onValueChange }: TabsProps) {
  const [activeTab, setActiveTab] = React.useState(defaultValue || '');

  const currentValue = value !== undefined ? value : activeTab;

  const handleTabChange = (newValue: string) => {
    if (value === undefined) {
      setActiveTab(newValue);
    }
    onValueChange?.(newValue);
  };

  return (
    <div className="w-full">
      {React.Children.map(children, child => {
        if (React.isValidElement(child)) {
          return React.cloneElement(child, { 
            activeValue: currentValue, 
            onTabChange: handleTabChange 
          } as any);
        }
        return child;
      })}
    </div>
  );
}

export function TabsList({ children, className = '' }: TabsListProps) {
  return (
    <div className={`flex gap-3 ${className}`}>
      {children}
    </div>
  );
}

export function TabsTrigger({ children, onClick, isActive }: TabsTriggerProps) {
  return (
    <button
      onClick={onClick}
      className={`px-2 py-1 text-sm transition-colors ${
        isActive ? 'text-green-400' : 'text-gray-500 hover:text-gray-300'
      }`}
    >
      {children}
    </button>
  );
}

export function TabsContent({ value, children, activeValue }: TabsContentProps) {
  if (value !== activeValue) return null;
  
  return <div>{children}</div>;
}