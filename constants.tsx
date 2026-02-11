
import React from 'react';

export const SHIFT_TIMES = [
  { label: 'בוקר (07:00-15:00)', start: 7, end: 15 },
  { label: 'ערב (15:00-23:00)', start: 15, end: 23 },
  { label: 'לילה (23:00-07:00)', start: 23, end: 7 },
];

export const getCurrentShift = (): string => {
  const hour = new Date().getHours();
  if (hour >= 7 && hour < 15) return 'בוקר (07:00-15:00)';
  if (hour >= 15 && hour < 23) return 'ערב (15:00-23:00)';
  return 'לילה (23:00-07:00)';
};

export const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = "" }) => (
  <div className={`bg-white rounded-xl shadow-sm border border-gray-200 p-6 ${className}`}>
    {children}
  </div>
);
