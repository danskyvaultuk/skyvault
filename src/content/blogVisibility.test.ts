import { describe, expect, it } from "vitest";
import { visibleBlogPosts } from "./blogVisibility";
import { blogPosts } from "@/data/blogPosts";

const general = { slug: "roof-care", journey: undefined };
const drone = { slug: "3d-roof-survey-demo", journey: "drone" as const };

describe("visibleBlogPosts (SPEC-018 C2)", () => {
  it("hides drone posts while the drone journey is off", () => {
    expect(visibleBlogPosts([general, drone], { droneEnabled: false }).map((p) => p.slug)).toEqual(["roof-care"]);
  });

  it("lists drone posts when the drone journey is on", () => {
    expect(visibleBlogPosts([general, drone], { droneEnabled: true }).map((p) => p.slug)).toEqual(["roof-care", "3d-roof-survey-demo"]);
  });

  it("marks the 3D drone demo post as a drone post, so it is hidden at launch", () => {
    expect(visibleBlogPosts(blogPosts, { droneEnabled: false }).map((p) => p.slug)).not.toContain("3d-roof-survey-demo");
  });
});
