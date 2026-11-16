// The roles an admin may give a user (BL-080 / SPEC-029 D1): roofer and drone
// only while their journey is on. A user who already holds a role keeps seeing
// it, so the role changer never shows a blank or a wrong role.
export const ALL_ROLES = ["customer", "roofer", "drone", "admin"] as const;
export type AdminRole = (typeof ALL_ROLES)[number];

export function offeredRoles(switches: { rooferEnabled: boolean; droneEnabled: boolean }, currentRole: string): AdminRole[] {
  return ALL_ROLES.filter(
    (role) =>
      role === currentRole ||
      (role === "roofer" ? switches.rooferEnabled : role === "drone" ? switches.droneEnabled : true)
  );
}
