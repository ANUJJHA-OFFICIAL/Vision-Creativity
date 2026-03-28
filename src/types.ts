export type ArtStyle = 
  | "Sketch" 
  | "Oil Paint" 
  | "Watercolor" 
  | "Anime" 
  | "Pixel Art" 
  | "3D Render" 
  | "Charcoal" 
  | "Impressionist" 
  | "Animated" 
  | "Surrealist" 
  | "Comic" 
  | "Cyberpunk" 
  | "Steampunk" 
  | "Vaporwave";

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  role: "admin" | "user";
  bio?: string;
  createdAt: string;
}

export interface ArtGeneration {
  id: string;
  userId: string;
  prompt: string;
  style: ArtStyle;
  imageUrl: string;
  sketchUrl?: string;
  createdAt: number;
  analytics: {
    width: number;
    height: number;
    model: string;
  };
}

export interface PermissionRequest {
  id: string;
  userId: string;
  userEmail: string;
  status: "pending" | "approved" | "rejected";
  createdAt: number;
}
