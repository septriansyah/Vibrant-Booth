/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Camera,
  Video,
  Layout,
  Image as ImageIcon,
  Download,
  RefreshCw,
  Heart,
  Star,
  Smile,
  Send,
  X,
  ChevronRight,
  ChevronLeft,
  SwitchCamera
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import confetti from 'canvas-confetti';
import { BoothView, BoothMode, CapturedPhoto, CapturedVideo, LivePhoto, StripFrame } from './types';

// --- Constants & Frames ---
const FRAMES = [
  { id: 'none', name: 'No Frame', color: 'transparent' },
  { id: 'neon', name: 'Neon Glow', class: 'border-4 border-pink-500 shadow-[0_0_20px_rgba(236,72,153,0.8)]' },
  { id: 'retro', name: 'Retro Polaroid', class: 'border-[12px] border-white border-b-[40px] shadow-lg' },
  { id: 'rainbow', name: 'Rainbow', class: 'border-8 [border-image:linear-gradient(to_right,red,orange,yellow,green,blue,indigo,violet)1] shadow-lg' },
  { id: 'stars', name: 'Starry Night', class: 'border-4 border-yellow-300 border-dashed' },
];

const STRIP_FRAMES: StripFrame[] = [
  { id: 'classic', name: 'Classic White', bgColor: '#FFFFFF', textColor: '#000000', borderClass: 'border-black' },
  { id: 'dark', name: 'Midnight Noir', bgColor: '#1A1A1A', textColor: '#FFFFFF', borderClass: 'border-white' },
  { id: 'vibrant', name: 'Vibrant Orange', bgColor: '#FF6321', textColor: '#FFFFFF', borderClass: 'border-black' },
  { id: 'pastel', name: 'Pastel Dream', bgColor: '#FFD1DC', textColor: '#7B68EE', borderClass: 'border-[#7B68EE]' },
  { id: 'cyber', name: 'Cyberpunk', bgColor: '#0D0221', textColor: '#00F5FF', borderClass: 'border-[#00F5FF]' },
  { id: 'golden', name: 'Golden Hour', bgColor: '#FFD700', textColor: '#8B4513', borderClass: 'border-[#8B4513]' },
];

const MODES = [
  { id: 'landscape-video', name: '3-Shot Video', icon: Video, desc: '3 landscape shots into a fun video' },
  { id: 'live-strip', name: 'Live Strip', icon: Layout, desc: '3 shots with motion previews & retakes' },
  { id: 'single-frame', name: 'Single Shot', icon: ImageIcon, desc: 'One photo with custom frames' },
];

