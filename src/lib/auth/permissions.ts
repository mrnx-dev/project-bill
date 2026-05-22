export const PERMISSIONS = {
  org_manage: ["OWNER"],
  team_manage: ["OWNER", "ADMIN"],
  billing: ["OWNER"],
  export: ["OWNER"],
  settings: ["OWNER", "ADMIN"],
  mark_paid: ["OWNER", "ADMIN"],
  change_invoice_status: ["OWNER", "ADMIN"],
  void_invoice: ["OWNER", "ADMIN"],
  delete_invoice: ["OWNER", "ADMIN"],
  send_email: ["OWNER", "ADMIN"],
  milestone_approve: ["OWNER", "ADMIN"],
  recurring_invoice_cud: ["OWNER", "ADMIN"],
  sow_template_cud: ["OWNER", "ADMIN"],
  view_audit_log: ["OWNER", "ADMIN"],
  agent_config: ["OWNER", "ADMIN"],
  create_payment_link: ["OWNER", "ADMIN"],
  invoice_crud: ["OWNER", "ADMIN", "MEMBER"],
  client_crud: ["OWNER", "ADMIN", "MEMBER"],
  project_crud: ["OWNER", "ADMIN", "MEMBER"],
  dashboard_view: ["OWNER", "ADMIN", "MEMBER"],
  view_recurring: ["OWNER", "ADMIN", "MEMBER"],
  view_sow_template: ["OWNER", "ADMIN", "MEMBER"],
  view_own_notifications: ["OWNER", "ADMIN", "MEMBER"],
} as const;

export type Permission = keyof typeof PERMISSIONS;

export function canPerform(permission: Permission, role: string): boolean {
  return (PERMISSIONS[permission] as readonly string[]).includes(role);
}