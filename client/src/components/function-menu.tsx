import { ReactNode, useState } from "react";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronDown } from "lucide-react";

export interface FunctionMenuItem {
  id: string;
  label: string;
  description?: string;
  icon?: ReactNode;
}

interface FunctionMenuProps {
  items: FunctionMenuItem[];
  active: string;
  onChange: (id: string) => void;
  label?: string;
}

export function FunctionMenu({ items, active, onChange, label = "Funktion" }: FunctionMenuProps) {
  const activeItem = items.find(i => i.id === active);
  return (
    <>
      {/* Desktop: pill menu */}
      <div className="hidden md:flex items-center gap-1.5 flex-wrap mb-5">
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => onChange(item.id)}
            data-testid={`fn-${item.id}`}
            className={cn(
              "flex items-center gap-2 px-3.5 py-2 rounded-md text-sm font-medium transition-colors border",
              active === item.id
                ? "bg-primary/10 text-primary border-primary/20"
                : "bg-card text-muted-foreground border-border/70 hover:text-foreground hover:bg-muted/50"
            )}
          >
            {item.icon}
            {item.label}
          </button>
        ))}
      </div>

      {/* Mobile: dropdown */}
      <div className="md:hidden mb-4">
        <Select value={active} onValueChange={onChange}>
          <SelectTrigger className="w-full" data-testid={`fn-select`}>
            <div className="flex items-center gap-2">
              {activeItem?.icon}
              <span>{activeItem?.label || label}</span>
            </div>
          </SelectTrigger>
          <SelectContent>
            {items.map((item) => (
              <SelectItem key={item.id} value={item.id}>
                <div className="flex items-center gap-2">
                  {item.icon}
                  <div className="flex flex-col">
                    <span>{item.label}</span>
                    {item.description && <span className="text-xs text-muted-foreground">{item.description}</span>}
                  </div>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </>
  );
}
