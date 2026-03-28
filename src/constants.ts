import { ArtStyle } from "./types";

export const ART_STYLES: { label: ArtStyle; description: string; promptSuffix: string }[] = [
  { label: "Sketch", description: "Hand-drawn pencil sketch", promptSuffix: "hand-drawn pencil sketch, graphite, detailed shading, white background" },
  { label: "Oil Paint", description: "Classic oil on canvas", promptSuffix: "thick oil paint, visible brushstrokes, canvas texture, masterpiece, classical art" },
  { label: "Watercolor", description: "Soft watercolor wash", promptSuffix: "soft watercolor painting, bleeding colors, paper texture, delicate, artistic" },
  { label: "Anime", description: "Modern Japanese animation", promptSuffix: "anime style, vibrant colors, cel shaded, high quality, 4k, studio ghibli inspired" },
  { label: "Pixel Art", description: "Retro 8-bit aesthetic", promptSuffix: "pixel art, 8-bit, retro game style, low res, vibrant colors" },
  { label: "3D Render", description: "Modern CGI look", promptSuffix: "3d render, octane render, unreal engine 5, highly detailed, cinematic lighting, 8k" },
  { label: "Charcoal", description: "Rough charcoal drawing", promptSuffix: "charcoal drawing, rough texture, high contrast, black and white, artistic" },
  { label: "Impressionist", description: "Light and color focus", promptSuffix: "impressionist painting, monet style, dabs of color, natural light, vibrant" },
  { label: "Animated", description: "3D animated movie style", promptSuffix: "pixar style, 3d animation, cute characters, soft lighting, vibrant" },
  { label: "Surrealist", description: "Dream-like imagery", promptSuffix: "surrealism, dali style, dream-like, bizarre, imaginative, high detail" },
  { label: "Comic", description: "Graphic novel style", promptSuffix: "comic book art, bold lines, halftone dots, vibrant, action-oriented" },
  { label: "Cyberpunk", description: "Neon-lit future", promptSuffix: "cyberpunk aesthetic, neon lights, rainy streets, futuristic, high tech, dark atmosphere" },
  { label: "Steampunk", description: "Victorian industrial", promptSuffix: "steampunk style, brass gears, steam, victorian era, intricate machinery" },
  { label: "Vaporwave", description: "80s retro-futurism", promptSuffix: "vaporwave aesthetic, pink and blue gradients, retro 80s, glitch art, nostalgic" },
];

export const TUTORIAL_STEPS = [
  {
    target: ".sketch-canvas",
    content: "Start by drawing a rough sketch here. This acts as a structural guide for the AI.",
  },
  {
    target: ".style-selector",
    content: "Choose an artistic style for your creation.",
  },
  {
    target: ".prompt-input",
    content: "Describe what you want to see in detail.",
  },
  {
    target: ".generate-button",
    content: "Click here to bring your vision to life!",
  },
  {
    target: ".gallery-nav",
    content: "View your past creations and analytics in the Gallery.",
  },
];
