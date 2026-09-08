import { ReactNode } from "react";
import { cn } from "@/lib/utils";

type DivProps = React.HTMLAttributes<HTMLDivElement>;

interface PageHeaderProps extends DivProps {
  title: string;
  description?: string;
  eyebrow?: string;
  action?: ReactNode;
  children?: ReactNode;
}

export function PageHeader({ title, description, eyebrow, action, children, ...rest }: PageHeaderProps) {
  // Topbar viser allerede titel — PageHeader er kun for action-knapper
  return (
    <div {...rest} className="flex items-center justify-between gap-3 flex-wrap py-1.5 mb-2">
      <div className="min-w-0">
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
        {children}
      </div>
      {action && <div className="flex items-center gap-2 shrink-0">{action}</div>}
    </div>
  );
}

interface MetricCardProps extends DivProps {
  icon: ReactNode;
  value: string | number;
  label: string;
  sub?: string;
  variant?: "primary" | "blue" | "amber" | "green" | "red" | "gray";
  progress?: number;
  valueTestId?: string;
}

const DOT_COLORS: Record<string, string> = {
  primary: "bg-primary",
  blue: "bg-blue-500",
  amber: "bg-amber-500",
  green: "bg-emerald-500",
  red: "bg-red-500",
  gray: "bg-gray-400",
};

export function MetricCard({ icon, value, label, sub, variant = "primary", progress, valueTestId, ...rest }: MetricCardProps) {
  const dot = DOT_COLORS[variant] || DOT_COLORS.primary;
  return (
    <div {...rest} className="bg-card border-b border-border px-3 py-2.5">
      <div className="flex items-center gap-2 mb-0.5">
        <span className={cn("w-1.5 h-1.5 rounded-full", dot)} />
        <p className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium">{label}</p>
      </div>
      <div className="flex items-baseline justify-between">
        <p data-testid={valueTestId} className="text-lg font-bold tracking-tight">{value}</p>
        {sub && <span className="text-[11px] text-muted-foreground">{sub}</span>}
      </div>
    </div>
  );
}

interface SectionCardProps extends DivProps {
  title?: string;
  icon?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  noPadding?: boolean;
}

export function SectionCard({ title, icon, action, children, className, noPadding, ...rest }: SectionCardProps) {
  return (
    <div {...rest} className={cn("bg-card", className)}>
      {(title || action) && (
        <div className="flex items-center justify-between px-3 py-2 border-b border-border">
          <div className="flex items-center gap-1.5">
            {icon && <span className="text-muted-foreground">{icon}</span>}
            {title && <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>}
          </div>
          {action}
        </div>
      )}
      <div className={noPadding ? "" : "px-3 py-2"}>
        {children}
      </div>
    </div>
  );
}

interface StatusChipProps extends React.HTMLAttributes<HTMLSpanElement> {
  status: string;
  variant?: "primary" | "blue" | "amber" | "green" | "red" | "gray";
  icon?: ReactNode;
}

const CHIP_VARIANTS: Record<string, string> = {
  primary: "bg-primary/10 text-primary",
  blue: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400",
  amber: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
  green: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
  red: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400",
  gray: "bg-gray-100 text-gray-600 dark:bg-gray-800/50 dark:text-gray-400",
};

export function StatusChip({ status, variant = "gray", icon, ...rest }: StatusChipProps) {
  return (
    <span {...rest} className={cn("inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium", CHIP_VARIANTS[variant])}>
      {icon}
      {status}
    </span>
  );
}
