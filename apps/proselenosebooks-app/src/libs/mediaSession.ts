export interface MediaMetadata {
  title?: string;
  artist?: string;
  album?: string;
  artwork?: string;
}

export interface PlaybackState {
  playing: boolean;
  position?: number; // in milliseconds
  duration?: number; // in milliseconds
}

export interface MediaSessionState {
  active: boolean;
  keepAppInForeground?: boolean;
  notificationTitle?: string;
  notificationText?: string;
  foregroundServiceTitle?: string;
  foregroundServiceText?: string;
}

export function getMediaSession() {
  if ('mediaSession' in navigator) {
    return navigator.mediaSession;
  }
  return null;
}
