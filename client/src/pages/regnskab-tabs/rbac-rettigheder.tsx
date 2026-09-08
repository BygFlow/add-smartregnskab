import RollerKontrol from "@/pages/regnskab-tabs/roller-kontrol";

/**
 * RBAC-visningen bruger den dedikerede role_controls-model. Reglerne bliver
 * håndhævet af backend for regnskab_bogfoerer-rollen.
 */
export default function RbacRettigheder({ companyId }: { companyId: number }) {
  return <RollerKontrol companyId={companyId} />;
}
