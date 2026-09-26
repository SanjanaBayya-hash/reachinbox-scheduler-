import clsx from 'clsx';

interface Tab {
  value: string;
  label: string;
}

interface TabsProps {
  tabs: Tab[];
  value: string;
  onChange: (value: string) => void;
}

export function Tabs({ tabs, value, onChange }: TabsProps) {
  return (
    <div className="flex gap-1 rounded-card bg-gray-100 p-1">
      {tabs.map((tab) => (
        <button
          key={tab.value}
          onClick={() => onChange(tab.value)}
          className={clsx(
            'rounded-card px-3 py-1.5 text-sm font-medium transition-colors',
            value === tab.value ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800',
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
