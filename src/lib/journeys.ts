// Launch scope switches (BL-058). SkyVault launches with the customer
// self-upload journey only; the drone and roofer journeys stay in the code
// behind these switches, both OFF unless their setting is exactly "on".
//
// This is the only module that reads the settings. They are NEXT_PUBLIC_
// because client components read them too, so Next.js inlines them at
// build time: changing one needs a redeploy. They carry no secret.

export interface JourneySettings {
  drone: string | undefined;
  roofer: string | undefined;
}

const ON = "on";

export class JourneySwitches {
  readonly droneEnabled: boolean;
  readonly rooferEnabled: boolean;

  constructor(settings: JourneySettings) {
    this.droneEnabled = settings.drone === ON;
    this.rooferEnabled = settings.roofer === ON;
  }
}

export const journeys = new JourneySwitches({
  drone: process.env.NEXT_PUBLIC_SKYVAULT_DRONE_JOURNEY,
  roofer: process.env.NEXT_PUBLIC_SKYVAULT_ROOFER_JOURNEY,
});
