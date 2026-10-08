import { useQuery } from "@tanstack/react-query";
import { FileText, LogOut, ReceiptText, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";

type PortalSettings = {
  allowDocuments?: boolean | null;
  allowInvoices?: boolean | null;
  theme?: string | null;
  welcomeMessage?: string | null;
};

type PortalInvoice = {
  id: number;
  invoiceNumber: string;
  issueDate: string;
  dueDate?: string | null;
  totalAmount: number;
  status: string;
};

type PortalDocument = {
  id: number;
  title: string;
  documentType: string;
  fileObjectId?: number | null;
  fileName?: string | null;
  description?: string | null;
  createdAt: string;
};

const money = new Intl.NumberFormat("da-DK", { style: "currency", currency: "DKK" });
const date = (value?: string | null) => value ? new Date(value).toLocaleDateString("da-DK") : "—";

export default function CustomerPortal() {
  const { company, user, logout, hasFeature } = useAuth();
  const enabled = hasFeature("kundeportal");
  const settingsQuery = useQuery<PortalSettings[]>({
    queryKey: ["/api/customer-portal-settings", "customer"],
    enabled,
    queryFn: async () => (await apiRequest("GET", "/api/customer-portal-settings")).json(),
  });
  const invoicesQuery = useQuery<PortalInvoice[]>({
    queryKey: ["/api/invoices", "customer"], enabled,
    queryFn: async () => (await apiRequest("GET", "/api/invoices")).json(),
  });
  const documentsQuery = useQuery<PortalDocument[]>({
    queryKey: ["/api/portal-documents", "customer"], enabled,
    queryFn: async () => (await apiRequest("GET", "/api/portal-documents")).json(),
  });
  const settings = settingsQuery.data?.[0];

  return (
    <main className="min-h-screen bg-muted/30">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Privat kundeportal</p>
            <h1 className="text-xl font-semibold">{company?.name || "ADD SmartRegnskab"}</h1>
          </div>
          <Button variant="outline" size="sm" onClick={() => logout()}><LogOut className="mr-2 h-4 w-4" />Log ud</Button>
        </div>
      </header>

      <div className="mx-auto max-w-5xl space-y-6 px-4 py-8">
        {!enabled ? (
          <section className="rounded-lg border bg-card p-8 text-center shadow-sm">
            <ShieldCheck className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
            <h2 className="font-semibold">Kundeportalen er ikke aktiveret</h2>
            <p className="mt-2 text-sm text-muted-foreground">Kontakt virksomheden, hvis du forventer adgang.</p>
          </section>
        ) : (
          <>
            <section className="rounded-lg border bg-card p-5 shadow-sm">
              <h2 className="font-semibold">Velkommen {user?.name ? `, ${user.name}` : ""}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {settings?.welcomeMessage || "Her kan du se dine egne fakturaer og de dokumenter, virksomheden har delt med dig."}
              </p>
              <p className="mt-3 text-xs text-muted-foreground">Indholdet er privat og kan ikke deles via offentlige links.</p>
            </section>

            {settings?.allowInvoices !== false && (
              <section className="space-y-3">
                <div className="flex items-center gap-2"><ReceiptText className="h-5 w-5" /><h2 className="font-semibold">Dine fakturaer</h2></div>
                <div className="overflow-hidden rounded-lg border bg-card">
                  {(invoicesQuery.data || []).length === 0 ? <p className="p-5 text-sm text-muted-foreground">Ingen fakturaer er tilgængelige.</p> :
                    (invoicesQuery.data || []).map((invoice) => (
                      <div key={invoice.id} className="flex flex-wrap items-center justify-between gap-3 border-b p-4 last:border-b-0">
                        <div><p className="font-medium">{invoice.invoiceNumber}</p><p className="text-xs text-muted-foreground">Udstedt {date(invoice.issueDate)} · Forfalder {date(invoice.dueDate)} · {invoice.status}</p></div>
                        <div className="flex items-center gap-3"><span className="font-medium tabular-nums">{money.format(Number(invoice.totalAmount || 0))}</span><Button asChild size="sm" variant="outline"><a href={`/api/invoices/${invoice.id}/pdf`}>Se PDF</a></Button></div>
                      </div>
                    ))}
                </div>
              </section>
            )}

            {settings?.allowDocuments !== false && (
              <section className="space-y-3">
                <div className="flex items-center gap-2"><FileText className="h-5 w-5" /><h2 className="font-semibold">Delte dokumenter</h2></div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {(documentsQuery.data || []).length === 0 ? <p className="text-sm text-muted-foreground">Ingen dokumenter er delt med dig.</p> :
                    (documentsQuery.data || []).map((document) => (
                      <article key={document.id} className="rounded-lg border bg-card p-4">
                        <p className="font-medium">{document.title}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{document.documentType} · {date(document.createdAt)}</p>
                        {document.fileName && <p className="mt-2 text-sm">{document.fileName}</p>}
                        {document.description && <p className="mt-1 text-sm text-muted-foreground">{document.description}</p>}
                        {document.fileObjectId && <Button asChild size="sm" variant="outline" className="mt-3"><a href={`/api/portal-documents/${document.id}/file`}>Hent dokument</a></Button>}
                      </article>
                    ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}
