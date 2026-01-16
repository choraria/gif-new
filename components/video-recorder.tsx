"use client"

import { useRef, useState, useEffect, forwardRef, useCallback } from "react"
import Image from "next/image"
import type { FFmpeg } from "@ffmpeg/ffmpeg"
import { Eye, Video, RotateCcw, ImagePlay, Download, Scissors, Undo, Type, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ColorPicker } from "@/components/ui/color-picker"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogPortal, DialogOverlay } from "@/components/ui/dialog"
import { Slider } from "@/components/ui/slider"
import { event, ANALYTICS_EVENTS, trackRecordingDuration, trackGIFConversion } from "@/lib/analytics"

// Type definitions for browser APIs
declare global {
  interface HTMLVideoElement {
    captureStream(): MediaStream;
  }
}

// Helper type for accessing potentially undefined browser APIs
type ExtendedWindow = Window & {
  orientation?: number;
};

type ExtendedScreenWithOrientation = {
  orientation?: {
    angle: number;
    type: string;
    addEventListener: (event: string, handler: () => void) => void;
    removeEventListener: (event: string, handler: () => void) => void;
  };
};

// Enhanced text overlay interface
interface TextOverlay {
  id: string;
  text: string;
  x: number;
  y: number;
  fontSize: number;
  fontFamily: string;
  fontColor: string;
  backgroundColor: string;
  backgroundOpacity: number;
  showBackground: boolean;
}

let ffmpeg: FFmpeg | null = null

// Font families available for selection - moved outside component since it's static
const fontFamilies = [
  { name: 'Impact', value: 'Impact', file: 'impact.ttf', cssFamily: 'Impact, "Arial Black", sans-serif' },
  { name: 'Arial', value: 'Arial', file: 'arial.ttf', cssFamily: 'Arial, "Helvetica Neue", sans-serif' },
  { name: 'Helvetica', value: 'Helvetica', file: 'helvetica.ttf', cssFamily: 'Helvetica, Arial, sans-serif' },
  { name: 'Times', value: 'Times', file: 'times.ttf', cssFamily: 'Times, "Times New Roman", serif' },
  { name: 'Courier', value: 'Courier', file: 'courier.ttf', cssFamily: 'Courier, "Courier New", monospace' },
  { name: 'Anton', value: 'Anton', file: 'anton.ttf', cssFamily: 'Anton, Impact, sans-serif' },
];

// Create a forwarded ref component for the dialog content
const CustomDialogContent = forwardRef<HTMLDivElement, React.ComponentPropsWithoutRef<typeof DialogContent>>((props, ref): React.ReactElement => (
  <DialogPortal>
    <DialogOverlay ref={ref} className="bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
    <DialogContent ref={ref} {...props} className="fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg sm:max-w-md">
      {props.children}
    </DialogContent>
  </DialogPortal>
));
CustomDialogContent.displayName = 'CustomDialogContent';

