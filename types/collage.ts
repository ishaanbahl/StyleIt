    // types/collage.ts

    // Metadata for processed images saved to gallery/storage
    export interface SavedImage {
      id: string; // asset ID or unique file ID
      uri: string; // file URI for display
      filename: string; // User-defined name
      timestamp: number;
      category: 'top' | 'bottom' | 'outerwear' | 'accessory' | 'footwear' | 'fullbody';
      warmth: 'light' | 'medium' | 'warm';
      occasion?: 'casual' | 'formal' | 'sporty' | 'business' | 'everyday';
      color?: string;
      tags?: string[];
    }

    // Represents an item placed on the collage canvas
    export interface CanvasItem extends SavedImage {
      x: number;
      y: number;
      width?: number;
      height?: number;
      // Add scale, rotation etc. later if needed
    }

    // Represents a saved named collage
    export interface NamedCollage {
      id: string; // Unique ID for the saved collage entry
      name: string;
      items: CanvasItem[]; // The array of items in this specific collage
      timestamp: number;
    } 
