
export interface VideoFile {
  id: string;
  name: string;
  url: string;
  type: string;
  size: number;
}

export interface Annotation {
  id: string;
  timestamp: number;
  type: 'drawing' | 'text';
  data: string;
}

export interface LinkedReference {
  id: string;
  timestamp: number;
  title: string;
  url: string;
  type: 'wikipedia' | 'document' | 'external';
}

export interface SpatialLabel {
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface AIAnalysis {
  timestamp: number;
  description: string;
  type: 'summary' | 'scene' | 'object';
  thumbnail?: string;
  labels?: SpatialLabel[];
  speaker?: string;
}

export interface Chapter {
  timestamp: number;
  title: string;
}

export interface Poll {
  id: string;
  timestamp: number;
  question: string;
  options: string[];
  active: boolean;
}

export enum PlayerState {
  IDLE = 'IDLE',
  PLAYING = 'PLAYING',
  PAUSED = 'PAUSED',
  BUFFERING = 'BUFFERING'
}

export type ViewMode = 'Standard' | 'Cinema' | 'Analysis' | 'Collaboration' | 'VR';
export type StyleMode = 'Default' | 'Cinematic' | 'Study' | 'Neon' | 'Noir';
