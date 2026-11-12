export interface ClientSettings {
  digitalFlow?: boolean;
  physical?: boolean;
  ocr?: boolean;
  triangulation?: boolean;
  /** Max client users this organization can create (super-admin configured). */
  maxUsers?: number | null;
  /** Max custom roles this organization can create (super-admin configured). */
  maxRoles?: number | null;
}
