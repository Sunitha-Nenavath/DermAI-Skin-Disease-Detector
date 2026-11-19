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
  Layers,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import { assessImageQuality, loadImageFromFile } from '../services/imageQuality';
import { preprocessLesionImage } from '../services/preprocessing';
import { runClassicalLesionSegmentation } from '../services/segmentation';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { notificationService } from '../services/notificationService';
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
}) => {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [step, setStep] = useState<WorkflowStep>('input');
  const [mode, setMode] = useState<'camera' | 'gallery'>('gallery');
  const [consentGiven, setConsentGiven] = useState<boolean>(
    () => localStorage.getItem('dermai_clinical_consent') === 'true'
  );

  // Camera stream state
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Loaded raw image + rotation & crop transform
  const [rawImage, setRawImage] = useState<HTMLImageElement | null>(null);
  const [rotationAngle, setRotationAngle] = useState<number>(0);
  const [cropZoom, setCropZoom] = useState<number>(100); // 60..100% square crop
  const [cropOffsetX, setCropOffsetX] = useState<number>(0); // -50..50
  const [cropOffsetY, setCropOffsetY] = useState<number>(0); // -50..50
  const [croppedPreviewUrl, setCroppedPreviewUrl] = useState<string | null>(null);

  const [dragActive, setDragActive] = useState<boolean>(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Assessment results
  const [qualityMetrics, setQualityMetrics] = useState<QualityMetrics | null>(null);
  const [preprocessing, setPreprocessing] = useState<PreprocessingResult | null>(null);
  const [segmentation, setSegmentation] = useState<ClassicalSegmentationResult | null>(null);

  const handleToggleConsent = (checked: boolean) => {
    setConsentGiven(checked);
    localStorage.setItem('dermai_clinical_consent', String(checked));
  };

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
        await videoRef.current.play();
      }
    } catch {
      setCameraError('Unable to access rear camera. Please verify browser permissions or use file upload.');
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
  };

  useEffect(() => {
    if (mode === 'camera' && consentGiven && step === 'input') {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [mode, consentGiven, step]);

  // Build transformed (rotated + cropped) source canvas
  const buildTransformedCanvas = (
    img: HTMLImageElement,
    angle: number,
    zoomPct: number,
    offsetX: number,
    offsetY: number
  ): HTMLCanvasElement => {
    const rotCanvas = document.createElement('canvas');
    if (angle === 90 || angle === 270) {
      rotCanvas.width = img.height;
      rotCanvas.height = img.width;
    } else {
      rotCanvas.width = img.width;
      rotCanvas.height = img.height;
    }
    const rCtx = rotCanvas.getContext('2d')!;
    rCtx.translate(rotCanvas.width / 2, rotCanvas.height / 2);
    rCtx.rotate((angle * Math.PI) / 180);
    rCtx.drawImage(img, -img.width / 2, -img.height / 2);

    if (zoomPct >= 100 && offsetX === 0 && offsetY === 0) {
      return rotCanvas;
    }

    const minDim = Math.min(rotCanvas.width, rotCanvas.height);
    const cropSize = Math.max(224, Math.round(minDim * (zoomPct / 100)));
    const maxShiftX = Math.max(0, (rotCanvas.width - cropSize) / 2);
    const maxShiftY = Math.max(0, (rotCanvas.height - cropSize) / 2);
    const sx = Math.max(0, Math.min(rotCanvas.width - cropSize, Math.round(rotCanvas.width / 2 - cropSize / 2 + (offsetX / 50) * maxShiftX)));
    const sy = Math.max(0, Math.min(rotCanvas.height - cropSize, Math.round(rotCanvas.height / 2 - cropSize / 2 + (offsetY / 50) * maxShiftY)));

    const cropCanvas = document.createElement('canvas');
    cropCanvas.width = cropSize;
    cropCanvas.height = cropSize;
    cropCanvas.getContext('2d')!.drawImage(rotCanvas, sx, sy, cropSize, cropSize, 0, 0, cropSize, cropSize);
    return cropCanvas;
  };

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
      setCropZoom(100);
      setCropOffsetX(0);
      setCropOffsetY(0);
      runAssessmentPipeline(img, 0, 100, 0, 0);
    };
    img.src = canvas.toDataURL('image/jpeg', 0.95);
  };

  const handleFileSelection = async (file: File) => {
    setValidationError(null);

    if (!consentGiven) {
      setValidationError('Please accept the clinical screening consent statement before uploading an image.');
      return;
    }

    const validTypes = ['image/jpeg', 'image/png', 'image/jpg'];
    if (!validTypes.includes(file.type)) {
      setValidationError('Unsupported format. Please supply a JPEG or PNG lesion photograph.');
      return;
    }

    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      setValidationError(`File size ${(file.size / (1024 * 1024)).toFixed(1)} MB exceeds the 10 MB limit.`);
      return;
    }

    try {
      const img = await loadImageFromFile(file);
      if (img.width < 224 || img.height < 224) {
        setValidationError(`Resolution (${img.width}x${img.height}) is below the 224x224 px minimum.`);
        return;
      }

      setRawImage(img);
      setRotationAngle(0);
      setCropZoom(100);
      setCropOffsetX(0);
      setCropOffsetY(0);
      runAssessmentPipeline(img, 0, 100, 0, 0);
    } catch (err: any) {
      setValidationError(err.message || 'Failed to decode image file.');
    }
  };

  const runAssessmentPipeline = async (
    img: HTMLImageElement,
    angle: number,
    zoomPct: number,
    offX: number,
    offY: number
  ) => {
    setValidationError(null);
    try {
      const activeSource = buildTransformedCanvas(img, angle, zoomPct, offX, offY);
      setCroppedPreviewUrl(activeSource.toDataURL('image/jpeg', 0.92));

      const quality = await assessImageQuality(activeSource);
      setQualityMetrics(quality);

      if (!quality.passed) {
        showToast({
          title: 'Poor Image Quality Blocked',
          message: quality.reasons[0] || 'Please retake image with better lighting and focus.',
          level: 'Medium',
        });
        if (user) {
          notificationService.createNotification({
            user_id: user.uid,
            title: 'Poor Image Quality Detected',
            message: quality.reasons[0] || 'Image failed sharpness/illumination gate and requires retake.',
            level: 'Medium',
          }).catch(() => {});
        }
      }

      const prep = preprocessLesionImage(activeSource, {
        targetSize: 224,
        contrastEnhance: true,
        normalizeColor: true,
      });
      setPreprocessing(prep);

      const seg = runClassicalLesionSegmentation(activeSource);
      setSegmentation(seg);

      setStep('quality');
    } catch (err: any) {
      setValidationError('Processing error: ' + err.message);
    }
  };

  const handleRotate = () => {
    if (!rawImage) return;
    const newAngle = (rotationAngle + 90) % 360;
    setRotationAngle(newAngle);
    runAssessmentPipeline(rawImage, newAngle, cropZoom, cropOffsetX, cropOffsetY);
  };

  const handleApplyCrop = () => {
    if (!rawImage) return;
    runAssessmentPipeline(rawImage, rotationAngle, cropZoom, cropOffsetX, cropOffsetY);
  };

  const handleFinalConfirm = async () => {
    if (!rawImage || !qualityMetrics || !preprocessing || !segmentation) return;
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
            Clinical Image Acquisition &amp; Quality Verification
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Flow: Capture → Quality Check → Crop &amp; Rotate → User Confirmation → Upload → Analysis
          </p>
        </div>

        <div className="flex items-center gap-1.5 text-xs">
          <span className={`px-2.5 py-1 rounded-md font-medium ${step === 'input' ? 'bg-[#0E9F8E] text-white' : 'bg-slate-200 text-slate-700'}`}>
            1. Capture
          </span>
          <span className="text-slate-300">→</span>
          <span className={`px-2.5 py-1 rounded-md font-medium ${step === 'quality' ? 'bg-[#0E9F8E] text-white' : 'bg-slate-100 text-slate-500'}`}>
            2. Quality &amp; Crop
          </span>
          <span className="text-slate-300">→</span>
          <span className={`px-2.5 py-1 rounded-md font-medium ${step === 'preprocess' ? 'bg-[#0E9F8E] text-white' : 'bg-slate-100 text-slate-500'}`}>
            3. Preprocessing
          </span>
        </div>
      </div>

      <div className="p-6">
        {/* Step 1: Input / Capture Mode */}
        {step === 'input' && (
          <div className="space-y-5">
            {/* Module 15 Consent Gate before first upload */}
            {!consentGiven && (
              <div className="p-4 bg-teal-50 border border-teal-200 rounded-2xl space-y-2 text-xs">
                <div className="flex items-center gap-2 font-bold text-[#0B1F3A]">
                  <ShieldCheck className="w-4 h-4 text-[#0E9F8E]" />
                  <span>Required Clinical Triage Consent (Before First Upload)</span>
                </div>
                <label className="flex items-start gap-2.5 cursor-pointer text-slate-700">
                  <input
                    type="checkbox"
                    checked={consentGiven}
                    onChange={(e) => handleToggleConsent(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded accent-[#0E9F8E]"
                  />
                  <span>
                    I acknowledge that DermAI provides <strong>AI-assisted analysis, not a standalone medical diagnosis</strong>, and that only public or de-identified demo images should be uploaded.
                  </span>
                </label>
              </div>
            )}

            <div className="flex items-center gap-2 border-b border-slate-100 pb-4">
              <button
                type="button"
                onClick={() => setMode('gallery')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition ${
                  mode === 'gallery' ? 'bg-[#0B1F3A] text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <Upload className="w-3.5 h-3.5" />
                Upload Photo / Gallery
              </button>
              <button
                type="button"
                onClick={() => setMode('camera')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition ${
                  mode === 'camera' ? 'bg-[#0E9F8E] text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <Camera className="w-3.5 h-3.5" />
                Rear Camera Capture
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
                  dragActive ? 'border-[#0E9F8E] bg-teal-50/50 scale-[0.99]' : 'border-slate-200 hover:border-slate-300 bg-slate-50/40'
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
                  className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold shadow-xs transition ${
                    consentGiven ? 'cursor-pointer bg-[#0E9F8E] hover:bg-[#0c8274] text-white' : 'cursor-not-allowed bg-slate-300 text-slate-600'
                  }`}
                >
                  Choose Skin Lesion Image
                </label>
                <p className="text-xs text-slate-500 mt-3">
                  or drag and drop here (JPEG/PNG, min 224x224 px, up to 10 MB)
                </p>

                <div className="mt-6 pt-4 border-t border-slate-200/60 flex flex-wrap items-center justify-center gap-4 text-[11px] text-slate-400">
                  <span>✓ EXIF orientation normalized</span>
                  <span>✓ Interactive Crop &amp; Rotate</span>
                  <span>✓ Client-side quality filter</span>
                </div>
              </div>
            )}

            {mode === 'camera' && (
              <div className="relative rounded-2xl bg-black overflow-hidden aspect-4/3 max-w-lg mx-auto shadow-inner">
                {!consentGiven ? (
                  <div className="h-full flex items-center justify-center p-6 text-center text-xs text-slate-300">
                    Accept the consent notice above to enable rear camera capture.
                  </div>
                ) : cameraError ? (
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
                    <video ref={videoRef} playsInline muted className="w-full h-full object-cover" />
                    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                      <div className="w-56 h-56 border-2 border-[#00F0FF] rounded-2xl relative shadow-[0_0_20px_rgba(0,240,255,0.3)]">
                        <div className="absolute -top-1 -left-1 w-4 h-4 border-t-4 border-l-4 border-white" />
                        <div className="absolute -top-1 -right-1 w-4 h-4 border-t-4 border-r-4 border-white" />
                        <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-4 border-l-4 border-white" />
                        <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-4 border-r-4 border-white" />
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 bg-white/70 rounded-full border border-black/40" />
                      </div>
                    </div>
                    <div className="absolute top-3 left-3 right-3 text-center pointer-events-none">
                      <span className="inline-block bg-black/70 text-white text-[11px] px-3 py-1 rounded-full font-medium">
                        Center skin lesion inside the guide frame (10–15 cm distance)
                      </span>
                    </div>
                    <div className="absolute bottom-4 inset-x-0 flex justify-center">
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

        {/* Step 2: Quality Assessment Results + Rotate & Crop Controls */}
        {step === 'quality' && qualityMetrics && rawImage && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
              <div className="space-y-3">
                <div className="relative rounded-2xl overflow-hidden border border-slate-200 bg-slate-900 aspect-square flex items-center justify-center">
                  <img
                    src={croppedPreviewUrl || rawImage.src}
                    alt="Captured lesion"
                    className="max-h-full max-w-full object-contain"
                  />
                  <div className="absolute bottom-3 right-3 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleRotate}
                      className="px-3 py-1.5 bg-black/75 hover:bg-black text-white text-xs rounded-lg flex items-center gap-1.5 transition font-medium"
                    >
                      <RotateCw className="w-3.5 h-3.5" />
                      Rotate 90°
                    </button>
                  </div>
                </div>

                {/* Interactive Crop Tool */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2.5 text-xs">
                  <div className="flex items-center justify-between font-bold text-slate-700">
                    <span className="flex items-center gap-1.5">
                      <Crop className="w-3.5 h-3.5 text-[#0E9F8E]" />
                      Interactive Region Crop
                    </span>
                    <span className="font-mono text-[#0E9F8E]">{cropZoom}% ROI</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <label className="text-[11px] text-slate-500">
                      Zoom ({cropZoom}%)
                      <input
                        type="range"
                        min={60}
                        max={100}
                        step={5}
                        value={cropZoom}
                        onChange={(e) => setCropZoom(Number(e.target.value))}
                        className="w-full accent-[#0E9F8E]"
                      />
                    </label>
                    <label className="text-[11px] text-slate-500">
                      Pan X ({cropOffsetX})
                      <input
                        type="range"
                        min={-50}
                        max={50}
                        step={5}
                        value={cropOffsetX}
                        onChange={(e) => setCropOffsetX(Number(e.target.value))}
                        className="w-full accent-[#0E9F8E]"
                      />
                    </label>
                    <label className="text-[11px] text-slate-500">
                      Pan Y ({cropOffsetY})
                      <input
                        type="range"
                        min={-50}
                        max={50}
                        step={5}
                        value={cropOffsetY}
                        onChange={(e) => setCropOffsetY(Number(e.target.value))}
                        className="w-full accent-[#0E9F8E]"
                      />
                    </label>
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] text-slate-500">
                      {qualityMetrics.width} × {qualityMetrics.height} px · {rotationAngle}°
                    </span>
                    <button
                      type="button"
                      onClick={handleApplyCrop}
                      className="px-3 py-1 bg-[#0B1F3A] text-white rounded-lg text-[11px] font-semibold hover:bg-[#152e52]"
                    >
                      Apply Crop &amp; Re-Check Quality
                    </button>
                  </div>
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
                  <div className="flex items-center gap-2">
                    {qualityMetrics.quality_label === 'Good' && <CheckCircle2 className="w-5 h-5 text-emerald-600" />}
                    {qualityMetrics.quality_label === 'Acceptable' && <AlertTriangle className="w-5 h-5 text-amber-600" />}
                    {qualityMetrics.quality_label === 'Poor' && <XCircle className="w-5 h-5 text-rose-600" />}
                    <div>
                      <div className="text-xs uppercase tracking-wider font-bold">
                        Image Quality Grade: {qualityMetrics.quality_label}
                      </div>
                      <div className="text-xs opacity-80">
                        {qualityMetrics.passed
                          ? 'Sufficient clarity and contrast for clinical preprocessing.'
                          : 'POOR QUALITY BLOCKED: Please retake with steady focus and even lighting.'}
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 text-xs space-y-1 pt-2 border-t border-black/10">
                    {qualityMetrics.reasons.map((r, i) => (
                      <div key={i} className="flex items-start gap-1.5">
                        <span className="opacity-70">•</span>
                        <span>{r}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-3">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Client-Side Quality Metrics
                  </h4>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                      <div className="text-slate-400 text-[11px]">Blur (Laplacian Var)</div>
                      <div className="font-mono text-sm font-bold text-[#0B1F3A]">{qualityMetrics.blur_laplacian}</div>
                      <div className="text-[10px] text-slate-500">Threshold: ≥ 75</div>
                    </div>
                    <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                      <div className="text-slate-400 text-[11px]">Mean Luminance</div>
                      <div className="font-mono text-sm font-bold text-[#0B1F3A]">{qualityMetrics.mean_brightness} / 255</div>
                      <div className="text-[10px] text-slate-500">Range: 45 – 225</div>
                    </div>
                    <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                      <div className="text-slate-400 text-[11px]">Contrast Std Dev</div>
                      <div className="font-mono text-sm font-bold text-[#0B1F3A]">{qualityMetrics.contrast_std}</div>
                      <div className="text-[10px] text-slate-500">Threshold: ≥ 18</div>
                    </div>
                    <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                      <div className="text-slate-400 text-[11px]">Center Distinction</div>
                      <div className="font-mono text-sm font-bold text-[#0B1F3A]">{qualityMetrics.center_contrast_ratio} Δ</div>
                      <div className="text-[10px] text-slate-500">Lesion / Skin Delta</div>
                    </div>
                  </div>
                </div>

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
                      Blocked: Retake required to proceed.
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
                <strong>Exact Pipeline Verified:</strong>
                <p className="mt-0.5 opacity-90">
                  Raw → Validation → Quality → Crop → Resize (224×224) → Normalization (CLAHE + Color Stretch) → Model Input.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <div className="text-xs font-semibold text-slate-700">1. Original / Cropped</div>
                <div className="rounded-xl overflow-hidden border border-slate-200 aspect-square bg-slate-900 flex items-center justify-center">
                  <img src={preprocessing.originalDataUrl} alt="Original raw" className="w-full h-full object-cover" />
                </div>
                <div className="text-[11px] text-slate-400 text-center">EXIF &amp; Crop Normalized</div>
              </div>

              <div className="space-y-2">
                <div className="text-xs font-semibold text-slate-700">2. Preprocessed (224×224)</div>
                <div className="rounded-xl overflow-hidden border border-slate-200 aspect-square bg-slate-900 flex items-center justify-center ring-2 ring-[#0E9F8E]/30">
                  <img src={preprocessing.processedDataUrl} alt="Preprocessed 224x224" className="w-full h-full object-cover" />
                </div>
                <div className="text-[11px] text-slate-400 text-center">CLAHE + Color Normalized</div>
              </div>

              <div className="space-y-2">
                <div className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                  <span>3. Classical Baseline Mask</span>
                  <span className="text-[10px] bg-slate-200 px-1.5 py-0.5 rounded text-slate-700 font-mono">
                    {segmentation.lesionAreaPercent}% area
                  </span>
                </div>
                <div className="rounded-xl overflow-hidden border border-slate-200 aspect-square bg-slate-900 flex items-center justify-center">
                  <img src={segmentation.overlayDataUrl} alt="Classical Otsu boundary contour" className="w-full h-full object-cover" />
                </div>
                <div className="text-[11px] text-slate-400 text-center">Otsu Threshold + Largest Component</div>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-[#0E9F8E]" />
                Preprocessing Pipeline Log
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                {preprocessing.steps.map((s, idx) => (
                  <div key={idx} className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-slate-200/80">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <div>
                      <span className="font-semibold text-slate-800">{s.name}: </span>
                      <span className="text-slate-500 text-[11px]">{s.description}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setStep('quality')}
                className="px-4 py-2 rounded-xl border border-slate-300 text-slate-600 hover:bg-slate-50 text-xs font-semibold transition"
              >
                Back to Quality &amp; Crop
              </button>

              <button
                type="button"
                onClick={handleFinalConfirm}
                className="px-6 py-2.5 rounded-xl bg-[#0E9F8E] hover:bg-[#0c8274] text-white text-xs font-semibold flex items-center gap-2 shadow-sm transition active:scale-95"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Confirm, Upload &amp; Analyze</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
