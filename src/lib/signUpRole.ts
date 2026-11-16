// Who still signs up on /register (BL-081 / SPEC-030 A3): roofers and drone
// operators, each only while its journey is on. Customers need no sign-up: their
// first sign-in on /login creates their account.
type Switches = { rooferEnabled: boolean; droneEnabled: boolean };

export function openSignUpRole(role: string | null | undefined, switches: Switches): "roofer" | "drone" | null {
  if (role === "roofer" && switches.rooferEnabled) return "roofer";
  if (role === "drone" && switches.droneEnabled) return "drone";
  return null;
}
