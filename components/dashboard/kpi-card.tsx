import { ArrowUp, ArrowDown, type LucideIcon } from 'lucide-react';

interface KPICardProps {
  label: string;
  value: string;
  trend: 'up' | 'down' | 'neutral';
  trendValue: string;
  icon?: LucideIcon;
}

export function KPICard({ label, value, trend, trendValue, icon: Icon }: KPICardProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-[#E5E7EB] p-6 relative">
      {Icon && (
        <div className="absolute top-6 right-6">
          <Icon className="w-5 h-5 text-[#4B5563]" aria-hidden="true" />
        </div>
      )}
      <p className="text-sm text-[#4B5563]">{label}</p>
      <p className="text-2xl font-bold text-[#111827] mt-1">{value}</p>
      <span
        className={`inline-flex items-center gap-1 mt-2 text-xs font-medium ${
          trend === 'up'
            ? 'text-[#16A34A]'
            : trend === 'down'
              ? 'text-[#DC2626]'
              : 'text-gray-500'
        }`}
      >
        {trend === 'up' && <ArrowUp className="w-3 h-3" aria-hidden="true" />}
        {trend === 'down' && <ArrowDown className="w-3 h-3" aria-hidden="true" />}
        {trendValue}
      </span>
    </div>
  );
}
