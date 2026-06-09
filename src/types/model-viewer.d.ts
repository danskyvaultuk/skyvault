// Ambient type declaration for <model-viewer> custom element.
// No imports — this file must remain a global script, not a module.
// @google/model-viewer registers the element; we tell TypeScript it exists in JSX.

declare namespace React {
  namespace JSX {
    interface IntrinsicElements {
      "model-viewer": React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement>,
        HTMLElement
      > & {
        src?: string;
        alt?: string;
        poster?: string;
        "camera-controls"?: boolean | "";
        "auto-rotate"?: boolean | "";
        "shadow-intensity"?: string;
        "environment-image"?: string;
        exposure?: string;
        loading?: "auto" | "lazy" | "eager";
        reveal?: "auto" | "interaction" | "manual";
        onLoad?: React.ReactEventHandler<HTMLElement>;
        onError?: React.ReactEventHandler<HTMLElement>;
      };
    }
  }
}
