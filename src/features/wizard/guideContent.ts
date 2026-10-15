// Link behind the "Open TinkerHub" button in step 1 — swap for the app link if it differs.
export const TINKERHUB_URL = "https://app.tinkerhub.org/download";

// `images` are the screenshots shown for a step (side by side when there are
// two) — files live in public/guide/. A missing file shows the temporary
// placeholder instead, so every step keeps the same height.
export const GUIDE_PLACEHOLDER = "/guide/placeholder.svg";

export const GUIDE_STEPS: { title: string; body: string; images: string[] }[] = [
  {
    title: "Open the TinkerHub app",
    body: "Open TinkerHub and go to your Profile.",
    images: ["/guide/step-1.webp"],
  },
  {
    title: "Go to Projects and tap Add",
    body: "From your Profile, open the Projects tab and tap ADD to start a new project.",
    images: ["/guide/step-2.webp", "/guide/step-2b.webp"],
  },
  {
    title: "Add your info",
    body: "Enter your project name, a short tagline (max 60 characters) and a description of at least 20 characters. That's all you need: tap Next and finish the remaining pages.",
    images: ["/guide/step-3.jpg"],
  },
  {
    title: "Add a cover",
    body: "Add any temporary cover image. No need to worry about it, you can edit it later. Then tap Next.",
    images: ["/guide/step-5.webp"],
  },
  {
    title: "Add collaborators and finish",
    body: "Add yourself under Collaborators so your name shows on the project, then finish and save.",
    images: ["/guide/step-6.png"], // temporary placeholder until a screenshot is added
  },
  {
    title: "Open your project and take a screenshot",
    body: "Open your project from Projects and screenshot its page. It must show:",
    images: ["/guide/step-7.webp"],
  },
];