export default function App() {
  const [view, setView] = useState<BoothView>('landing');
  const [mode, setMode] = useState<BoothMode>('landscape-video');
  const [isStreaming, setIsStreaming] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [selectedFrame, setSelectedFrame] = useState(FRAMES[0]);
  const [selectedStripFrame, setSelectedStripFrame] = useState(STRIP_FRAMES[0]);
  const [feedback, setFeedback] = useState('');
  const [feedbackSent, setFeedbackSent] = useState(false);
  const [retakingIndex, setRetakingIndex] = useState<number | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // --- Camera Setup ---
  const startCamera = async () => {
    if (view !== 'booth') return;
    try {
      const isLandscapeMode = mode === 'landscape-video' || mode === 'live-strip';
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: isLandscapeMode ? 1920 : 1080 },
          height: { ideal: isLandscapeMode ? 1080 : 1920 },
          facingMode: facingMode
        }
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsStreaming(true);
      }
    } catch (err) {
      console.error("Error accessing camera:", err);
      alert("Please allow camera access to use the photo booth!");
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach(track => track.stop());
      setIsStreaming(false);
    }
  };

  const flipCamera = () => {
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  };

  useEffect(() => {
    if (view === 'booth') {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [mode, view, facingMode]);

  // --- Capture Logic ---
  const takePhoto = (): string => {
    if (!videoRef.current || !canvasRef.current) return '';
    const canvas = canvasRef.current;
    const video = videoRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      if (facingMode === 'user') {
        // Mirror the photo for front camera to match preview
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
      }
      ctx.drawImage(video, 0, 0);
      ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset transform
      return canvas.toDataURL('image/jpeg');
    }
    return '';
  };

  const recordSnippet = (duration: number): Promise<string> => {
    return new Promise((resolve) => {
      if (!videoRef.current || !videoRef.current.srcObject) return resolve('');
      const stream = videoRef.current.srcObject as MediaStream;
      
      // WebM is more reliable for MediaRecorder in most browsers
      const mimeType = 'video/webm;codecs=vp8';
        
      const recorder = new MediaRecorder(stream, { mimeType });
      const chunks: Blob[] = [];
      
      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: mimeType });
        resolve(URL.createObjectURL(blob));
      };
      
      recorder.start();
      setTimeout(() => recorder.stop(), duration);
    });
  };

  const handleCapture = async () => {
    if (capturing) return;
    setCapturing(true);
    setResults(null);

    if (mode === 'landscape-video') {
      const photos: string[] = [];
      for (let i = 0; i < 3; i++) {
        await runCountdown(3);
        photos.push(takePhoto());
        confetti({ particleCount: 50, spread: 60, origin: { y: 0.6 } });
      }
      const videoUrl = await createVideoFromPhotos(photos);
      setResults({ type: 'video', url: videoUrl, photos });
    } 
    else if (mode === 'live-strip') {
      const livePhotos: LivePhoto[] = [];
      for (let i = 0; i < 3; i++) {
        await runCountdown(3);
        const videoUrl = await recordSnippet(1500);
        const photoUrl = takePhoto();
        livePhotos.push({ id: Math.random().toString(), photoUrl, videoUrl });
        confetti({ particleCount: 30, spread: 50 });
      }
      setResults({ type: 'strip', items: livePhotos });
    } 
    else {
      await runCountdown(3);
      const photoUrl = takePhoto();
      setResults({ type: 'single', url: photoUrl });
      confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
    }

    setCapturing(false);
  };

  const handleRetake = async (index: number) => {
    if (capturing || !results || results.type !== 'strip') return;
    setCapturing(true);
    setRetakingIndex(index);
    
    await runCountdown(3);
    const videoUrl = await recordSnippet(1500);
    const photoUrl = takePhoto();
    
    const newItems = [...results.items];
    newItems[index] = { id: Math.random().toString(), photoUrl, videoUrl };
    
    setResults({ ...results, items: newItems });
    setRetakingIndex(null);
    setCapturing(false);
    confetti({ particleCount: 50, spread: 60 });
  };

  const runCountdown = (seconds: number) => {
    return new Promise((resolve) => {
      let count = seconds;
      setCountdown(count);
      const timer = setInterval(() => {
        count--;
        if (count <= 0) {
          clearInterval(timer);
          setCountdown(null);
          resolve(true);
        } else {
          setCountdown(count);
        }
      }, 1000);
    });
  };

  const createVideoFromPhotos = async (photos: string[]): Promise<string> => {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      canvas.width = 1280;
      canvas.height = 720;
      const ctx = canvas.getContext('2d')!;
      const stream = canvas.captureStream(30);
      
      const mimeType = 'video/webm;codecs=vp8';
        
      const recorder = new MediaRecorder(stream, { mimeType });
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: mimeType });
        resolve(URL.createObjectURL(blob));
      };

      recorder.start();
      
      let frame = 0;
      const totalFrames = 90; 
      const draw = () => {
        const photoIndex = Math.floor((frame / totalFrames) * photos.length);
        const img = new Image();
        img.src = photos[photoIndex];
        img.onload = () => {
          ctx.drawImage(img, 0, 0, 1280, 720);
          frame++;
          if (frame < totalFrames) {
            requestAnimationFrame(draw);
          } else {
            recorder.stop();
          }
        };
      };
      draw();
    });
  };

  const downloadResult = (url: string, filename: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
  };

  const downloadStitchedStrip = async () => {
    if (!results || results.type !== 'strip') return;
    
    const canvas = document.createElement('canvas');
    // Instagram Story size: 1080 x 1920 (9:16)
    canvas.width = 1080;
    canvas.height = 1920;
    const ctx = canvas.getContext('2d')!;

    // Background
    ctx.fillStyle = selectedStripFrame.bgColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const padding = 60;
    const stripGap = 40;
    const stripWidth = (canvas.width - (padding * 2) - stripGap) / 2;
    
    // Landscape aspect ratio for photos (3:2)
    const photoHeight = stripWidth * (2/3);
    const photoGap = 40;
    const totalPhotosHeight = (photoHeight * 3) + (photoGap * 2);
    const startY = (canvas.height - totalPhotosHeight) / 2;

    const loadImg = (src: string): Promise<HTMLImageElement> => {
      return new Promise((resolve) => {
        const img = new Image();
        img.src = src;
        img.onload = () => resolve(img);
      });
    };

    const drawStrip = async (startX: number) => {
      for (let i = 0; i < results.items.length; i++) {
        const img = await loadImg(results.items[i].photoUrl);
        const y = startY + (i * (photoHeight + photoGap));
        
        // Draw border/shadow
        ctx.strokeStyle = selectedStripFrame.textColor;
        ctx.lineWidth = 10;
        ctx.strokeRect(startX - 5, y - 5, stripWidth + 10, photoHeight + 10);
        
        // Draw image (Cover style to prevent gepeng)
        const imgAspect = img.width / img.height;
        const targetAspect = stripWidth / photoHeight;
        
        let sx, sy, sw, sh;
        if (imgAspect > targetAspect) {
          sh = img.height;
          sw = sh * targetAspect;
          sx = (img.width - sw) / 2;
          sy = 0;
        } else {
          sw = img.width;
          sh = sw / targetAspect;
          sx = 0;
          sy = (img.height - sh) / 2;
        }

        ctx.drawImage(img, sx, sy, sw, sh, startX, y, stripWidth, photoHeight);
      }
    };

    // Draw two identical strips
    await drawStrip(padding);
    await drawStrip(padding + stripWidth + stripGap);

    // Add Branding
    ctx.fillStyle = selectedStripFrame.textColor;
    ctx.font = 'black 60px Inter';
    ctx.textAlign = 'center';
    ctx.fillText(`VIBRANT BOOTH`, canvas.width / 2, startY - 100);
    ctx.font = 'bold 35px Inter';
    ctx.fillText(`DOUBLE TROUBLE • ${new Date().toLocaleDateString()}`, canvas.width / 2, canvas.height - 100);

    downloadResult(canvas.toDataURL('image/jpeg', 0.95), 'vibrant-double-strip.jpg');
  };

  const downloadAnimatedStrip = async () => {
    if (!results || results.type !== 'strip') return;
    setCapturing(true); // Show loading state

    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1920;
    const ctx = canvas.getContext('2d')!;
    
    const stream = canvas.captureStream(30);
    
    // Use WebM for better compatibility
    const mimeType = 'video/webm;codecs=vp8';
    const extension = 'webm';

    const recorder = new MediaRecorder(stream, { mimeType });
    const chunks: Blob[] = [];

    recorder.ondataavailable = (e) => chunks.push(e.data);
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: mimeType });
      downloadResult(URL.createObjectURL(blob), `vibrant-animated-strip.${extension}`);
      setCapturing(false);
    };

    recorder.start();

    const padding = 60;
    const stripGap = 40;
    const stripWidth = (canvas.width - (padding * 2) - stripGap) / 2;
    const photoHeight = stripWidth * (2/3);
    const photoGap = 40;
    const totalPhotosHeight = (photoHeight * 3) + (photoGap * 2);
    const startY = (canvas.height - totalPhotosHeight) / 2;

    // Load all videos
    const videos = await Promise.all(results.items.map((item: LivePhoto) => {
      return new Promise<HTMLVideoElement>((resolve) => {
        const v = document.createElement('video');
        v.src = item.videoUrl;
        v.loop = true;
        v.muted = true;
        v.play();
        v.oncanplaythrough = () => resolve(v);
      });
    }));

    let frame = 0;
    const totalFrames = 150; // ~5 seconds at 30fps

    const drawFrame = () => {
      // Background
      ctx.fillStyle = selectedStripFrame.bgColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const drawStrips = (startX: number) => {
        for (let i = 0; i < videos.length; i++) {
          const v = videos[i];
          const y = startY + (i * (photoHeight + photoGap));
          
          ctx.strokeStyle = selectedStripFrame.textColor;
          ctx.lineWidth = 10;
          ctx.strokeRect(startX - 5, y - 5, stripWidth + 10, photoHeight + 10);

          // Cover logic for video
          const vAspect = v.videoWidth / v.videoHeight;
          const targetAspect = stripWidth / photoHeight;
          let sx, sy, sw, sh;
          if (vAspect > targetAspect) {
            sh = v.videoHeight;
            sw = sh * targetAspect;
            sx = (v.videoWidth - sw) / 2;
            sy = 0;
          } else {
            sw = v.videoWidth;
            sh = sw / targetAspect;
            sx = 0;
            sy = (v.videoHeight - sh) / 2;
          }
          ctx.drawImage(v, sx, sy, sw, sh, startX, y, stripWidth, photoHeight);
        }
      };

      drawStrips(padding);
      drawStrips(padding + stripWidth + stripGap);

      // Branding
      ctx.fillStyle = selectedStripFrame.textColor;
      ctx.font = 'black 60px Inter';
      ctx.textAlign = 'center';
      ctx.fillText(`VIBRANT BOOTH`, canvas.width / 2, startY - 100);
      ctx.font = 'bold 35px Inter';
      ctx.fillText(`LIVE MOTION • ${new Date().toLocaleDateString()}`, canvas.width / 2, canvas.height - 100);

      frame++;
      if (frame < totalFrames) {
        requestAnimationFrame(drawFrame);
      } else {
        recorder.stop();
        videos.forEach(v => v.pause());
      }
    };

    drawFrame();
  };

  const handleFeedback = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Feedback sent to septriansyah31@gmail.com:", feedback);
    setFeedbackSent(true);
    setTimeout(() => setFeedbackSent(false), 3000);
    setFeedback('');
  };

  if (view === 'landing') {
    return (
      <div className="min-h-screen bg-[#FF6321] text-black font-sans overflow-x-hidden">
        {/* Hero Section */}
        <section className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden">
          {/* Decorative Elements */}
          <motion.div 
            animate={{ rotate: 360 }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
            className="absolute -top-20 -left-20 w-64 h-64 border-4 border-black rounded-full opacity-20"
          />
          <motion.div 
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 4, repeat: Infinity }}
            className="absolute -bottom-20 -right-20 w-80 h-80 bg-yellow-400 border-4 border-black rounded-full opacity-20"
          />

          <motion.div 
            initial={{ y: 50, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            viewport={{ once: true }}
            className="max-w-4xl w-full bg-white border-8 border-black p-8 md:p-16 shadow-[16px_16px_0px_0px_rgba(0,0,0,1)] text-center space-y-8 relative z-10"
          >
            <div className="inline-block p-4 bg-yellow-400 border-4 border-black rounded-full mb-4">
              <Camera className="w-12 h-12" />
            </div>
            <h1 className="text-5xl md:text-8xl font-black uppercase italic tracking-tighter leading-none">
              Welcome to <br />
              <span className="text-pink-500">Vibrant Booth</span>
            </h1>
            <p className="text-xl md:text-2xl font-bold opacity-70 max-w-2xl mx-auto">
              The ultimate interactive photo experience. 
              Capture, customize, and share your vibe in seconds!
            </p>
            <div className="pt-4">
              <button 
                onClick={() => setView('booth')}
                className="px-12 py-6 bg-black text-white font-black uppercase text-2xl shadow-[8px_8px_0px_0px_rgba(255,99,33,1)] hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all flex items-center gap-4 mx-auto group"
              >
                Start Experience 
                <ChevronRight className="group-hover:translate-x-2 transition-transform" />
              </button>
            </div>
            <div className="flex justify-center gap-4 pt-4">
              <div className="flex -space-x-4">
                {[1,2,3,4].map(i => (
                  <div key={i} className="w-10 h-10 rounded-full border-2 border-black bg-gray-200 overflow-hidden">
                    <img src={`https://picsum.photos/seed/user${i}/100/100`} alt="user" referrerPolicy="no-referrer" />
                  </div>
                ))}
              </div>
              <p className="text-sm font-black uppercase flex items-center gap-2">
                <Star className="w-4 h-4 fill-yellow-400" />
                Joined by 1,000+ snappers
              </p>
            </div>
          </motion.div>
        </section>

        {/* Section 1: The Magic Modes */}
        <section className="py-24 px-6 bg-white border-t-8 border-black">
          <div className="max-w-6xl mx-auto space-y-16">
            <div className="text-center space-y-4">
              <h2 className="text-4xl md:text-6xl font-black uppercase italic tracking-tight">Choose Your Vibe</h2>
              <p className="text-xl font-bold opacity-60">Three unique ways to capture the magic.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {MODES.map((m, i) => (
                <motion.div 
                  key={m.id}
                  initial={{ y: 30, opacity: 0 }}
                  whileInView={{ y: 0, opacity: 1 }}
                  transition={{ delay: i * 0.1 }}
                  viewport={{ once: true }}
                  className="bg-white border-4 border-black p-8 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-2 transition-all group"
                >
                  <div className="w-16 h-16 bg-yellow-400 border-4 border-black rounded-2xl flex items-center justify-center mb-6 group-hover:rotate-6 transition-transform">
                    <m.icon className="w-8 h-8" />
                  </div>
                  <h3 className="text-2xl font-black uppercase mb-2">{m.name}</h3>
                  <p className="font-bold opacity-70">{m.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Section 2: How It Works */}
        <section className="py-24 px-6 bg-yellow-400 border-t-8 border-black">
          <div className="max-w-6xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
              <div className="space-y-8">
                <h2 className="text-5xl md:text-7xl font-black uppercase italic leading-none">
                  Snap in <br />
                  <span className="text-white drop-shadow-[4px_4px_0px_rgba(0,0,0,1)]">3 Simple Steps</span>
                </h2>
                <div className="space-y-6">
                  {[
                    { step: "01", title: "Pick Your Style", text: "Choose between Video, Live Strip, or Single Frame mode." },
                    { step: "02", title: "Strike a Pose", text: "Follow the countdown and let your personality shine!" },
                    { step: "03", title: "Share the Love", text: "Download your IG-ready results and show the world." }
                  ].map((s, i) => (
                    <div key={i} className="flex gap-6 items-start">
                      <span className="text-4xl font-black opacity-20">{s.step}</span>
                      <div>
                        <h4 className="text-xl font-black uppercase">{s.title}</h4>
                        <p className="font-bold opacity-70">{s.text}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="relative">
                <div className="absolute inset-0 bg-black translate-x-4 translate-y-4 rounded-3xl" />
                <div className="relative bg-white border-4 border-black p-4 rounded-3xl overflow-hidden">
                  <img 
                    src="https://picsum.photos/seed/booth-demo/800/1000" 
                    alt="Demo" 
                    className="w-full rounded-2xl grayscale hover:grayscale-0 transition-all duration-500"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute top-8 right-8 bg-pink-500 text-white px-4 py-2 border-2 border-black font-black uppercase -rotate-12">
                    Live Now!
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Section 3: Social Ready */}
        <section className="py-24 px-6 bg-white border-t-8 border-black overflow-hidden">
          <div className="max-w-6xl mx-auto text-center space-y-12">
            <div className="space-y-4">
              <div className="inline-block px-4 py-1 bg-pink-500 text-white font-black uppercase text-xs tracking-widest mb-2">Social Media Ready</div>
              <h2 className="text-4xl md:text-6xl font-black uppercase italic">Made for Your Story</h2>
              <p className="text-xl font-bold opacity-60 max-w-2xl mx-auto">
                No more cropping! Our Live Strips are automatically sized for Instagram Stories (9:16) with custom frames.
              </p>
            </div>

            <div className="flex flex-wrap justify-center gap-8">
              {[
                { color: 'bg-white', label: 'Classic' },
                { color: 'bg-[#1A1A1A]', label: 'Midnight' },
                { color: 'bg-[#FF6321]', label: 'Vibrant' }
              ].map((style, i) => (
                <motion.div 
                  key={i}
                  whileHover={{ y: -10, rotate: i % 2 === 0 ? 2 : -2 }}
                  className={`${style.color} w-48 h-80 border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-3 flex flex-col gap-2`}
                >
                  {[1,2,3,4].map(j => (
                    <div key={j} className="flex grow bg-gray-200 border border-black/20 overflow-hidden">
                      <img src={`https://picsum.photos/seed/story${i}${j}/200/300`} alt="preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    </div>
                  ))}
                  <div className="text-[8px] font-black uppercase text-center opacity-40">Style: {style.label}</div>
                </motion.div>
              ))}
            </div>

            <div className="pt-12">
              <button 
                onClick={() => setView('booth')}
                className="px-16 py-8 bg-yellow-400 border-4 border-black font-black uppercase text-3xl shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all"
              >
                Let's Snap!
              </button>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="p-12 border-t-8 border-black bg-black text-white text-center">
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex justify-center gap-8">
              <Star className="w-8 h-8 animate-bounce" />
              <Heart className="w-8 h-8 animate-pulse text-pink-500 fill-pink-500" />
              <Smile className="w-8 h-8 animate-bounce delay-100" />
            </div>
            <p className="text-2xl font-black uppercase italic tracking-tighter">Vibrant Booth • 2026</p>
            <p className="font-bold opacity-40 text-xs">Built for creators, by snappers.</p>
          </div>
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FF6321] text-black font-sans overflow-x-hidden">
      {/* Header */}
      <header className="p-6 border-b-2 border-black flex justify-between items-center bg-white sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <button onClick={() => setView('landing')} className="w-12 h-12 bg-yellow-400 rounded-full flex items-center justify-center border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:bg-yellow-300 transition-colors">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="text-2xl font-black uppercase tracking-tighter">Vibrant Booth</h1>
        </div>
        <nav className="hidden md:flex gap-6 font-bold uppercase text-sm">
          <button onClick={() => setMode('landscape-video')} className={`hover:underline ${mode === 'landscape-video' ? 'underline' : ''}`}>Video</button>
          <button onClick={() => setMode('live-strip')} className={`hover:underline ${mode === 'live-strip' ? 'underline' : ''}`}>Strip</button>
          <button onClick={() => setMode('single-frame')} className={`hover:underline ${mode === 'single-frame' ? 'underline' : ''}`}>Single</button>
        </nav>
      </header>

      <main className="max-w-6xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Camera & Controls */}
        <div className="lg:col-span-7 space-y-6">
          <section className="bg-white border-4 border-black p-4 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] relative overflow-hidden">
            <div className="mb-4 flex justify-between items-center">
              <h2 className="text-xl font-black uppercase italic">Ready to snap?</h2>
              <div className="flex gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500 border border-black" />
                <div className="w-3 h-3 rounded-full bg-yellow-400 border border-black" />
                <div className="w-3 h-3 rounded-full bg-green-500 border border-black" />
              </div>
            </div>

            <div className={`relative aspect-video bg-black rounded-lg overflow-hidden border-2 border-black ${mode === 'live-strip' ? 'aspect-[3/4] max-w-md mx-auto' : ''}`}>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover ${facingMode === 'user' ? 'transform scale-x-[-1]' : ''} ${capturing ? 'brightness-125' : ''}`}
              />
              
              {/* Frame Overlay for Single Mode */}
              {mode === 'single-frame' && selectedFrame.id !== 'none' && (
                <div className={`absolute inset-0 pointer-events-none ${selectedFrame.class}`} />
              )}

              {/* Countdown Overlay */}
              <AnimatePresence>
                {countdown !== null && (
                  <motion.div 
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1.5, opacity: 1 }}
                    exit={{ scale: 2, opacity: 0 }}
                    className="absolute inset-0 flex items-center justify-center pointer-events-none"
                  >
                    <span className="text-9xl font-black text-white drop-shadow-[0_5px_15px_rgba(0,0,0,0.5)]">{countdown}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Flash Effect */}
              {capturing && countdown === null && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: [0, 1, 0] }}
                  transition={{ duration: 0.2 }}
                  className="absolute inset-0 bg-white z-10"
                />
              )}
            </div>

            <div className="mt-6 flex flex-wrap gap-4 justify-center">
              <button
                onClick={flipCamera}
                disabled={capturing}
                className="px-6 py-4 bg-white border-4 border-black font-black uppercase text-xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all disabled:opacity-50 flex items-center gap-2"
                title={facingMode === 'user' ? 'Switch to rear camera' : 'Switch to front camera'}
              >
                <SwitchCamera />
              </button>
              <button
                onClick={handleCapture}
                disabled={capturing}
                className="px-8 py-4 bg-yellow-400 border-4 border-black font-black uppercase text-xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all disabled:opacity-50 flex items-center gap-2"
              >
                {capturing ? <RefreshCw className="animate-spin" /> : <Camera />}
                {capturing ? 'Capturing...' : 'Snap Now!'}
              </button>
            </div>
          </section>

          {/* Mode Selector */}
          <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {MODES.map((m) => (
              <button
                key={m.id}
                onClick={() => { setMode(m.id as BoothMode); setResults(null); }}
                className={`p-4 border-4 border-black text-left transition-all ${mode === m.id ? 'bg-white shadow-none translate-x-1 translate-y-1' : 'bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:bg-yellow-50'}`}
              >
                <m.icon className="w-8 h-8 mb-2" />
                <h3 className="font-black uppercase text-sm">{m.name}</h3>
                <p className="text-xs opacity-70">{m.desc}</p>
              </button>
            ))}
          </section>

          {/* Frame Selector for Single Mode */}
          {mode === 'single-frame' && (
            <section className="bg-white border-4 border-black p-4 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
              <h3 className="font-black uppercase mb-4 flex items-center gap-2">
                <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
                Choose Your Frame
              </h3>
              <div className="flex flex-wrap gap-3">
                {FRAMES.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setSelectedFrame(f)}
                    className={`px-4 py-2 border-2 border-black font-bold text-xs uppercase transition-all ${selectedFrame.id === f.id ? 'bg-black text-white' : 'bg-white hover:bg-gray-100'}`}
                  >
                    {f.name}
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* Strip Frame Selector for Live Strip Mode */}
          {mode === 'live-strip' && results && results.type === 'strip' && (
            <section className="bg-white border-4 border-black p-4 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
              <h3 className="font-black uppercase mb-4 flex items-center gap-2">
                <Layout className="w-5 h-5 text-blue-500" />
                Strip Style (Instagram Story)
              </h3>
              <div className="flex flex-wrap gap-3">
                {STRIP_FRAMES.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setSelectedStripFrame(f)}
                    className={`px-4 py-2 border-2 border-black font-bold text-xs uppercase transition-all ${selectedStripFrame.id === f.id ? 'bg-black text-white' : 'bg-white hover:bg-gray-100'}`}
                  >
                    {f.name}
                  </button>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Right Column: Results & Feedback */}
        <div className="lg:col-span-5 space-y-6">
          <section className="bg-white border-4 border-black p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] min-h-[400px] flex flex-col">
            <h2 className="text-xl font-black uppercase italic mb-6 border-b-2 border-black pb-2 flex items-center justify-between">
              Your Results
              {results && (
                <button onClick={() => setResults(null)} className="text-xs font-bold uppercase hover:underline">Clear</button>
              )}
            </h2>

            <div className="flex-grow flex items-center justify-center">
              {!results ? (
                <div className="text-center space-y-4 opacity-30">
                  <Smile className="w-20 h-20 mx-auto" />
                  <p className="font-black uppercase">Take some photos to see them here!</p>
                </div>
              ) : (
                <div className="w-full space-y-6">
                  {results.type === 'video' && (
                    <div className="space-y-4">
                      <video src={results.url} controls autoPlay loop className="w-full border-4 border-black shadow-lg" />
                      <button 
                        onClick={() => {
                          downloadResult(results.url, 'booth-video.webm');
                        }}
                        className="w-full py-3 bg-green-400 border-4 border-black font-black uppercase flex items-center justify-center gap-2 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                      >
                        <Download /> Download Video
                      </button>
                    </div>
                  )}

                  {results.type === 'strip' && (
                    <div className="space-y-4">
                      <div 
                        className="p-4 border-4 border-black shadow-xl space-y-4 max-w-[280px] mx-auto transition-colors duration-300"
                        style={{ backgroundColor: selectedStripFrame.bgColor }}
                      >
                        {results.items.map((item: LivePhoto, idx: number) => (
                          <div key={item.id} className={`relative group aspect-[4/3] border-2 ${selectedStripFrame.borderClass} overflow-hidden bg-black`}>
                            <video 
                              src={item.videoUrl} 
                              autoPlay 
                              loop 
                              muted 
                              className="w-full h-full object-cover absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
                            />
                            <img src={item.photoUrl} alt={`Snap ${idx}`} className="w-full h-full object-cover group-hover:opacity-0 transition-opacity" referrerPolicy="no-referrer" />
                            <div className="absolute bottom-1 right-1 bg-yellow-400 border border-black px-1 text-[8px] font-black uppercase text-black">Live</div>
                            
                            {/* Retake Button */}
                            <button 
                              onClick={() => handleRetake(idx)}
                              disabled={capturing}
                              className="absolute top-2 right-2 bg-white/90 hover:bg-white text-black p-1 rounded-full border border-black opacity-0 group-hover:opacity-100 transition-opacity shadow-sm z-10"
                              title="Retake this shot"
                            >
                              <RefreshCw className={`w-4 h-4 ${capturing && retakingIndex === idx ? 'animate-spin' : ''}`} />
                            </button>
                            
                            {/* Retaking Overlay */}
                            {capturing && retakingIndex === idx && (
                              <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-20">
                                <span className="text-white font-black text-2xl">{countdown}</span>
                              </div>
                            )}
                          </div>
                        ))}
                        <div className="pt-2 text-center border-t border-black">
                          <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: selectedStripFrame.textColor }}>Vibrant Booth • {new Date().toLocaleDateString()}</p>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          <button 
                            onClick={downloadStitchedStrip}
                            className="py-3 bg-blue-400 border-4 border-black font-black uppercase flex items-center justify-center gap-2 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] text-xs"
                          >
                            <Download className="w-4 h-4" /> Image Strip
                          </button>
                          <button 
                            onClick={downloadAnimatedStrip}
                            disabled={capturing}
                            className="py-3 bg-purple-400 border-4 border-black font-black uppercase flex items-center justify-center gap-2 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] text-xs disabled:opacity-50"
                          >
                            <Video className="w-4 h-4" /> Video Strip
                          </button>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <button 
                            onClick={() => results.items.forEach((item: LivePhoto, i: number) => downloadResult(item.photoUrl, `snap-${i}.jpg`))}
                            className="py-2 bg-white border-2 border-black font-black uppercase text-[10px] flex items-center justify-center gap-1"
                          >
                            Individual Photos
                          </button>
                          <button 
                            onClick={() => {
                              results.items.forEach((item: LivePhoto, i: number) => downloadResult(item.videoUrl, `live-${i}.webm`));
                            }}
                            className="py-2 bg-white border-2 border-black font-black uppercase text-[10px] flex items-center justify-center gap-1"
                          >
                            Individual Videos
                          </button>
                        </div>
                      </div>
                      <p className="text-[10px] text-center font-bold opacity-60 italic">* Hover over photos to see the motion!</p>
                    </div>
                  )}

                  {results.type === 'single' && (
                    <div className="space-y-4">
                      <div className="relative border-4 border-black shadow-lg">
                        <img src={results.url} alt="Result" className="w-full" referrerPolicy="no-referrer" />
                        {selectedFrame.id !== 'none' && (
                          <div className={`absolute inset-0 pointer-events-none ${selectedFrame.class}`} />
                        )}
                      </div>
                      <button 
                        onClick={() => {
                          const canvas = document.createElement('canvas');
                          const img = new Image();
                          img.src = results.url;
                          img.onload = () => {
                            canvas.width = img.width;
                            canvas.height = img.height;
                            const ctx = canvas.getContext('2d')!;
                            ctx.drawImage(img, 0, 0);
                            
                            // Simple frame drawing for download
                            if (selectedFrame.id === 'retro') {
                                ctx.strokeStyle = 'white';
                                ctx.lineWidth = 100;
                                ctx.strokeRect(0, 0, canvas.width, canvas.height);
                                // Bottom part of polaroid
                                ctx.fillStyle = 'white';
                                ctx.fillRect(0, canvas.height - 200, canvas.width, 200);
                            } else if (selectedFrame.id === 'neon') {
                                ctx.strokeStyle = '#ec4899';
                                ctx.lineWidth = 30;
                                ctx.shadowBlur = 20;
                                ctx.shadowColor = '#ec4899';
                                ctx.strokeRect(0, 0, canvas.width, canvas.height);
                            } else if (selectedFrame.id === 'rainbow') {
                                const gradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
                                gradient.addColorStop(0, 'red');
                                gradient.addColorStop(0.17, 'orange');
                                gradient.addColorStop(0.33, 'yellow');
                                gradient.addColorStop(0.5, 'green');
                                gradient.addColorStop(0.67, 'blue');
                                gradient.addColorStop(0.83, 'indigo');
                                gradient.addColorStop(1, 'violet');
                                ctx.strokeStyle = gradient;
                                ctx.lineWidth = 40;
                                ctx.strokeRect(0, 0, canvas.width, canvas.height);
                            } else if (selectedFrame.id === 'stars') {
                                ctx.strokeStyle = '#fde047';
                                ctx.lineWidth = 20;
                                ctx.setLineDash([30, 30]);
                                ctx.strokeRect(0, 0, canvas.width, canvas.height);
                            }
                            
                            downloadResult(canvas.toDataURL('image/jpeg'), 'booth-photo.jpg');
                          };
                        }}
                        className="w-full py-3 bg-yellow-400 border-4 border-black font-black uppercase flex items-center justify-center gap-2 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                      >
                        <Download /> Download Photo
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>

          {/* Feedback Form */}
          <section className="bg-black text-white border-4 border-black p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
            <h2 className="text-xl font-black uppercase italic mb-4 flex items-center gap-2">
              <Heart className="w-6 h-6 text-pink-500 fill-pink-500" />
              Send Feedback
            </h2>
            <form onSubmit={handleFeedback} className="space-y-4">
              <textarea 
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="Tell us what you think..."
                className="w-full bg-white text-black border-2 border-white p-3 font-bold placeholder:opacity-50 focus:outline-none focus:ring-2 focus:ring-yellow-400"
                rows={3}
                required
              />
              <button 
                type="submit"
                className="w-full py-3 bg-pink-500 border-2 border-white font-black uppercase flex items-center justify-center gap-2 hover:bg-pink-600 transition-colors"
              >
                <Send className="w-4 h-4" />
                {feedbackSent ? 'Sent!' : 'Submit Feedback'}
              </button>
              <p className="text-[10px] opacity-50 text-center">Feedback will be sent to septriansyah31@gmail.com</p>
            </form>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-12 p-12 border-t-4 border-black bg-white text-center">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex justify-center gap-8">
            <Star className="w-8 h-8 animate-bounce" />
            <Heart className="w-8 h-8 animate-pulse text-pink-500 fill-pink-500" />
            <Smile className="w-8 h-8 animate-bounce delay-100" />
          </div>
          <p className="text-4xl font-black uppercase italic tracking-tighter">Capture the Moment!</p>
          <p className="font-bold opacity-60">© 2026 Vibrant Photo Booth. All rights reserved.</p>
        </div>
      </footer>

      {/* Hidden Canvas for Processing */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