export function VideoRecorder(): React.ReactElement {
  const [isInitialized, setIsInitialized] = useState(false)
  const [showWelcomeGif, setShowWelcomeGif] = useState(true)
  const [hasCameraPermission, setHasCameraPermission] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [isPreviewMode, setIsPreviewMode] = useState(false)
  const [isTrimMode, setIsTrimMode] = useState(false)
  const [isTrimProcessing, setIsTrimProcessing] = useState(false)
  const [recordedChunks, setRecordedChunks] = useState<Blob[]>([])
  const [videoUrl, setVideoUrl] = useState<string>("")
  const [originalVideoUrl, setOriginalVideoUrl] = useState<string>("")
  const [originalChunks, setOriginalChunks] = useState<Blob[]>([])
  const [gifUrl, setGifUrl] = useState<string>("")
  const [_startTime, _setStartTime] = useState(0)
  const [_endTime, _setEndTime] = useState(10)
  const [videoDuration, setVideoDuration] = useState(0)
  const [recordedDuration, setRecordedDuration] = useState(0) // Track actual recorded duration
  const [originalVideoDuration, setOriginalVideoDuration] = useState(0) // Track original video duration for undo
  const [trimRange, setTrimRange] = useState([0, 0])
  const [isPlaying, setIsPlaying] = useState(false)
  
  // Enhanced text overlay state
  const [isTextDialogOpen, setIsTextDialogOpen] = useState(false)
  const [textOverlays, setTextOverlays] = useState<TextOverlay[]>([])
  const [selectedOverlay, setSelectedOverlay] = useState<string | null>(null)
  const [editingOverlay, setEditingOverlay] = useState<TextOverlay | null>(null)
  const [fontsLoaded, setFontsLoaded] = useState(false)
  
  // Legacy support for existing single text overlay
  const [textOverlay, setTextOverlay] = useState("")
  const [textPosition, setTextPosition] = useState({ x: 50, y: 50 })
  const [_fontSize, _setFontSize] = useState(24)
  
  const [countdown, setCountdown] = useState(10)
  const [isDragging, setIsDragging] = useState(false)
  const [draggedOverlayId, setDraggedOverlayId] = useState<string | null>(null)
  const [startCountdown, setStartCountdown] = useState<number | null>(null)
  const [isConverting, setIsConverting] = useState(false)
  const [conversionProgress, setConversionProgress] = useState(0)
  const textPreviewRef = useRef<HTMLDivElement>(null)
  const [loadingError, setLoadingError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const [hasBeenTrimmed, setHasBeenTrimmed] = useState(false)
  const [isLandscape, setIsLandscape] = useState(true)

  const videoRef = useRef<HTMLVideoElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const currentCountdownRef = useRef<number>(10) // Track current countdown value for duration calculation

  // Add a ref to track the previous trim range
  const prevTrimRangeRef = useRef([0, 0]);

  // Add a ref to track if we're manually seeking
  const isManualSeekingRef = useRef(false);

  // Function to check if device is mobile
  const isMobileDevice = useCallback((): boolean => {
    if (typeof window === 'undefined') return false;
    
    // Method 1: Touch capability + screen size
    const hasTouchScreen = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    const hasSmallScreen = window.screen.width <= 768 || window.screen.height <= 768;
    
    // Method 2: User agent (as fallback)
    const userAgentMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    // Method 3: Pointer type detection
    const hasCoarsePointer = window.matchMedia('(pointer: coarse)').matches;
    
    // Method 4: Check if any orientation API exists (mobile-specific)
    const extendedWindow = window as ExtendedWindow;
    const screenWithOrientation = window.screen as ExtendedScreenWithOrientation;
    const hasOrientationAPI = 'orientation' in extendedWindow || ('screen' in window && screenWithOrientation.orientation);
    
    // Combine multiple signals - need at least 2 to be confident it's mobile
    const mobileSignals = [
      hasTouchScreen && hasSmallScreen,
      userAgentMobile,
      hasCoarsePointer,
      hasOrientationAPI && hasTouchScreen
    ].filter(Boolean).length;
    
    return mobileSignals >= 2;
  }, []);

  // Function to check orientation
  const checkOrientation = useCallback((): void => {
    let isCurrentlyLandscape = false;
    
    if (typeof window === 'undefined') {
      setIsLandscape(isCurrentlyLandscape);
      return;
    }
    
    const screenWithOrientation = window.screen as ExtendedScreenWithOrientation;
    const extendedWindow = window as ExtendedWindow;
    
    // Method 1: Modern Screen Orientation API (most reliable)
    if (screenWithOrientation.orientation) {
      const orientation = screenWithOrientation.orientation;
      isCurrentlyLandscape = orientation.angle === 90 || orientation.angle === 270 || 
                            orientation.type.includes('landscape');
    }
    // Method 2: Legacy window.orientation (iOS Safari fallback)
    else if ('orientation' in extendedWindow && typeof extendedWindow.orientation === 'number') {
      const angle = extendedWindow.orientation;
      isCurrentlyLandscape = Math.abs(angle) === 90;
    }
    // Method 3: Window dimensions (final fallback)
    else {
      isCurrentlyLandscape = window.innerWidth > window.innerHeight;
    }
    
    setIsLandscape(isCurrentlyLandscape);
  }, []);

  // Listen for orientation changes
  useEffect(() => {
    // Initial check
    checkOrientation();
    
    const listeners: (() => void)[] = [];
    
    // Method 1: Modern Screen Orientation API
    if (typeof window !== 'undefined') {
      const screenWithOrientation = window.screen as ExtendedScreenWithOrientation;
      if (screenWithOrientation.orientation) {
        const handleOrientationChange = (): void => {
          // Small delay to ensure orientation change is complete
          setTimeout(checkOrientation, 100);
        };
        screenWithOrientation.orientation.addEventListener('change', handleOrientationChange);
        listeners.push(() => screenWithOrientation.orientation?.removeEventListener('change', handleOrientationChange));
      }
    }
    
    // Method 2: Legacy orientationchange event
    const handleLegacyOrientationChange = (): void => {
      // Small delay to ensure orientation change is complete
      setTimeout(checkOrientation, 100);
    };
    window.addEventListener('orientationchange', handleLegacyOrientationChange);
    listeners.push(() => window.removeEventListener('orientationchange', handleLegacyOrientationChange));
    
    // Method 3: CSS media query changes
    const orientationMediaQuery = window.matchMedia("(orientation: landscape)");
    const handleMediaQueryChange = (): void => {
      checkOrientation();
    };
    
    if (orientationMediaQuery.addEventListener) {
      orientationMediaQuery.addEventListener('change', handleMediaQueryChange);
      listeners.push(() => orientationMediaQuery.removeEventListener('change', handleMediaQueryChange));
    } else {
      // Fallback for older browsers
      orientationMediaQuery.addListener(handleMediaQueryChange);
      listeners.push(() => orientationMediaQuery.removeListener(handleMediaQueryChange));
    }
    
    // Method 4: Window resize as final backup
    const handleResize = (): void => {
      checkOrientation();
    };
    window.addEventListener('resize', handleResize);
    listeners.push(() => window.removeEventListener('resize', handleResize));
    
    // Cleanup all listeners
    return () => {
      listeners.forEach(cleanup => cleanup());
    };
  }, [checkOrientation]);

  // Simplified function - no longer needed with UX-based orientation enforcement
  const createCanvasStream = useCallback((): MediaStream | null => {
    // With UX-based orientation enforcement, we don't need complex canvas processing
    // Users will be prompted to rotate to landscape, ensuring proper video orientation
    return null;
  }, []);

  // Load fonts when component mounts
  useEffect(() => {
    const loadFonts = async (): Promise<void> => {
      try {
        // Force font loading by creating hidden elements with each font
        const fontPromises = fontFamilies.map(async (fontInfo) => {
          return new Promise<void>((resolve) => {
            const testElement = document.createElement('div');
            testElement.style.fontFamily = fontInfo.cssFamily;
            testElement.style.fontSize = '1px';
            testElement.style.visibility = 'hidden';
            testElement.style.position = 'absolute';
            testElement.textContent = 'Test';
            document.body.appendChild(testElement);
            
            // Force font load by checking if it's loaded
            if (document.fonts) {
              document.fonts.load(`1px ${fontInfo.cssFamily}`).then(() => {
                document.body.removeChild(testElement);
                resolve();
              }).catch(() => {
                document.body.removeChild(testElement);
                resolve(); // Resolve even on error to not block other fonts
              });
            } else {
              // Fallback for browsers without document.fonts API
              setTimeout(() => {
                document.body.removeChild(testElement);
                resolve();
              }, 100);
            }
          });
        });
        
        await Promise.all(fontPromises);
        setFontsLoaded(true);
      } catch (error) {
        console.warn('Font loading failed:', error);
        setFontsLoaded(true); // Set to true anyway to not block the UI
      }
    };
    
    loadFonts();
  }, []);

  // Create a new text overlay
  const createNewTextOverlay = (): TextOverlay => ({
    id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
    text: '',
    x: 50,
    y: 50,
    fontSize: 50,
    fontFamily: 'Impact',
    fontColor: '#ffffff',
    backgroundColor: '#000000',
    backgroundOpacity: 0.5,
    showBackground: false,
  });

  // Add a new text overlay
  const addTextOverlay = (): void => {
    const newOverlay = createNewTextOverlay();
    setEditingOverlay(newOverlay);
    setIsTextDialogOpen(true);
  };

  // Edit an existing text overlay
  const editTextOverlay = (overlay: TextOverlay): void => {
    setEditingOverlay({ ...overlay });
    setIsTextDialogOpen(true);
  };

  // Save text overlay (create new or update existing)
  const saveTextOverlay = (): void => {
    if (!editingOverlay || !editingOverlay.text.trim()) return;
    
    setTextOverlays(prev => {
      const existingIndex = prev.findIndex(o => o.id === editingOverlay.id);
      if (existingIndex >= 0) {
        // Update existing
        const updated = [...prev];
        updated[existingIndex] = editingOverlay;
        return updated;
      } else {
        // Add new
        return [...prev, editingOverlay];
      }
    });
    
    setEditingOverlay(null);
    setIsTextDialogOpen(false);
  };

  // Delete a text overlay
  const deleteTextOverlay = (id: string): void => {
    setTextOverlays(prev => prev.filter(o => o.id !== id));
    if (selectedOverlay === id) {
      setSelectedOverlay(null);
    }
  };

  // FFmpeg loading with timeout and retry - independent of camera
  useEffect(() => {
    const MAX_RETRIES = 3;
    const TIMEOUT_MS = 10000; // 10 seconds timeout
    let timeoutId: NodeJS.Timeout;

    const load = async (): Promise<void> => {
      try {
        setLoadingError(null);
        const loadPromise = (async (): Promise<void> => {
          const { FFmpeg } = await import("@ffmpeg/ffmpeg")
          const { toBlobURL } = await import("@ffmpeg/util")
          
          if (!ffmpeg) {
            ffmpeg = new FFmpeg()
            const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd"
            await ffmpeg.load({
              coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
              wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm")
            })
          }
          setIsInitialized(true) // FFmpeg is ready
        })();

        // Set up timeout
        const timeoutPromise = new Promise<never>((_, reject) => {
          timeoutId = setTimeout(() => {
            reject(new Error("FFmpeg loading timed out"));
          }, TIMEOUT_MS);
        });

        await Promise.race([loadPromise, timeoutPromise]);
      } catch (error) {
        setLoadingError(error instanceof Error ? error.message : "Failed to load FFmpeg");
        
        // Retry logic
        if (retryCount < MAX_RETRIES) {
          setRetryCount(prev => prev + 1);
          setTimeout(load, 2000); // Retry after 2 seconds
        }
      } finally {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
      }
    }
    load()

    return (): void => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  }, [retryCount])

  // Separate function to initialize camera
  const initializeCamera = async (): Promise<boolean> => {
    const MAX_CAMERA_RETRIES = 3;
    let retryAttempt = 0;

    const tryInitializeVideo = async (): Promise<boolean> => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "user",
            width: { ideal: 1280 },
            height: { ideal: 720 },
            aspectRatio: { ideal: 16/9 }
          }
        });
        
        // Test the stream is working
        const videoTrack = stream.getVideoTracks()[0];
        if (!videoTrack || !videoTrack.enabled) {
          throw new Error("Video track not available");
        }
        
        // Stop the test stream
        stream.getTracks().forEach(track => track.stop());
        
        setHasCameraPermission(true);
        setLoadingError(null);
        return true;
      } catch {
        if (retryAttempt < MAX_CAMERA_RETRIES) {
          retryAttempt++;
          await new Promise(resolve => setTimeout(resolve, 2000));
          return tryInitializeVideo();
        } else {
          setLoadingError("Failed to initialize camera. Please check your camera permissions and refresh the page.");
          return false;
        }
      }
    };

    return tryInitializeVideo();
  };

  // Cleanup countdown interval on unmount
  useEffect(() => {
    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current)
      }
    }
  }, [])

  // Global click handler for text deselection while keeping video controls accessible
  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent): void => {
      // Only handle deselection if we have a selected overlay
      if (!selectedOverlay) return;

      const target = e.target as Element;
      
      // Check if the click was on a text overlay element or its children
      const isTextOverlayClick = target.closest('[data-text-overlay="true"]');
      
      // Check if the click was on a video control element
      const isVideoControlClick = target.closest('video') && target !== target.closest('video');
      
      // Deselect if clicking outside text overlays and not on video controls
      if (!isTextOverlayClick && !isVideoControlClick) {
        setSelectedOverlay(null);
      }
    };

    // Add the global click listener
    document.addEventListener('click', handleGlobalClick, true);

    // Cleanup on unmount
    return () => {
      document.removeEventListener('click', handleGlobalClick, true);
    };
  }, [selectedOverlay])

  // Function to set video source using <source> element approach for Safari iOS compatibility
  const setVideoSource = useCallback((blobUrl: string): void => {
    if (!videoRef.current || !blobUrl) return;
    
    // Clear existing sources but preserve track elements
    const existingTracks = Array.from(videoRef.current.querySelectorAll('track'));
    videoRef.current.innerHTML = '';
    
    // Create source element
    const source = document.createElement('source');
    source.src = blobUrl;
    source.type = 'video/mp4'; // Use mp4 for better Safari compatibility
    videoRef.current.appendChild(source);
    
    // Re-add all existing track elements, or add default track if none exist
    if (existingTracks.length > 0) {
      existingTracks.forEach(track => {
        videoRef.current!.appendChild(track);
      });
    } else {
      // Add default captions track if none exist
      const track = document.createElement('track');
      track.kind = 'captions';
      track.srclang = 'en';
      track.label = 'English captions';
      videoRef.current.appendChild(track);
    }
    
    // Force reload to apply new source
    videoRef.current.load();
  }, []);

  const handleDataAvailable = (chunks: Blob[], calculatedDuration?: number): void => {
    // Create video blob and update UI - use mp4 for better Safari compatibility
    const blob = new Blob(chunks, { type: "video/mp4" })
    const url = URL.createObjectURL(blob)
    setVideoUrl(url)
    setOriginalVideoUrl(url)
    setRecordedChunks(chunks)
    setOriginalChunks(chunks)
    setHasBeenTrimmed(false)
    setIsTrimMode(false)
    
    // Set video duration immediately from calculated duration or recorded duration
    const durationToUse = calculatedDuration || recordedDuration;
    
    if (durationToUse > 0) {
      setVideoDuration(durationToUse)
      setOriginalVideoDuration(durationToUse) // Track original duration for undo
      setTrimRange([0, durationToUse])
      prevTrimRangeRef.current = [0, durationToUse]
      setRecordedDuration(durationToUse) // Ensure recordedDuration is also set
    }
  }

  // Update the handleVideoMetadata to use recorded duration as fallback
  const handleVideoMetadata = useCallback(() => {
    if (videoRef.current) {
      // Only use metadata duration if we don't have a recorded duration from countdown
      // This preserves the countdown-based duration calculation
      if (recordedDuration <= 0) {
        const _metadataDuration = videoRef.current.duration;
        if (isFinite(_metadataDuration) && _metadataDuration > 0) {
          setVideoDuration(_metadataDuration);
          if (isTrimMode) {
            const initialRange = [0, _metadataDuration];
            setTrimRange(initialRange);
            prevTrimRangeRef.current = initialRange;
          }
        }
      } else {
        // We have a countdown-based recorded duration, ensure it's used consistently
        if (videoDuration !== recordedDuration) {
          setVideoDuration(recordedDuration);
        }
        if (isTrimMode) {
          const initialRange = [0, recordedDuration];
          setTrimRange(initialRange);
          prevTrimRangeRef.current = initialRange;
        }
      }
    }
  }, [isTrimMode, recordedDuration, videoDuration]);

  // Add trim range change handler
  const handleTrimRangeChange = useCallback((values: number[]): void => {
    if (!Array.isArray(values) || values.length !== 2 || !values.every(isFinite)) {
      return;
    }
    
    const [start, end] = values;
    
    // Use the most reliable duration source
    const currentDuration = videoDuration > 0 ? videoDuration : (recordedDuration > 0 ? recordedDuration : 0);
    
    if (currentDuration <= 0 || start < 0 || end > currentDuration || start >= end) {
      return;
    }

    const [prevStart, prevEnd] = prevTrimRangeRef.current;
    
    // Update video preview based on which handle was moved
    if (videoRef.current) {
      const startChanged = start !== prevStart;
      const endChanged = end !== prevEnd;
      
      let targetTime = null;
      
      if (startChanged && !endChanged) {
        // Only start handle moved
        targetTime = start;
      } else if (endChanged && !startChanged) {
        // Only end handle moved
        targetTime = end;
      } else if (startChanged && endChanged) {
        // Both handles moved (this can happen during initialization or programmatic changes)
        // Determine which changed more
        const startDiff = Math.abs(start - prevStart);
        const endDiff = Math.abs(end - prevEnd);
        
        if (endDiff > startDiff) {
          targetTime = end;
        } else {
          targetTime = start;
        }
      }
      
      if (targetTime !== null) {
        // Set flag to prevent time update handler from interfering
        isManualSeekingRef.current = true;
        
        // Pause the video before seeking
        videoRef.current.pause();
        setIsPlaying(false);
        
        // Seek to the target time
        videoRef.current.currentTime = targetTime;
        
        // Reset the flag after a short delay
        setTimeout(() => {
          isManualSeekingRef.current = false;
        }, 100);
      }
    }

    // Update the refs and state
    prevTrimRangeRef.current = values;
    setTrimRange(values);
  }, [videoDuration, recordedDuration]);

  // Add video time update handler
  const handleTimeUpdate = useCallback((): void => {
    // Don't interfere if we're manually seeking
    if (isManualSeekingRef.current) {
      return;
    }
    
    if (videoRef.current && videoRef.current.currentTime >= trimRange[1]) {
      videoRef.current.currentTime = trimRange[0]
      // Access isPlaying from state directly to control pause behavior
      if (!isPlaying) {
        videoRef.current.pause()
      }
    }
  }, [trimRange, isPlaying]);

  // Update video element event listeners
  useEffect(() => {
    const video = videoRef.current
    if (video) {
      video.addEventListener('loadedmetadata', handleVideoMetadata)
      video.addEventListener('timeupdate', handleTimeUpdate)
      return () => {
        video.removeEventListener('loadedmetadata', handleVideoMetadata)
        video.removeEventListener('timeupdate', handleTimeUpdate)
      }
    }
  }, [trimRange, isPlaying, handleVideoMetadata, handleTimeUpdate])

  // Handle videoUrl changes - use source element approach for Safari iOS compatibility
  useEffect(() => {
    if (videoUrl && videoRef.current && !gifUrl) {
      // Only auto-set video source if we're not in GIF mode
      // When returning from GIF mode, backToEditor handles the restoration
      setVideoSource(videoUrl);
    }
  }, [videoUrl, setVideoSource, gifUrl])

  const startPreview = async (): Promise<void> => {
    setShowWelcomeGif(false)
    event({
      action: ANALYTICS_EVENTS.SHOW_PREVIEW,
      category: 'Camera',
      label: 'Start Camera Preview',
    });
    if (!hasCameraPermission) {
      const success = await initializeCamera();
      if (!success) return;
    }
    try {
      // Clear previous recording states if they exist
      if (videoUrl) {
        URL.revokeObjectURL(videoUrl)
      }
      if (gifUrl) {
        URL.revokeObjectURL(gifUrl)
        setGifUrl("")
      }
      setVideoUrl("")
      setRecordedChunks([])
      setTextOverlay("")
      setTextOverlays([])
      setSelectedOverlay(null)
      setEditingOverlay(null)
      _setStartTime(0)
      _setEndTime(10)

      // Start camera preview
      const constraints = {
        video: {
          facingMode: "user",
          width: { ideal: 1280 },
          height: { ideal: 720 },
          aspectRatio: { ideal: 16/9 }
        }
      }
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }
      setIsPreviewMode(true)
    } catch {
      alert("Failed to start recording. Please try again.")
      // Cleanup on error
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
        streamRef.current = null
      }
    }
  }

  const _stopPreview = (): void => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    setIsPreviewMode(false)
  }

  const initiateRecording = async (): Promise<void> => {
    setShowWelcomeGif(false)
    event({
      action: ANALYTICS_EVENTS.START_RECORDING,
      category: 'Recording',
      label: 'Start Recording',
    });
    if (!hasCameraPermission) {
      const success = await initializeCamera();
      if (!success) return;
    }
    // If there's an existing video, reload the page instead of starting a new recording
    if (videoUrl) {
      window.location.href = '/'
      return
    }

    try {
      // If we're already in preview mode, use the existing stream
      if (!isPreviewMode) {
        // Clear previous recording states if they exist
        if (videoUrl) {
          URL.revokeObjectURL(videoUrl)
        }
        if (gifUrl) {
          URL.revokeObjectURL(gifUrl)
          setGifUrl("")
        }
        setVideoUrl("")
        setRecordedChunks([])
        setTextOverlay("")
        setTextOverlays([])
        setSelectedOverlay(null)
        setEditingOverlay(null)
        _setStartTime(0)
        _setEndTime(10)

        // Start camera preview immediately
        const constraints = {
          video: {
            facingMode: "user",
            width: { ideal: 1280 },
            height: { ideal: 720 },
            aspectRatio: { ideal: 16/9 }
          }
        }
        
        const stream = await navigator.mediaDevices.getUserMedia(constraints)
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
        }
      }

      // Start countdown
      setStartCountdown(3)
      const countdownInterval = setInterval(() => {
        setStartCountdown(prev => {
          if (prev === null || prev <= 1) {
            clearInterval(countdownInterval)
            if (prev === 1) {
              startRecording(streamRef.current!)
            }
            return null
          }
          return prev - 1
        })
      }, 1000)
    } catch {
      alert("Failed to start recording. Please try again.")
      // Cleanup on error
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
        streamRef.current = null
      }
    }
  }

  const startRecording = async (stream: MediaStream): Promise<void> => {
    try {
      // Create canvas stream that matches the preview aspect ratio
      const recordingStream = createCanvasStream() || stream;
      
      const mediaRecorder = new MediaRecorder(recordingStream)
      mediaRecorderRef.current = mediaRecorder
      const chunks: Blob[] = []

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data)
        }
      }

      mediaRecorder.onstop = () => {
        // Calculate duration using countdown-based logic (primary method)
        const finalCountdown = currentCountdownRef.current;
        
        // Backup calculation using state countdown if ref is invalid
        const backupCountdown = countdown;
        
        // Use ref first, then fall back to state
        const countdownToUse = (typeof finalCountdown === 'number' && finalCountdown >= 0) ? finalCountdown : backupCountdown;
        
        const actualRecordedDuration = countdownToUse <= 0 ? 10 : 10 - countdownToUse;
        
        // Ensure duration is never more than 10 seconds and at least 0.1 seconds
        const validDuration = Math.max(0.1, Math.min(actualRecordedDuration, 10));
        
        // Track recording duration
        trackRecordingDuration(validDuration);
        
        // Pass the calculated duration directly to handleDataAvailable
        handleDataAvailable(chunks, validDuration)
        

        
        // Stop all tracks and revoke camera access
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop())
          streamRef.current = null
        }
        if (videoRef.current) {
          videoRef.current.srcObject = null
        }
      }

      // Request data every second for more accurate recording
      mediaRecorder.start(1000)
      setIsRecording(true)
      setCountdown(10)
      currentCountdownRef.current = 10 // Initialize countdown ref

      // Start countdown timer
      let timeLeft = 10
      countdownIntervalRef.current = setInterval(() => {
        timeLeft -= 1
        setCountdown(timeLeft)
        currentCountdownRef.current = timeLeft; // Update the ref with current countdown
        
        if (timeLeft <= 0) {
          clearInterval(countdownIntervalRef.current!)
          currentCountdownRef.current = 0; // Ensure it's exactly 0 when timer expires
          // Recording will auto-stop and duration will be calculated in onstop
          stopRecording()
        }
      }, 1000)

      // Ensure recording stops after exactly 10 seconds
      setTimeout(() => {
        if (isRecording) {
          stopRecording()
        }
      }, 10000)
    } catch {
      alert("Failed to start recording. Please try again.")
      // Cleanup on error
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
        streamRef.current = null
      }
    }
  }

  const handleTextDragStart = (e: React.PointerEvent, overlayId: string): void => {
    e.preventDefault();
    e.stopPropagation();
    
    const overlay = textOverlays.find(o => o.id === overlayId);
    if (!overlay) return;

    setIsDragging(true);
    setDraggedOverlayId(overlayId);
    setSelectedOverlay(overlayId);
    
    // Capture the pointer to this element
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);
    
    // Use the video element bounds instead of container bounds for perfect alignment
    if (!videoRef.current) return;
    const rect = videoRef.current.getBoundingClientRect();

    const handleDrag = (moveEvent: PointerEvent): void => {
      moveEvent.preventDefault();
      
      const x = ((moveEvent.clientX - rect.left) / rect.width) * 100;
      const y = ((moveEvent.clientY - rect.top) / rect.height) * 100;
      
      // Allow text to go to the very edges of the video boundaries
      // Text uses translate(-50%, -50%) so center point can be at edges
      // and the text will extend slightly beyond, which is expected behavior
      const padding = 0; // Removed padding to allow text to reach edges
      
      setTextOverlays(prev => prev.map(o => 
        o.id === overlayId 
          ? { 
              ...o, 
              x: Math.max(padding, Math.min(100 - padding, x)), 
              y: Math.max(padding, Math.min(100 - padding, y)) 
            }
          : o
      ));
    };

    const handleDragEnd = (endEvent: PointerEvent): void => {
      endEvent.preventDefault();
      setIsDragging(false);
      setDraggedOverlayId(null);
      
      // Release pointer capture
      const target = endEvent.currentTarget as HTMLElement;
      if (target) {
        target.releasePointerCapture(endEvent.pointerId);
      }
      
      target.removeEventListener('pointermove', handleDrag);
      target.removeEventListener('pointerup', handleDragEnd);
      target.removeEventListener('pointercancel', handleDragEnd);
    };

    // Add pointer event listeners to the target element
    target.addEventListener('pointermove', handleDrag);
    target.addEventListener('pointerup', handleDragEnd);
    target.addEventListener('pointercancel', handleDragEnd);
  };

  // Legacy drag handler for backward compatibility
  const handleLegacyTextDragStart = (e: React.PointerEvent): void => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!textPreviewRef.current || !videoRef.current) return
    setIsDragging(true)
    
    // Capture the pointer to this element
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);
    
    // Use the video element bounds instead of container bounds for perfect alignment
    const rect = videoRef.current.getBoundingClientRect()

    const handleDrag = (moveEvent: PointerEvent): void => {
      moveEvent.preventDefault();
      
      const x = ((moveEvent.clientX - rect.left) / rect.width) * 100
      const y = ((moveEvent.clientY - rect.top) / rect.height) * 100
      
      // Allow text to go to the very edges of the video boundaries
      // Text uses translate(-50%, -50%) so center point can be at edges
      // and the text will extend slightly beyond, which is expected behavior
      const padding = 0; // Removed padding to allow text to reach edges
      
      setTextPosition({
        x: Math.max(padding, Math.min(100 - padding, x)),
        y: Math.max(padding, Math.min(100 - padding, y))
      })
    }

    const handleDragEnd = (endEvent: PointerEvent): void => {
      endEvent.preventDefault();
      setIsDragging(false)
      
      // Release pointer capture
      const target = endEvent.currentTarget as HTMLElement;
      if (target) {
        target.releasePointerCapture(endEvent.pointerId);
      }
      
      target.removeEventListener('pointermove', handleDrag)
      target.removeEventListener('pointerup', handleDragEnd)
      target.removeEventListener('pointercancel', handleDragEnd)
    }

    // Add pointer event listeners to the target element
    target.addEventListener('pointermove', handleDrag)
    target.addEventListener('pointerup', handleDragEnd)
    target.addEventListener('pointercancel', handleDragEnd)
  }

  const convertToGif = async (): Promise<void> => {
    if (!recordedChunks.length || !ffmpeg) return

    event({
      action: ANALYTICS_EVENTS.CONVERT_TO_GIF,
      category: 'Conversion',
      label: 'Start GIF Conversion',
    });

    try {
      setIsConverting(true)
      setConversionProgress(0)
      
      const { fetchFile } = await import("@ffmpeg/util")
      
      setConversionProgress(10)
      const inputBlob = new Blob(recordedChunks, { type: "video/webm" })
      const inputBuffer = await fetchFile(inputBlob)
      const inputFileName = "input.webm"
      const outputFileName = "output.gif"

      try {
        await ffmpeg.writeFile(inputFileName, inputBuffer)
      } catch (error) {
        console.error('❌ Failed to write input file:', error);
        throw new Error('Failed to write input video file')
      }

      setConversionProgress(30)
      
      // Load fonts needed by text overlays
      
      // Collect all unique fonts used in overlays
      const allTextOverlays = [...textOverlays];
      if (textOverlay && allTextOverlays.length === 0) {
        allTextOverlays.push({
          id: 'legacy',
          text: textOverlay,
          x: textPosition.x,
          y: textPosition.y,
          fontSize: _fontSize,
          fontFamily: 'Impact', // Default for legacy
          fontColor: '#ffffff',
          backgroundColor: '#000000',
          backgroundOpacity: 0.5,
          showBackground: true,
        });
      }
      
      const fontsNeeded = new Set(allTextOverlays.map(overlay => overlay.fontFamily));
      
      let _fontsLoaded = 0;
      for (const fontFamily of fontsNeeded) {
        const fontInfo = fontFamilies.find(f => f.value === fontFamily);
        if (!fontInfo) {
          console.warn(`⚠️ Font not found: ${fontFamily}`);
          continue;
        }
        
        try {
          // Try to load local font first
          const fontResponse = await fetch(`/gif-new/fonts/${fontInfo.file}`);
          if (fontResponse.ok) {
            const fontArrayBuffer = await fontResponse.arrayBuffer();
            await ffmpeg.writeFile(fontInfo.file, new Uint8Array(fontArrayBuffer));
            _fontsLoaded++;
          } else {
            console.warn(`⚠️ Local ${fontInfo.name} font not found`);
          }
        } catch (e) {
          console.warn(`⚠️ ${fontInfo.name} font loading failed:`, e);
        }
      }
      
      setConversionProgress(50)
      
      try {
        // First, convert video to proper format
        // Check if we need to trim (either marked as trimmed or has trim range)
        const shouldTrim = hasBeenTrimmed || (trimRange[0] > 0 || trimRange[1] < videoDuration);
        
        if (shouldTrim) {
          // Apply trimming using the trim range
          await ffmpeg.exec([
            '-i', inputFileName,
            '-ss', trimRange[0].toString(),
            '-t', (trimRange[1] - trimRange[0]).toString(),
            '-vf', 'fps=15,scale=640:-1:flags=lanczos',
            '-y',
            'temp.mp4'
          ])
        } else {
          // No trimming needed
          await ffmpeg.exec([
            '-i', inputFileName,
            '-vf', 'fps=15,scale=640:-1:flags=lanczos',
            '-y',
            'temp.mp4'
          ])
        }

        // Verify temp.mp4 was created
        const tempFiles = await ffmpeg.listDir('/')
        if (!tempFiles.find(f => f.name === 'temp.mp4')) {
          throw new Error('Failed to create temporary video file')
        }

        setConversionProgress(70)
        
        // Apply text overlays if any exist
        const allTextOverlays = [...textOverlays];
        
        // Add legacy text overlay if exists and no new overlays
        if (textOverlay && allTextOverlays.length === 0) {
          allTextOverlays.push({
            id: 'legacy',
            text: textOverlay,
            x: textPosition.x,
            y: textPosition.y,
            fontSize: _fontSize,
            fontFamily: 'Impact', // Default for legacy
            fontColor: '#ffffff',
            backgroundColor: '#000000',
            backgroundOpacity: 0.5,
            showBackground: true,
          });
        }

        let currentInput = 'temp.mp4';
        
        if (allTextOverlays.length > 0) {
          // Check if font files exist
          const filesBeforeText = await ffmpeg.listDir('/');
          
          for (let i = 0; i < allTextOverlays.length; i++) {
            const overlay = allTextOverlays[i];
            
            // Get the font file for this overlay
            const fontInfo = fontFamilies.find(f => f.value === overlay.fontFamily);
            const fontFile = fontInfo ? fontInfo.file : 'arial.ttf'; // Fallback to arial
            
            // Check if the specific font file exists
            const hasFontFile = filesBeforeText.find(f => f.name === fontFile);
            
            if (!hasFontFile) {
              console.warn(`⚠️ Font file ${fontFile} not found for ${overlay.fontFamily}, skipping overlay`);
              continue;
            }
            
            // Escape text properly for FFmpeg
            const safeText = overlay.text.replace(/'/g, "\\'").replace(/"/g, '\\"').replace(/[\n\r]/g, ' ');
            const outputFile = i === allTextOverlays.length - 1 ? 'temp_with_text.mp4' : `temp_text_${i}.mp4`;
            
            // Build drawtext filter using the correct font file
            // Adjust coordinates to match preview centering (translate(-50%, -50%))
            // FFmpeg positions text by top-left corner, but preview centers it
            // We need to offset by half the text width/height to match preview positioning
            let drawTextFilter = `drawtext=fontfile=/${fontFile}:text='${safeText}':x=(${overlay.x}*W/100-text_w/2):y=(${overlay.y}*H/100-text_h/2):fontsize=${overlay.fontSize}:fontcolor=${overlay.fontColor.replace('#', '')}`;
            
            // Add background box if enabled
            if (overlay.showBackground) {
              const backgroundColorHex = overlay.backgroundColor.replace('#', '');
              drawTextFilter += `:box=1:boxcolor=${backgroundColorHex}@${overlay.backgroundOpacity}:boxborderw=5`;
            }
            
            try {
              await ffmpeg.exec([
                '-i', currentInput,
                '-vf', drawTextFilter,
                '-y',
                outputFile
              ]);
              
              currentInput = outputFile;
              
            } catch (textError) {
              console.error(`❌ Failed to apply text overlay ${i + 1}:`, textError);
              throw new Error(`Text overlay ${i + 1} failed: ${textError}`);
            }
          }
        }

        setConversionProgress(85)
        
        // Two-pass palette generation and application
        try {
          await ffmpeg.exec([
            '-i', currentInput,
            '-vf', 'palettegen=max_colors=256',
            '-y',
            'palette.png'
          ])
          
          // Verify palette was created
          const paletteFiles = await ffmpeg.listDir('/');
          if (!paletteFiles.find(f => f.name === 'palette.png')) {
            throw new Error('Palette generation failed');
          }

          await ffmpeg.exec([
            '-i', currentInput,
            '-i', 'palette.png',
            '-lavfi', 'paletteuse=dither=sierra2_4a',
            '-loop', '0',
            '-y',
            outputFileName
          ])
          
        } catch (paletteError) {
          console.error('❌ Palette generation/application failed:', paletteError);
          
          // Fallback: simple GIF conversion
          await ffmpeg.exec([
            '-i', currentInput,
            '-f', 'gif',
            '-y',
            outputFileName
          ]);
        }

        setConversionProgress(90)
        
        // Verify output file exists
        const finalFiles = await ffmpeg.listDir('/')
        
        const outputFile = finalFiles.find(f => f.name === outputFileName);
        if (!outputFile) {
          console.error('❌ Output GIF file was not created');
          throw new Error('Output GIF file was not created')
        }

        const outputData = await ffmpeg.readFile(outputFileName)
        
        const gifBlob = new Blob([outputData], { type: "image/gif" })
        const gifUrl = URL.createObjectURL(gifBlob)
        setGifUrl(gifUrl)
        
        setConversionProgress(100)
        trackGIFConversion(true);
        
      } catch (error: unknown) {
        console.error('❌ FFmpeg processing error:', error);
        
        // List all files in the virtual filesystem for debugging
        try {
          const _debugFiles = await ffmpeg.listDir('/')
        } catch (listError) {
          console.error('❌ Error listing files for debug:', listError);
        }
        
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        throw new Error(`FFmpeg processing failed: ${errorMessage}`)
      }
    } catch (error) {
      console.error('🚨 Overall conversion error:', error);
      trackGIFConversion(false, error instanceof Error ? error.message : 'Unknown error');
      alert("Failed to convert to GIF. Please try again. Error: " + (error instanceof Error ? error.message : 'Unknown error'))
    } finally {
      setIsConverting(false)
      setConversionProgress(0)
    }
  }

  const _resetToVideo = async (): Promise<void> => {
    
    // Only clear the GIF URL, preserving video and edit states
    setGifUrl("")
    
    // Log FFmpeg filesystem state
    try {
      if (ffmpeg) {
        await ffmpeg.listDir('/')
      }
    } catch {
      // Error checking FFmpeg files
    }
    
    // Ensure video source is set back to the recorded video
    if (videoRef.current && videoUrl) {
      
      setVideoSource(videoUrl) // Use our source element approach
      
      // Play the video from the start
      videoRef.current.currentTime = 0
      try {
        await videoRef.current.play()
      } catch {
        // Auto-play prevented
      }

      // Add an event listener to check when video is loaded
      videoRef.current.onloadeddata = (): void => {}

      videoRef.current.onerror = (): void => {
        // Error loading video
      }
    }

  }

  // Add logging to video element events
  useEffect(() => {
    const videoElement = videoRef.current
    if (!videoElement) return

    const logVideoState = (_event: string): void => {}

    videoElement.onplay = (): void => logVideoState('play')
    videoElement.onpause = (): void => logVideoState('pause')
    videoElement.onloadeddata = (): void => logVideoState('loadeddata')
    videoElement.onloadedmetadata = (): void => logVideoState('loadedmetadata')
    videoElement.onerror = (): void => {
      // Video error
    }

    return (): void => {
      videoElement.onplay = null
      videoElement.onpause = null
      videoElement.onloadeddata = null
      videoElement.onloadedmetadata = null
      videoElement.onerror = null
    }
  }, [videoUrl, recordedDuration, videoDuration]) // Re-attach listeners when video URL changes

  // Effect to handle video source when URL changes is now handled by the other useEffect with setVideoSource

  const _handleTimeRangeChange = (values: number[]): void => {
    _setStartTime(values[0])
    _setEndTime(values[1])
  }

  const downloadGif = (): void => {
    if (!gifUrl) return
    
    event({
      action: ANALYTICS_EVENTS.DOWNLOAD_GIF,
      category: 'Download',
      label: 'Download GIF',
    });
    
    // Generate a random ID for the filename
    const randomId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
    
    // Create a temporary anchor element
    const link = document.createElement('a')
    link.href = gifUrl
    link.download = `gif-new-${randomId}.gif` // Set the download filename with random ID
    
    // Programmatically click the link to trigger download
    document.body.appendChild(link)
    link.click()
    
    // Clean up
    document.body.removeChild(link)
  }

  const backToEditor = (): void => {
    // Clear the GIF URL to return to video editing mode
    if (gifUrl) {
      URL.revokeObjectURL(gifUrl)
      setGifUrl("")
    }

    
    // Ensure video is ready for editing by properly restoring video source
    if (videoRef.current && videoUrl) {
      // Force a complete reload by clearing and resetting the video source
      videoRef.current.innerHTML = ''; // Clear everything first
      
      // Use a slight delay to ensure the clearing takes effect
      setTimeout(() => {
        if (videoRef.current && videoUrl) {
          setVideoSource(videoUrl); // Restore the video source (trimmed if it was trimmed)
          
          // Add event listener to ensure video loads properly
          const handleLoadedData = (): void => {
            if (videoRef.current) {
              videoRef.current.currentTime = 0;
              videoRef.current.removeEventListener('loadeddata', handleLoadedData);
            }
          };
          
          videoRef.current.addEventListener('loadeddata', handleLoadedData);
          
          // Fallback timeout in case loadeddata doesn't fire
          setTimeout(() => {
            if (videoRef.current) {
              videoRef.current.currentTime = 0;
              videoRef.current.removeEventListener('loadeddata', handleLoadedData);
            }
          }, 500);
        }
      }, 50);
    }
    
    // Force font reload to ensure text overlays display correctly
    if (textOverlays.length > 0) {
      setFontsLoaded(false);
      setTimeout(() => {
        setFontsLoaded(true);
      }, 300);
    }
  }

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const enterTrimMode = (): void => {
    event({
      action: ANALYTICS_EVENTS.TRIM_VIDEO,
      category: 'Video Editing',
      label: 'Enter Trim Mode',
    });

    if (!videoRef.current) {
      return;
    }

    // Always prioritize countdown-based recorded duration
    let durationToUse = recordedDuration;
    
    // Only fall back to videoDuration if recordedDuration is not available
    if (durationToUse <= 0) {
      durationToUse = videoDuration;
    }
    
    // Last resort: try to get duration from video metadata
    if (durationToUse <= 0) {
      const metadataDuration = videoRef.current.duration;
      if (isFinite(metadataDuration) && metadataDuration > 0) {
        durationToUse = metadataDuration;
        setVideoDuration(metadataDuration);
        setRecordedDuration(metadataDuration);
      }
    }
    
    if (durationToUse > 0) {
      // Ensure videoDuration matches our duration source
      if (videoDuration !== durationToUse) {
        setVideoDuration(durationToUse);
      }
      
      const initialRange = [0, durationToUse];
      setTrimRange(initialRange);
      prevTrimRangeRef.current = initialRange;
      setIsTrimMode(true);
      // Ensure video is paused when entering trim mode
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      // If no duration is available, force a reload and set trim mode
      videoRef.current.load();
      videoRef.current.currentTime = 0;
      setIsTrimMode(true);
    }
  };

  const undoTrim = (): void => {
    event({
      action: ANALYTICS_EVENTS.UNDO_TRIM,
      category: 'Video Editing',
      label: 'Undo Video Trim',
    });

    if (originalVideoUrl && originalChunks.length > 0) {
      // Restore original video
      setVideoUrl(originalVideoUrl)
      setRecordedChunks(originalChunks)
      setHasBeenTrimmed(false)
      
      // Restore original video duration and related states
      if (originalVideoDuration > 0) {
        setVideoDuration(originalVideoDuration)
        setRecordedDuration(originalVideoDuration)
        setTrimRange([0, originalVideoDuration])
        prevTrimRangeRef.current = [0, originalVideoDuration]
      }
      
      // Force video element to reload with original source using our setVideoSource approach
      setTimeout(() => {
        if (videoRef.current && originalVideoUrl) {
          setVideoSource(originalVideoUrl)
          videoRef.current.currentTime = 0
        }
      }, 0)
    }
  }

  const exitTrimMode = async (): Promise<void> => {
    if (!videoRef.current || trimRange[0] === 0 && trimRange[1] === videoDuration) {
      // If no trimming was done, just exit trim mode
      setIsTrimMode(false);
      setIsPlaying(false);
      if (videoRef.current) {
        videoRef.current.pause();
      }
      return;
    }

    event({
      action: ANALYTICS_EVENTS.TRIM_DONE,
      category: 'Video Editing',
      label: 'Complete Video Trim',
    });

    setIsTrimProcessing(true);

    try {
      // Calculate the new trimmed duration
      const newTrimmedDuration = trimRange[1] - trimRange[0];
      
      // Check if captureStream is available (may not work on some mobile browsers)
      if (typeof videoRef.current.captureStream !== 'function') {
        throw new Error('captureStream not supported on this device');
      }
      
      // Create a new MediaRecorder to capture the trimmed portion
      const stream = videoRef.current.captureStream();
      
      // Check if MediaRecorder is supported
      if (!window.MediaRecorder || !MediaRecorder.isTypeSupported('video/webm')) {
        throw new Error('MediaRecorder not supported on this device');
      }
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'video/webm'
      });
      
      const chunks: Blob[] = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/mp4' }); // Use mp4 for consistency
        const newUrl = URL.createObjectURL(blob);
        
        // Clean up previous video URL if it exists
        if (videoUrl && videoUrl !== originalVideoUrl) {
          URL.revokeObjectURL(videoUrl);
        }
        
        setVideoUrl(newUrl);
        setRecordedChunks(chunks);
        setHasBeenTrimmed(true);
        setIsTrimMode(false);
        setIsPlaying(false);
        setIsTrimProcessing(false);
        
        // Set the new duration for the trimmed video
        setVideoDuration(newTrimmedDuration);
        setRecordedDuration(newTrimmedDuration);
        setTrimRange([0, newTrimmedDuration]);
        prevTrimRangeRef.current = [0, newTrimmedDuration];
      };

      mediaRecorder.onerror = (event) => {
        console.error('MediaRecorder error:', event);
        throw new Error('Recording failed');
      };

      // Start recording
      mediaRecorder.start();
      videoRef.current.currentTime = trimRange[0];
      await videoRef.current.play();

      // Stop recording when we reach the end time
      const checkTime = (): void => {
        if (videoRef.current && videoRef.current.currentTime >= trimRange[1]) {
          videoRef.current.pause();
          mediaRecorder.stop();
          stream.getTracks().forEach((track: MediaStreamTrack) => track.stop());
        } else {
          requestAnimationFrame(checkTime);
        }
      };
      requestAnimationFrame(checkTime);
    } catch (error) {
      console.error('Trim operation failed:', error);
      
      // Fallback for mobile: Use simple range-based trimming without re-recording
      // This will just update the trim range and mark as trimmed
      const newTrimmedDuration = trimRange[1] - trimRange[0];
      
      setHasBeenTrimmed(true);
      setIsTrimMode(false);
      setIsPlaying(false);
      setIsTrimProcessing(false);
      
      // Set the new duration for the trimmed video (conceptual trimming)
      setVideoDuration(newTrimmedDuration);
      setRecordedDuration(newTrimmedDuration);
      
      // Keep the current video URL but mark it as trimmed
      // The actual trimming will be handled during GIF conversion
      
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.currentTime = trimRange[0];
      }
    }
  };

  const stopRecording = (): void => {
    event({
      action: ANALYTICS_EVENTS.STOP_RECORDING,
      category: 'Recording',
      label: 'Stop Recording',
    });
    
    // Clear countdown interval
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current)
      countdownIntervalRef.current = null
    }

    // Stop recording if active - this will trigger mediaRecorder.onstop
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      mediaRecorderRef.current = null
    }

    // Stop camera access
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }

    // Reset states
    setIsRecording(false)
    setCountdown(10)
  }

  if (!isInitialized) {
    return (
      <div className="mx-auto max-w-[640px] w-full px-4">
        <div className="space-y-6">
          <div className="text-center space-y-2 mb-8">
            <h1 className="text-4xl font-bold">GIF.new</h1>
            <p className="text-muted-foreground">Instantly capture and create personal response GIFs.</p>
          </div>
          <div className="relative aspect-video rounded-lg overflow-hidden bg-muted animate-pulse">
            <div className="absolute inset-0 bg-gradient-to-r from-gray-200 to-gray-300">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-gray-400">
                  <Eye className="w-12 h-12 mb-2 mx-auto" />
                  <p className="text-center">
                    {loadingError ? (
                      <span className="text-red-500">{loadingError}</span>
                    ) : (
                      "Loading application..."
                    )}
                  </p>
                  {loadingError && (
                    <button
                      onClick={() => {
                        setRetryCount(0);
                        setLoadingError(null);
                        setIsInitialized(false);
                      }}
                      className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                    >
                      Retry
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 sm:gap-4 justify-end">
            <div className="flex-1 sm:flex-none sm:w-32 h-10 bg-gray-200 rounded animate-pulse" />
            <div className="flex-1 sm:flex-none sm:w-36 h-10 bg-gray-200 rounded animate-pulse" />
          </div>
        </div>
      </div>
    )
  }

  // Show landscape prompt instead of video area on mobile portrait
  if (isMobileDevice() && !isLandscape) {
    return (
      <div className="mx-auto max-w-[640px] w-full px-4">
        <div className="space-y-6">
          <div className="text-center space-y-2 mb-8">
            <h1 className="text-4xl font-bold">GIF.new</h1>
            <p className="text-muted-foreground">Instantly capture and create personal response GIFs.</p>
          </div>
          <div className="relative aspect-video rounded-lg overflow-hidden bg-muted flex items-center justify-center">
            <div className="text-center p-6">
              <h3 className="text-xl font-semibold mb-3 text-foreground">Rotate Your Device</h3>
              <p className="text-muted-foreground">
                Please rotate your device to landscape mode to start recording videos.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[640px] w-full px-4">
      <div className="space-y-6">
        <div className="text-center space-y-2 mb-8">
          <h1 className="text-4xl font-bold">GIF.new</h1>
          <p className="text-muted-foreground">Instantly capture and create personal response GIFs.</p>
        </div>
        <div className="relative aspect-video rounded-lg overflow-hidden bg-muted">
          {gifUrl ? (
            <Image 
              src={gifUrl} 
              alt="Converted GIF" 
              fill
              className="object-cover" 
              unoptimized // GIFs need unoptimized to maintain animation
            />
          ) : showWelcomeGif && !isRecording && !isPreviewMode ? (
            <Image 
              src="/gif-new/welcome-get-started.gif" 
              alt="Welcome! Get Started" 
              fill
              className="object-cover"
              priority
              unoptimized // GIFs need unoptimized to maintain animation
            />
          ) : (
            <div 
              className={`w-full h-full ${(!videoUrl && (isPreviewMode || isRecording || startCountdown !== null)) ? 'transform scale-x-[-1]' : ''}`}
              onClick={(e) => {
                // Deselect text overlay when clicking on empty area
                if (e.target === e.currentTarget) {
                  setSelectedOverlay(null);
                }
              }}
              onKeyDown={(e) => {
                // Handle keyboard interaction for accessibility
                if (e.key === 'Escape') {
                  setSelectedOverlay(null);
                }
              }}
              role="button"
              tabIndex={0}
              aria-label="Video container. Press Escape to deselect text overlay."
            >
              <video
                ref={videoRef}
                autoPlay={!videoUrl}
                playsInline
                muted={!videoUrl}
                controls={!!videoUrl && !isTrimMode}
                className="w-full h-full object-cover"
                onLoadedMetadata={handleVideoMetadata}
                onError={(_e) => {
                  if (!videoUrl) {
                    setIsInitialized(false);
                  }
                }}
                preload="metadata"
              >
                {/* Source elements will be added dynamically via setVideoSource function */}
                <track kind="captions" srcLang="en" label="English captions" />
              </video>

            </div>
          )}
          
          {/* Video overlay layer - positioned to match video element exactly */}
          {videoRef.current && fontsLoaded && (
            <div 
              className="absolute inset-0 pointer-events-none"
              style={{
                // This ensures the overlay layer matches the video dimensions exactly
                // Since the video uses object-cover, the overlay should cover the same area
                width: '100%',
                height: '100%',
                top: 0,
                left: 0,
              }}
            >
              {/* Render new text overlay system */}
              {videoUrl && !isRecording && !gifUrl && textOverlays.map((overlay) => {
                const fontInfo = fontFamilies.find(f => f.value === overlay.fontFamily);
                const cssFontFamily = fontInfo ? fontInfo.cssFamily : overlay.fontFamily;
                
                return (
                  <div
                    key={overlay.id}
                    data-text-overlay="true"
                    className={`absolute cursor-move pointer-events-auto touch-none select-none ${isDragging && draggedOverlayId === overlay.id ? 'opacity-75' : ''} ${selectedOverlay === overlay.id ? 'ring-2 ring-blue-400' : ''}`}
                    style={{
                      left: `${overlay.x}%`,
                      top: `${overlay.y}%`,
                      transform: 'translate(-50%, -50%)',
                      fontSize: `${overlay.fontSize}px`,
                      fontFamily: cssFontFamily,
                      fontWeight: fontInfo?.name === 'Impact' || fontInfo?.name === 'Anton' ? 'bold' : 'normal',
                      color: overlay.fontColor,
                      textShadow: '2px 2px 4px rgba(0,0,0,0.5)',
                      padding: '5px',
                      backgroundColor: overlay.showBackground ? 
                        `${overlay.backgroundColor}${Math.round(overlay.backgroundOpacity * 255).toString(16).padStart(2, '0')}` : 
                        'transparent',
                      borderRadius: '4px',
                      zIndex: selectedOverlay === overlay.id ? 20 : 10,
                      minWidth: '20px',
                      minHeight: '20px',
                      opacity: fontsLoaded ? 1 : 0,
                      transition: 'opacity 0.2s ease-in-out',
                      whiteSpace: 'nowrap', // Prevent text wrapping to multiple lines
                      overflow: 'visible', // Allow text to extend beyond container bounds
                    }}
                    onPointerDown={(e) => handleTextDragStart(e, overlay.id)}
                    onDoubleClick={() => editTextOverlay(overlay)}
                    onClick={(e) => {
                      e.stopPropagation(); // Prevent deselection when clicking on text
                      setSelectedOverlay(overlay.id);
                    }}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        editTextOverlay(overlay);
                      } else if (e.key === 'Delete' || e.key === 'Backspace') {
                        e.preventDefault();
                        deleteTextOverlay(overlay.id);
                      }
                    }}
                    aria-label={`Text overlay: ${overlay.text}. Double-click to edit, press Delete to remove.`}
                  >
                    {overlay.text}
                  </div>
                );
              })}
              
              {/* Legacy text overlay for backward compatibility */}
              {videoUrl && textOverlay && !isRecording && !gifUrl && textOverlays.length === 0 && (
                <div
                  ref={textPreviewRef}
                  data-text-overlay="true"
                  className={`absolute cursor-move pointer-events-auto touch-none select-none ${isDragging ? 'opacity-75' : ''}`}
                  style={{
                    left: `${textPosition.x}%`,
                    top: `${textPosition.y}%`,
                    transform: 'translate(-50%, -50%)',
                    fontSize: `${_fontSize}px`,
                    color: 'white',
                    textShadow: '2px 2px 4px rgba(0,0,0,0.5)',
                    padding: '5px',
                    backgroundColor: 'rgba(0,0,0,0.5)',
                    borderRadius: '4px',
                    opacity: fontsLoaded ? 1 : 0,
                    transition: 'opacity 0.2s ease-in-out',
                    whiteSpace: 'nowrap', // Prevent text wrapping to multiple lines
                    overflow: 'visible', // Allow text to extend beyond container bounds
                  }}
                  onPointerDown={handleLegacyTextDragStart}
                  onClick={(e) => {
                    e.stopPropagation(); // Prevent deselection when clicking on legacy text
                  }}
                  role="button"
                  tabIndex={0}
                                      onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        // For keyboard interaction, just allow text editing instead of dragging
                        setSelectedOverlay(null);
                      }
                    }}
                  aria-label="Drag to reposition text overlay"
                >
                  {textOverlay}
                </div>
              )}
            </div>
          )}
          
          {videoUrl && !gifUrl && !isRecording && isTrimMode && videoDuration > 0 && (
            <div className="absolute bottom-0 left-0 right-0 bg-black/50 p-4 space-y-2">
              <div className="flex justify-between text-white text-sm">
                <span>{formatTime(trimRange[0])}</span>
                <span>{formatTime(trimRange[1])}</span>
              </div>
              <Slider
                min={0}
                max={videoDuration}
                step={0.1}
                value={trimRange}
                onValueChange={handleTrimRangeChange}
                className="w-full"
                disabled={isTrimProcessing}
              />
              <div className="flex justify-between items-center">
                <div className="text-white text-sm">
                  Duration: {formatTime(trimRange[1] - trimRange[0])}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={isTrimProcessing}
                    onClick={() => {
                      event({
                        action: ANALYTICS_EVENTS.TRIM_PREVIEW,
                        category: 'Video Editing',
                        label: 'Preview Trim',
                      });
                      
                      if (videoRef.current) {
                        if (isPlaying) {
                          videoRef.current.pause();
                        } else {
                          videoRef.current.currentTime = trimRange[0];
                          videoRef.current.play();
                        }
                        setIsPlaying(!isPlaying);
                      }
                    }}
                  >
                    {isPlaying ? 'Pause' : 'Preview'}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isTrimProcessing}
                    onClick={exitTrimMode}
                  >
                    {isTrimProcessing ? 'Processing...' : 'Done'}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {isTrimProcessing && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm" style={{ zIndex: 50 }}>
              <div className="w-12 h-12 border-4 border-white border-t-transparent rounded-full animate-spin mb-4"></div>
              <div className="text-white text-sm">Processing trim...</div>
            </div>
          )}

          {startCountdown !== null && (
            <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm" style={{ zIndex: 50 }}>
              <div className="w-24 h-24 flex items-center justify-center">
                <span className="text-white text-6xl font-bold animate-pulse">
                  {startCountdown}
                </span>
              </div>
            </div>
          )}
          {isConverting && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm" style={{ zIndex: 50 }}>
              <div className="w-64 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-blue-500 transition-all duration-300 ease-in-out"
                  style={{ width: `${conversionProgress}%` }}
                />
              </div>
              <div className="mt-2 text-white">Converting... {conversionProgress}%</div>
            </div>
          )}
          {isRecording && (
            <div className="absolute top-4 right-4 flex items-center gap-2 bg-red-500 text-white px-3 py-1 rounded-full text-sm font-medium">
              <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
              REC {countdown}s
            </div>
          )}

        </div>

        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4 sm:gap-0">
            <div className="flex flex-wrap gap-2 sm:gap-4 justify-start">
              {gifUrl && (
                <Button 
                  onClick={backToEditor} 
                  variant="outline" 
                  className="flex-1 sm:flex-none"
                  disabled={isTrimProcessing}
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  <span className="sm:inline">Back to Editor</span>
                </Button>
              )}
              {videoUrl && !gifUrl && !isTrimMode && !isRecording && (
                <>
                  {!hasBeenTrimmed && (
                    <Button 
                      onClick={enterTrimMode} 
                      variant="outline" 
                      className="flex-1 sm:flex-none"
                      disabled={isTrimProcessing}
                    >
                      <Scissors className="mr-2 h-4 w-4" />
                      <span className="sm:inline">Trim Video</span>
                    </Button>
                  )}
                  {hasBeenTrimmed && (
                    <Button 
                      onClick={undoTrim} 
                      variant="outline" 
                      className="flex-1 sm:flex-none"
                      disabled={isTrimProcessing}
                    >
                      <Undo className="mr-2 h-4 w-4" />
                      <span className="sm:inline">Undo Trim</span>
                    </Button>
                  )}
                  <Button 
                    onClick={addTextOverlay} 
                    variant="outline" 
                    className="flex-1 sm:flex-none"
                    disabled={isTrimProcessing}
                  >
                    <Type className="mr-2 h-4 w-4" />
                    <span className="sm:inline">Add Text</span>
                  </Button>
                </>
              )}
            </div>

            <div className="flex flex-wrap gap-2 sm:gap-4 justify-end">
              {/* Right-side buttons */}
              {!videoUrl && !isPreviewMode && !isRecording && startCountdown === null && (
                <Button
                  onClick={startPreview}
                  variant="secondary"
                  className="flex-1 sm:flex-none"
                  disabled={isTrimProcessing}
                >
                  <Eye className="mr-2 h-4 w-4" />
                  <span className="sm:inline">Show Preview</span>
                </Button>
              )}
              <Button
                onClick={isRecording ? stopRecording : isPreviewMode ? initiateRecording : initiateRecording}
                variant={isRecording ? "destructive" : (!videoUrl ? "default" : "secondary")}
                disabled={startCountdown !== null || isTrimProcessing}
                className="flex-1 sm:flex-none"
              >
                {isRecording ? (
                  <>
                    <Video className="mr-2 h-4 w-4" />
                    <span className="sm:inline">Stop Recording</span>
                  </>
                ) : videoUrl ? (
                  <>
                    <RotateCcw className="mr-2 h-4 w-4" />
                    <span className="sm:inline">Start Over</span>
                  </>
                ) : (
                  <>
                    <Video className="mr-2 h-4 w-4" />
                    <span className="sm:inline">Start Recording</span>
                  </>
                )}
              </Button>
              {videoUrl && !gifUrl && !isTrimMode && !isRecording && (
                <Button 
                  onClick={convertToGif} 
                  variant="default" 
                  disabled={isConverting || isTrimProcessing}
                  className="flex-1 sm:flex-none"
                >
                  <ImagePlay className="mr-2 h-4 w-4" />
                  <span className="sm:inline">Convert to GIF</span>
                </Button>
              )}
              {gifUrl && (
                <Button 
                  onClick={downloadGif} 
                  variant="default"
                  disabled={isTrimProcessing}
                  className="flex-1 sm:flex-none"
                >
                  <Download className="mr-2 h-4 w-4" />
                  <span className="sm:inline">Download GIF</span>
                </Button>
              )}
            </div>
          </div>
        </div>

        <Dialog open={isTextDialogOpen} onOpenChange={setIsTextDialogOpen}>
          <CustomDialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingOverlay?.id && textOverlays.find(o => o.id === editingOverlay.id) ? 'Edit Text Overlay' : 'Add Text Overlay'}
              </DialogTitle>
              <DialogDescription>
                Customize your text overlay. You can drag the text to reposition it after adding.
              </DialogDescription>
            </DialogHeader>
            {editingOverlay && (
              <div className="space-y-4">
                {/* Text Input */}
                <div className="space-y-2">
                  <label htmlFor="text-input" className="text-sm font-medium">Text</label>
                  <input
                    id="text-input"
                    type="text"
                    value={editingOverlay.text}
                    onChange={(e) => setEditingOverlay(prev => prev ? { ...prev, text: e.target.value } : null)}
                    className="w-full px-3 py-2 border rounded-md"
                    placeholder="Enter your text..."
                  />
                </div>

                {/* Font Family */}
                <div className="space-y-2">
                  <label htmlFor="font-family" className="text-sm font-medium">Font Family</label>
                  <select
                    id="font-family"
                    value={editingOverlay.fontFamily}
                    onChange={(e) => setEditingOverlay(prev => prev ? { ...prev, fontFamily: e.target.value } : null)}
                    className="w-full px-3 py-2 border rounded-md"
                  >
                    {fontFamilies.map(font => (
                      <option key={font.value} value={font.value}>{font.name}</option>
                    ))}
                  </select>
                </div>

                {/* Font Size */}
                <div className="space-y-2">
                  <label htmlFor="font-size" className="text-sm font-medium">Font Size</label>
                  <Slider
                    min={12}
                    max={120}
                    step={1}
                    value={[editingOverlay.fontSize]}
                    onValueChange={(value) => setEditingOverlay(prev => prev ? { ...prev, fontSize: value[0] } : null)}
                  />
                  <span className="text-sm text-gray-500">{editingOverlay.fontSize}px</span>
                </div>

                {/* Font Color */}
                <div className="space-y-2">
                  <label htmlFor="font-color" className="text-sm font-medium">Font Color</label>
                  <ColorPicker
                    value={editingOverlay.fontColor}
                    onChange={(color) => setEditingOverlay(prev => prev ? { ...prev, fontColor: color } : null)}
                    placeholder="#ffffff"
                  />
                </div>

                {/* Background Options */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="showBackground"
                      checked={editingOverlay.showBackground}
                      onChange={(e) => setEditingOverlay(prev => prev ? { ...prev, showBackground: e.target.checked } : null)}
                      className="rounded"
                    />
                    <label htmlFor="showBackground" className="text-sm font-medium">Show Background</label>
                  </div>

                  {editingOverlay.showBackground && (
                    <>
                      {/* Background Color */}
                      <div className="space-y-2">
                        <label htmlFor="background-color" className="text-sm font-medium">Background Color</label>
                        <ColorPicker
                          value={editingOverlay.backgroundColor}
                          onChange={(color) => setEditingOverlay(prev => prev ? { ...prev, backgroundColor: color } : null)}
                          placeholder="#000000"
                        />
                      </div>

                      {/* Background Opacity */}
                      <div className="space-y-2">
                        <label htmlFor="background-opacity" className="text-sm font-medium">Background Opacity</label>
                        <Slider
                          min={0}
                          max={1}
                          step={0.1}
                          value={[editingOverlay.backgroundOpacity]}
                          onValueChange={(value) => setEditingOverlay(prev => prev ? { ...prev, backgroundOpacity: value[0] } : null)}
                        />
                        <span className="text-sm text-gray-500">{Math.round(editingOverlay.backgroundOpacity * 100)}%</span>
                      </div>
                    </>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="pt-4 flex justify-between">
                  <div>
                    {editingOverlay.id && textOverlays.find(o => o.id === editingOverlay.id) && (
                      <Button 
                        onClick={() => {
                          deleteTextOverlay(editingOverlay.id);
                          setEditingOverlay(null);
                          setIsTextDialogOpen(false);
                        }}
                        variant="destructive"
                        size="sm"
                      >
                        Delete
                      </Button>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      onClick={() => {
                        setEditingOverlay(null);
                        setIsTextDialogOpen(false);
                      }}
                      variant="outline"
                    >
                      Cancel
                    </Button>
                    <Button 
                      onClick={saveTextOverlay}
                      disabled={!editingOverlay.text.trim()}
                    >
                      {editingOverlay.id && textOverlays.find(o => o.id === editingOverlay.id) ? 'Update' : 'Add'}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </CustomDialogContent>
        </Dialog>
      </div>
    </div>
  )
} 