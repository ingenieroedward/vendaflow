import React from 'react';

// Usado/límite con alerta al acercarse al tope
const UsagePill: React.FC<{ used: number; max: number; title: string }> = ({ used, max, title }) => {
  const ratio = max > 0 ? used / max : 0;
  const cls =
    ratio >= 1 ? 'text-red-600 font-semibold'
    : ratio >= 0.7 ? 'text-amber-600 font-medium'
    : 'text-gray-500';
  return (
    <span className={cls} title={title}>
      {used}/{max}
    </span>
  );
};

export default UsagePill;
