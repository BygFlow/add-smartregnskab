import { Logo } from "@/components/logo";

export const SMARTREGNSKAB_BRAND = {
  product: "ADD SmartRegnskab",
  descriptor: "TIL DIN VIRKSOMHED",
  productSlogan: "Mere tid til det, der skaber værdi",
  familySignature: "En del af ADD SmartDrift ApS",
} as const;

export function SmartRegnskabBrand({
  inverse = false,
  compact = false,
  showDescriptor = true,
}: {
  inverse?: boolean;
  compact?: boolean;
  showDescriptor?: boolean;
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
        {showDescriptor && (
          <div className={`${compact ? "text-[8px]" : "text-[10px]"} font-medium uppercase tracking-[0.2em] ${inverse ? "text-white/65" : "text-muted-foreground"}`}>
            {SMARTREGNSKAB_BRAND.descriptor}
          </div>
        )}
      </div>
    </div>
  );
}
