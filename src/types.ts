export type BoothView = 'landing' | 'booth';
export type BoothMode = 'landscape-video' | 'live-strip' | 'single-frame';

export interface StripFrame {
  id: string;
  name: string;
  bgColor: string;
  textColor: string;
  borderClass: string;
}

export interface CapturedPhoto {
  id: string;
  url: string;
  timestamp: number;
}

export interface CapturedVideo {
  id: string;
  url: string;
  timestamp: number;
}

export interface LivePhoto {
  id: string;
  photoUrl: string;
  videoUrl: string;
}
