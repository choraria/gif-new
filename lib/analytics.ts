type WindowWithGTag = Window & {
  gtag: (...args: unknown[]) => void;
  dataLayer: unknown[];
};

declare const window: WindowWithGTag;

declare global {
  interface Window {
    gtag: (command: string, targetId: string, config?: Record<string, unknown>) => void;
  }
}

export const GA_MEASUREMENT_ID = 'G-1JE88W6BFC';

// Initialize GA4
export const initGA = (): void => {
  if (typeof window !== 'undefined') {
    window.dataLayer = window.dataLayer || [];
    window.gtag = function gtag(...args: unknown[]) {
      window.dataLayer.push(args);
    };
    window.gtag('js', new Date());
    window.gtag('config', GA_MEASUREMENT_ID, {
      page_path: window.location.pathname,
      user_properties: {
        theme_preference: localStorage.getItem('theme') || 'system',
      },
    });
  }
};

// Track page views
export const pageview = (url: string): void => {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('config', GA_MEASUREMENT_ID, {
      page_path: url,
    });
  }
};

// Track events
export const event = ({ action, category, label, value }: {
  action: string;
  category: string;
  label?: string;
  value?: number;
}): void => {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', action, {
      event_category: category,
      event_label: label,
      value: value,
    });
  }
};

// Button click event names
export const ANALYTICS_EVENTS = {
  SHOW_PREVIEW: 'Show Camera Preview',
  START_RECORDING: 'Start Recording',
  STOP_RECORDING: 'Stop Recording',
  START_OVER: 'Start Over',
  CONVERT_TO_GIF: 'Convert to GIF',
  DOWNLOAD_GIF: 'Download GIF',
  TRIM_VIDEO: 'Trim Video',
  UNDO_TRIM: 'Undo Trim',
  TRIM_DONE: 'Trim Done',
  TRIM_PREVIEW: 'Trim Preview',
  THEME_TOGGLE: 'Toggle Theme',
  COOKIE_ACCEPT: 'Accept Cookies',
  COOKIE_DECLINE: 'Decline Cookies',
} as const;

// Track theme changes
export const trackThemeChange = (theme: string): void => {
  event({
    action: 'theme_change',
    category: 'User Preference',
    label: theme,
  });
};

// Track recording duration
export const trackRecordingDuration = (duration: number): void => {
  event({
    action: 'recording_duration',
    category: 'User Interaction',
    label: 'Recording Length',
    value: duration,
  });
};

// Track GIF conversion
export const trackGIFConversion = (success: boolean, error?: string): void => {
  event({
    action: 'gif_conversion',
    category: 'Conversion',
    label: success ? 'Success' : `Failed: ${error || 'Unknown error'}`,
  });
}; 