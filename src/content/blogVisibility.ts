// Which blog posts the public can see (BL-059 / SPEC-018 C2). A post about a
// journey that is switched off (BL-058) is hidden, not deleted.
import type { JourneySwitches } from "@/lib/journeys";

type Journeyed = { journey?: "drone" };

export function visibleBlogPosts<P extends Journeyed>(posts: readonly P[], switches: Pick<JourneySwitches, "droneEnabled">): P[] {
  return posts.filter((post) => post.journey !== "drone" || switches.droneEnabled);
}
