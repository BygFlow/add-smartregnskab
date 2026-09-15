import { Logo } from "@/components/logo";

export const SMARTREGNSKAB_BRAND = {
  product: "ADD SmartRegnskab",
  productSlogan: "Overblik der skaber vækst.",
  familySlogan: "Mere tid til det, der skaber værdi.",
  familySignature: "En del af ADD SmartDrift ApS",
} as const;

export function SmartRegnskabBrand({
  inverse = false,
  compact = false,
  showSlogan = true,
}: {
  inverse?: boolean;
  compact?: boolean;
  showSlogan?: boolean;
}) {
  return (
    <div className={`flex items-center ${compact ? "gap-2" : "gap-3"}`}>
      {inverse ? (
        <span className={`${compact ? "h-8 w-8 rounded-lg p-1" : "h-11 w-11 rounded-xl p-1.5"} flex shrink-0 items-center justify-center bg-white shadow-sm`}>
          <Logo className="h-full w-full text-primary" />
        </span>
      ) : (
        <Logo className={`${compact ? "h-8 w-8" : "h-11 w-11"} shrink-0 text-primary`} />
      )}
      <div className="min-w-0">
        <div className={`${compact ? "text-sm" : "text-lg"} font-bold tracking-tight ${inverse ? "text-white" : "text-foreground"}`}>
          {SMARTREGNSKAB_BRAND.product}
        </div>
        {showSlogan && (
          <div className={`${compact ? "text-[10px]" : "text-xs"} ${inverse ? "text-white/70" : "text-muted-foreground"}`}>
            {SMARTREGNSKAB_BRAND.productSlogan}
          </div>
        )}
      </div>
    </div>
  );
}
