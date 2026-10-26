import React, { useState, useRef, useEffect } from 'react';
import {
  Camera,
  Upload,
  RotateCw,
  Crop,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Sparkles,
  Info,
  Layers,
  ArrowRight
} from 'lucide-react';
import { assessImageQuality, loadImageFromFile } from '../services/imageQuality';
import { preprocessLesionImage } from '../services/preprocessing';
import { runClassicalLesionSegmentation } from '../services/segmentation';
import type { QualityMetrics, PreprocessingResult, ClassicalSegmentationResult } from '../types';

interface ImageCaptureWorkflowProps {
  onConfirm: (payload: {
    originalBlob: Blob;
    originalDataUrl: string;
    quality: QualityMetrics;
    preprocessing: PreprocessingResult;
    segmentation: ClassicalSegmentationResult;
  }) => void;
  onCancel?: () => void;
}

type WorkflowStep = 'input' | 'quality' | 'preprocess' | 'confirmed';

export const ImageCaptureWorkflow: React.FC<ImageCaptureWorkflowProps> = ({
  onConfirm,
  onCancel,
}) => {
  const [step, setStep] = useState<WorkflowStep>('input');
  const [mode, setMode] = useState<'camera' | 'gallery'>('gallery');

  // Camera stream state
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Loaded raw image
  const [rawImage, setRawImage] = useState<HTMLImageElement | null>(null);
  const [rotationAngle, setRotationAngle] = useState<number>(0);
  const [dragActive, setDragActive] = useState<boolean>(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Assessment results
  const [qualityMetrics, setQualityMetrics] = useState<QualityMetrics | null>(null);
  const [preprocessing, setPreprocessing] = useState<PreprocessingResult | null>(null);
  const [segmentation, setSegmentation] = useState<ClassicalSegmentationResult | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  // Start Camera
  const startCamera = async () => {
    setCameraError(null);
    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setCameraActive(true);
      }
    } catch (err: any) {
      console.warn('Camera stream error:', err);
      setCameraError('Unable to access camera. Please verify device permissions or switch to file upload.');
      setCameraActive(false);
    }
  };

  // Stop Camera
  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  };

  useEffect(() => {
    if (mode === 'camera') {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [mode]);

  // Capture frame from live camera
  const captureFrame = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    stopCamera();

    const img = new Image();
    img.onload = () => {
      setRawImage(img);
      setRotationAngle(0);
      runAssessmentPipeline(img, 0);
    };
    img.src = canvas.toDataURL('image/jpeg', 0.95);
  };

  // Validate and handle file input
  const handleFileSelection = async (file: File) => {
    setValidationError(null);

    // Format check (jpg, png)
    const validTypes = ['image/jpeg', 'image/png', 'image/jpg'];
    if (!validTypes.includes(file.type)) {
      setValidationError('Unsupported format. Please supply a high-resolution JPEG or PNG lesion photograph.');
      return;
    }

    // Size check (max 10 MB)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      setValidationError(`File size ${(file.size / (1024 * 1024)).toFixed(1)} MB exceeds the 10 MB clinical payload limit.`);
      return;
    }

    try {
      const img = await loadImageFromFile(file);
      // Min resolution check (224x224)
      if (img.width < 224 || img.height < 224) {
        setValidationError(`Resolution (${img.width}x${img.height}) is insufficient. Minimum required dimension is 224x224 px.`);
        return;
      }

      setRawImage(img);
      setRotationAngle(0);
      runAssessmentPipeline(img, 0);
    } catch (err: any) {
      setValidationError(err.message || 'Failed to decode image file.');
    }
  };

  // Rotate Image 90 degrees
  const handleRotate = () => {
    if (!rawImage) return;
    const newAngle = (rotationAngle + 90) % 360;
    setRotationAngle(newAngle);
    runAssessmentPipeline(rawImage, newAngle);
  };

  // Run pipeline: Quality -> Preprocessing -> Classical Otsu Segmentation
  const runAssessmentPipeline = async (img: HTMLImageElement, angle: number) => {
    setIsProcessing(true);
    setValidationError(null);

    try {
      // Build rotated canvas representation if angle !== 0
      let activeSource: HTMLImageElement | HTMLCanvasElement = img;
      if (angle !== 0) {
        const rotCanvas = document.createElement('canvas');
        if (angle === 90 || angle === 270) {
          rotCanvas.width = img.height;
          rotCanvas.height = img.width;
        } else {
          rotCanvas.width = img.width;
          rotCanvas.height = img.height;
        }
        const ctx = rotCanvas.getContext('2d')!;
        ctx.translate(rotCanvas.width / 2, rotCanvas.height / 2);
        ctx.rotate((angle * Math.PI) / 180);
        ctx.drawImage(img, -img.width / 2, -img.height / 2);
        activeSource = rotCanvas;
      }

      // Step 4: Quality Assessment
      const quality = await assessImageQuality(activeSource);
      setQualityMetrics(quality);

      // Step 5: Preprocessing Preview
      const prep = preprocessLesionImage(activeSource, {
        targetSize: 224,
        contrastEnhance: true,
        normalizeColor: true,
      });
      setPreprocessing(prep);

      // Step 6: Classical Otsu Lesion Segmentation
      const seg = runClassicalLesionSegmentation(activeSource);
      setSegmentation(seg);

      setStep('quality');
    } catch (err: any) {
      setValidationError('Processing error: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFinalConfirm = async () => {
    if (!rawImage || !qualityMetrics || !preprocessing || !segmentation) return;

    // Convert processed canvas to Blob
    const response = await fetch(preprocessing.originalDataUrl);
    const blob = await response.blob();

    onConfirm({
      originalBlob: blob,
      originalDataUrl: preprocessing.originalDataUrl,
      quality: qualityMetrics,
      preprocessing,
      segmentation,
    });
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Header Pipeline Tabs */}
      <div className="border-b border-slate-100 bg-slate-50/70 px-6 py-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-bold text-[#0B1F3A] flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-[#0E9F8E]/10 text-[#0E9F8E] flex items-center justify-center text-xs">
              1
            </span>
            Clinical Image Acquisition & Quality Verification
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Capture or upload skin lesion photograph. Automated quality checks evaluate blur, illumination, and contrast.
          </p>
        </div>

        {/* Step Pill Indicators */}
        <div className="flex items-center gap-1.5 text-xs">
          <span
            className={`px-2.5 py-1 rounded-md font-medium ${
              step === 'input'
                ? 'bg-[#0E9F8E] text-white'
                : 'bg-slate-200 text-slate-700'
            }`}
          >
            1. Capture
          </span>
          <span className="text-slate-300">→</span>
          <span
            className={`px-2.5 py-1 rounded-md font-medium ${
              step === 'quality'
                ? 'bg-[#0E9F8E] text-white'
                : 'bg-slate-100 text-slate-500'
            }`}
          >
            2. Quality Check
          </span>
          <span className="text-slate-300">→</span>
          <span
            className={`px-2.5 py-1 rounded-md font-medium ${
              step === 'preprocess'
                ? 'bg-[#0E9F8E] text-white'
                : 'bg-slate-100 text-slate-500'
            }`}
          >
            3. Preprocessing
          </span>
        </div>
      </div>

      <div className="p-6">
        {/* Step 1: Input / Capture Mode */}
        {step === 'input' && (
          <div className="space-y-6">
            {/* Mode Selector */}
            <div className="flex items-center gap-2 border-b border-slate-100 pb-4">
              <button
                type="button"
                onClick={() => setMode('gallery')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition ${
                  mode === 'gallery'
                    ? 'bg-[#0B1F3A] text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <Upload className="w-3.5 h-3.5" />
                Upload Photo / Gallery
              </button>
              <button
                type="button"
                onClick={() => setMode('camera')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition ${
                  mode === 'camera'
                    ? 'bg-[#0E9F8E] text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <Camera className="w-3.5 h-3.5" />
                Live Camera Capture
              </button>
            </div>

            {validationError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2">
                <XCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <strong>Validation Alert:</strong> {validationError}
                </div>
              </div>
            )}

            {/* Gallery / Drag and Drop Mode */}
            {mode === 'gallery' && (
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragActive(true);
                }}
                onDragLeave={() => setDragActive(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragActive(false);
                  if (e.dataTransfer.files?.[0]) {
                    handleFileSelection(e.dataTransfer.files[0]);
                  }
                }}
                className={`border-2 border-dashed rounded-2xl p-10 text-center transition-all ${
                  dragActive
                    ? 'border-[#0E9F8E] bg-teal-50/50 scale-[0.99]'
                    : 'border-slate-200 hover:border-slate-300 bg-slate-50/40'
                }`}
              >
                <input
                  type="file"
                  id="lesion-upload"
                  accept="image/jpeg,image/png,image/jpg"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files?.[0]) {
                      handleFileSelection(e.target.files[0]);
                    }
                  }}
                />
                <div className="w-14 h-14 rounded-2xl bg-[#0E9F8E]/10 text-[#0E9F8E] flex items-center justify-center mx-auto mb-4">
                  <Upload className="w-6 h-6" />
                </div>
                <label
                  htmlFor="lesion-upload"
                  className="cursor-pointer inline-flex items-center gap-2 bg-[#0E9F8E] hover:bg-[#0c8274] text-white px-5 py-2.5 rounded-xl text-xs font-semibold shadow-xs transition"
                >
                  Choose Skin Lesion Image
                </label>
                <p className="text-xs text-slate-500 mt-3">
                  or drag and drop here (JPEG/PNG, min 224x224 px, up to 10 MB)
                </p>

                <div className="mt-6 pt-4 border-t border-slate-200/60 flex items-center justify-center gap-6 text-[11px] text-slate-400">
                  <span>✓ EXIF auto-orientation</span>
                  <span>✓ Client-side privacy preservation</span>
                  <span>✓ Zero cloud transmission before consent</span>
                </div>
              </div>
            )}

            {/* Live Camera Mode */}
            {mode === 'camera' && (
              <div className="relative rounded-2xl bg-black overflow-hidden aspect-4/3 max-w-lg mx-auto shadow-inner">
                {cameraError ? (
                  <div className="h-full flex flex-col items-center justify-center p-6 text-center text-slate-300">
                    <AlertTriangle className="w-8 h-8 text-amber-400 mb-2" />
                    <p className="text-xs">{cameraError}</p>
                    <button
                      type="button"
                      onClick={startCamera}
                      className="mt-4 px-4 py-1.5 bg-[#0E9F8E] text-white rounded-lg text-xs font-semibold"
                    >
                      Retry Camera
                    </button>
                  </div>
                ) : (
                  <>
                    <video
                      ref={videoRef}
                      playsInline
                      muted
                      className="w-full h-full object-cover"
                    />

                    {/* On-screen Clinical Guide Frame & Crosshair */}
                    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                      {/* Guide Box (224x224 aspect center frame) */}
                      <div className="w-56 h-56 border-2 border-[#00F0FF] rounded-2xl relative shadow-[0_0_20px_rgba(0,240,255,0.3)]">
                        {/* Corner brackets */}
                        <div className="absolute -top-1 -left-1 w-4 h-4 border-t-4 border-l-4 border-white" />
                        <div className="absolute -top-1 -right-1 w-4 h-4 border-t-4 border-r-4 border-white" />
                        <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-4 border-l-4 border-white" />
                        <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-4 border-r-4 border-white" />
                        {/* Center Target Dot */}
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 bg-white/70 rounded-full border border-black/40" />
                      </div>
                    </div>

                    {/* Camera Guidance Overlay */}
                    <div className="absolute top-3 left-3 right-3 text-center pointer-events-none">
                      <span className="inline-block bg-black/70 backdrop-blur-xs text-white text-[11px] px-3 py-1 rounded-full font-medium">
                        Center skin lesion inside the guide box (10–15 cm distance)
                      </span>
                    </div>

                    {/* Shutter Button */}
                    <div className="absolute bottom-4 inset-x-0 flex justify-center items-center gap-4">
                      <button
                        type="button"
                        onClick={captureFrame}
                        className="w-16 h-16 rounded-full bg-white border-4 border-[#0E9F8E] shadow-xl flex items-center justify-center hover:scale-105 active:scale-95 transition"
                        title="Capture Photo"
                      >
                        <div className="w-12 h-12 rounded-full bg-[#0E9F8E]" />
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* Step 2: Quality Assessment Results & Retake Control */}
        {step === 'quality' && qualityMetrics && rawImage && (
          <div className="space-y-6">
            {/* Image Preview with Rotate tools */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
              <div className="space-y-3">
                <div className="relative rounded-2xl overflow-hidden border border-slate-200 bg-slate-900 aspect-square flex items-center justify-center">
                  <img
                    src={rawImage.src}
                    alt="Captured lesion"
                    style={{ transform: `rotate(${rotationAngle}deg)` }}
                    className="max-h-full max-w-full object-contain transition-transform duration-200"
                  />
                  <div className="absolute bottom-3 right-3 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleRotate}
                      className="px-3 py-1.5 bg-black/70 hover:bg-black text-white text-xs rounded-lg backdrop-blur-xs flex items-center gap-1.5 transition font-medium"
                    >
                      <RotateCw className="w-3.5 h-3.5" />
                      Rotate 90°
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs text-slate-500 px-1">
                  <span>
                    Resolution: <strong>{qualityMetrics.width} × {qualityMetrics.height} px</strong>
                  </span>
                  <span>Orientation: {rotationAngle}°</span>
                </div>
              </div>

              {/* Quality Assessment Metrics Card */}
              <div className="space-y-4">
                <div
                  className={`p-4 rounded-2xl border ${
                    qualityMetrics.quality_label === 'Good'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                      : qualityMetrics.quality_label === 'Acceptable'
                      ? 'bg-amber-50 border-amber-200 text-amber-950'
                      : 'bg-rose-50 border-rose-200 text-rose-950'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {qualityMetrics.quality_label === 'Good' && (
                        <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                      )}
                      {qualityMetrics.quality_label === 'Acceptable' && (
                        <AlertTriangle className="w-5 h-5 text-amber-600" />
                      )}
                      {qualityMetrics.quality_label === 'Poor' && (
                        <XCircle className="w-5 h-5 text-rose-600" />
                      )}
                      <div>
                        <div className="text-xs uppercase tracking-wider font-bold">
                          Image Quality Grade: {qualityMetrics.quality_label}
                        </div>
                        <div className="text-xs opacity-80">
                          {qualityMetrics.passed
                            ? 'Sufficient clarity and contrast for clinical deep learning preprocessing.'
                            : 'POOR QUALITY BLOCKED: Image fails diagnostic sharpness or lighting criteria.'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Reasons List */}
                  <div className="mt-3 text-xs space-y-1 pt-2 border-t border-black/10">
                    {qualityMetrics.reasons.map((r, i) => (
                      <div key={i} className="flex items-start gap-1.5">
                        <span className="opacity-70">•</span>
                        <span>{r}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Quantitative Metric Breakdown Table */}
                <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-3">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Computer Vision Diagnostic Metrics
                  </h4>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                      <div className="text-slate-400 text-[11px]">Blur (Laplacian Var)</div>
                      <div className="font-mono text-sm font-bold text-[#0B1F3A]">
                        {qualityMetrics.blur_laplacian}
                      </div>
                      <div className="text-[10px] text-slate-500">Threshold: ≥ 75</div>
                    </div>
                    <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                      <div className="text-slate-400 text-[11px]">Mean Luminance</div>
                      <div className="font-mono text-sm font-bold text-[#0B1F3A]">
                        {qualityMetrics.mean_brightness} / 255
                      </div>
                      <div className="text-[10px] text-slate-500">Range: 45 – 225</div>
                    </div>
                    <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                      <div className="text-slate-400 text-[11px]">Contrast Std Dev</div>
                      <div className="font-mono text-sm font-bold text-[#0B1F3A]">
                        {qualityMetrics.contrast_std}
                      </div>
                      <div className="text-[10px] text-slate-500">Threshold: ≥ 18</div>
                    </div>
                    <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                      <div className="text-slate-400 text-[11px]">Center Distinction</div>
                      <div className="font-mono text-sm font-bold text-[#0B1F3A]">
                        {qualityMetrics.center_contrast_ratio} Δ
                      </div>
                      <div className="text-[10px] text-slate-500">Lesion / Skin Delta</div>
                    </div>
                  </div>
                </div>

                {/* Actions: Retake vs Proceed to Preprocessing */}
                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setStep('input');
                      setRawImage(null);
                    }}
                    className="flex-1 px-4 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center justify-center gap-2 transition"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Retake / Choose Another
                  </button>

                  {qualityMetrics.passed ? (
                    <button
                      type="button"
                      onClick={() => setStep('preprocess')}
                      className="flex-1 px-4 py-2.5 rounded-xl bg-[#0E9F8E] hover:bg-[#0c8274] text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-xs transition"
                    >
                      <span>Proceed to Preprocessing</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <div className="flex-1 p-2 rounded-xl bg-rose-100 text-rose-800 text-[11px] text-center font-medium">
                      Blocked: Please retake in good lighting to proceed.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Preprocessing & Classical Lesion Segmentation Preview */}
        {step === 'preprocess' && preprocessing && segmentation && (
          <div className="space-y-6">
            <div className="bg-teal-50/70 border border-teal-200 p-4 rounded-xl flex items-start gap-3 text-xs text-teal-950">
              <Sparkles className="w-4 h-4 text-[#0E9F8E] shrink-0 mt-0.5" />
              <div>
                <strong>Deterministic Preprocessing Pipeline Verified:</strong>
                <p className="mt-0.5 opacity-90">
                  Image resized to 224×224 px, CLAHE-style contrast stretched, and color normalized. Classical Otsu thresholding identifies lesion area and boundary contour.
                </p>
              </div>
            </div>

            {/* Side by Side Comparative Visuals */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <div className="text-xs font-semibold text-slate-700">1. Raw Square Crop</div>
                <div className="rounded-xl overflow-hidden border border-slate-200 aspect-square bg-slate-900 flex items-center justify-center">
                  <img
                    src={preprocessing.originalDataUrl}
                    alt="Original raw"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="text-[11px] text-slate-400 text-center">Unmodified sensor acquisition</div>
              </div>

              <div className="space-y-2">
                <div className="text-xs font-semibold text-slate-700">2. Preprocessed (224×224)</div>
                <div className="rounded-xl overflow-hidden border border-slate-200 aspect-square bg-slate-900 flex items-center justify-center ring-2 ring-[#0E9F8E]/30">
                  <img
                    src={preprocessing.processedDataUrl}
                    alt="Preprocessed 224x224"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="text-[11px] text-slate-400 text-center">CLAHE + Color Normalized</div>
              </div>

              <div className="space-y-2">
                <div className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                  <span>3. Lesion Contour</span>
                  <span className="text-[10px] bg-slate-200 px-1.5 py-0.5 rounded text-slate-700 font-mono">
                    {segmentation.lesionAreaPercent}% area
                  </span>
                </div>
                <div className="rounded-xl overflow-hidden border border-slate-200 aspect-square bg-slate-900 flex items-center justify-center">
                  <img
                    src={segmentation.overlayDataUrl}
                    alt="Classical Otsu boundary contour"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="text-[11px] text-slate-400 text-center">Classical Otsu baseline</div>
              </div>
            </div>

            {/* Pipeline Documentation Step Breakdown */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-[#0E9F8E]" />
                Exact Preprocessing Pipeline Execution Log
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                {preprocessing.steps.map((s, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-slate-200/80"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <div>
                      <span className="font-semibold text-slate-800">{s.name}: </span>
                      <span className="text-slate-500 text-[11px]">{s.description}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Confirmation & Final Upload Action */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setStep('quality')}
                className="px-4 py-2 rounded-xl border border-slate-300 text-slate-600 hover:bg-slate-50 text-xs font-semibold transition"
              >
                Back to Quality Metrics
              </button>

              <button
                type="button"
                onClick={handleFinalConfirm}
                className="px-6 py-2.5 rounded-xl bg-[#0E9F8E] hover:bg-[#0c8274] text-white text-xs font-semibold flex items-center gap-2 shadow-sm transition active:scale-95"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Confirm & Attach to Clinical Case</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
