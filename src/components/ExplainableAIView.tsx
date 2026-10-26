import React, { useState, useEffect } from 'react';
import { Eye, Layers, Sliders, Info, ShieldAlert, Sparkles, Split } from 'lucide-react';
import { mlService } from '../services/mlService';

interface ExplainableAIViewProps {
  originalUrl: string;
  preprocessedUrl?: string;
  maskUrl?: string;
  heatmapUrl?: string;
}

export const ExplainableAIView: React.FC<ExplainableAIViewProps> = ({
  originalUrl,
  preprocessedUrl,
  maskUrl,
  heatmapUrl,
}) => {
  const [opacity, setOpacity] = useState<number>(65);
  const [viewMode, setViewMode] = useState<'blend' | 'sideBySide'>('blend');
  const [computedHeatmap, setComputedHeatmap] = useState<string | null>(heatmapUrl || null);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    if (heatmapUrl) {
      setComputedHeatmap(heatmapUrl);
      return;
    }

    // Generate local explainability saliency if remote heatmap is not passed
    const generate = async () => {
      setIsGenerating(true);
      try {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = async () => {
          const map = await mlService.generateSaliencyHeatmap(img, maskUrl);
          setComputedHeatmap(map);
          setIsGenerating(false);
        };
        img.src = preprocessedUrl || originalUrl;
      } catch (e) {
        console.warn('Explainable AI generation error:', e);
        setIsGenerating(false);
      }
    };

    if (originalUrl) {
      generate();
    }
  }, [originalUrl, preprocessedUrl, heatmapUrl, maskUrl]);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
      {/* Header */}
      <div className="border-b border-slate-100 bg-slate-50/70 px-6 py-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-[#0B1F3A]">
              Explainable AI (XAI) & Grad-CAM Interpretability (Module 8)
            </h3>
            <span className="text-[10px] bg-purple-100 text-purple-800 border border-purple-200 px-2 py-0.5 rounded-full uppercase font-bold tracking-wider">
              Feature Saliency
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Class activation map (CAM) visualizes the spatial dermoscopic structures that contributed to the model's posterior weights.
          </p>
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center gap-1 bg-slate-200/70 p-1 rounded-xl text-xs font-semibold">
          <button
            type="button"
            onClick={() => setViewMode('blend')}
            className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
              viewMode === 'blend'
                ? 'bg-white text-[#0B1F3A] shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Interactive Overlay</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('sideBySide')}
            className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
              viewMode === 'sideBySide'
                ? 'bg-white text-[#0B1F3A] shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Split className="w-3.5 h-3.5" />
            <span>4-Panel Quad View</span>
          </button>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Mode A: Interactive Blended Overlay with Opacity Slider */}
        {viewMode === 'blend' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            {/* Visual Display Stack */}
            <div className="relative aspect-square max-w-md mx-auto w-full bg-slate-950 rounded-2xl overflow-hidden border border-slate-200 shadow-inner flex items-center justify-center">
              {/* Layer 1: Base Preprocessed Lesion Image */}
              <img
                src={preprocessedUrl || originalUrl}
                alt="Base Lesion"
                className="w-full h-full object-cover"
              />

              {/* Layer 2: Explainable AI Heatmap with Dynamic Opacity */}
              {computedHeatmap && (
                <img
                  src={computedHeatmap}
                  alt="Saliency Heatmap"
                  style={{ opacity: opacity / 100 }}
                  className="absolute inset-0 w-full h-full object-cover mix-blend-screen transition-opacity duration-150 pointer-events-none"
                />
              )}

              {/* In-canvas Label */}
              <div className="absolute bottom-3 left-3 bg-black/75 backdrop-blur-xs text-white text-[11px] px-3 py-1 rounded-md font-medium flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Heatmap Overlay ({opacity}% Opacity)</span>
              </div>
            </div>

            {/* Slider & Explanation Controls */}
            <div className="space-y-5">
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase tracking-wider">
                    <Sliders className="w-4 h-4 text-[#0E9F8E]" />
                    <span>Heatmap Opacity Control</span>
                  </div>
                  <span className="font-mono text-xs font-bold bg-white px-2.5 py-1 rounded-lg border border-slate-200 text-[#0B1F3A]">
                    {opacity}%
                  </span>
                </div>

                <input
                  type="range"
                  min="0"
                  max="100"
                  value={opacity}
                  onChange={(e) => setOpacity(Number(e.target.value))}
                  className="w-full accent-[#0E9F8E] cursor-pointer"
                />

                <div className="flex justify-between text-[11px] text-slate-400">
                  <span>0% (Raw Lesion)</span>
                  <span>50% (Balanced)</span>
                  <span>100% (Pure CAM)</span>
                </div>
              </div>

              {/* Colormap Legend */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2">
                <div className="text-xs font-semibold text-slate-700">
                  Attribution Colormap Spectrum
                </div>
                <div className="h-3 w-full rounded-full bg-gradient-to-r from-blue-600 via-cyan-400 via-yellow-400 to-red-600 shadow-inner" />
                <div className="flex justify-between text-[10px] text-slate-500 font-medium">
                  <span>Low Activation (Normal Skin)</span>
                  <span>Maximum Influence (Pigment Core)</span>
                </div>
              </div>

              {/* Required Non-Diagnosis Legal/Clinical Note */}
              <div className="p-4 bg-amber-50/80 border border-amber-200 rounded-xl text-xs text-amber-900 space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <Info className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Clinical Interpretability Advisory:</span>
                </div>
                <p className="opacity-90 leading-relaxed">
                  "The heatmap shows image regions that influenced the model. It is not proof of clinical correctness."
                </p>
              </div>
            </div>
          </div>
        ) : (
          /* Mode B: 4-Panel Side-by-Side Comparison */
          <div className="space-y-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-2">
                <div className="text-xs font-bold text-slate-700">1. Original Image</div>
                <div className="rounded-xl overflow-hidden border border-slate-200 aspect-square bg-slate-900">
                  <img src={originalUrl} alt="Original" className="w-full h-full object-cover" />
                </div>
                <div className="text-[11px] text-slate-400 text-center">Unmodified Mobile Photo</div>
              </div>

              <div className="space-y-2">
                <div className="text-xs font-bold text-slate-700">2. Preprocessed 224x224</div>
                <div className="rounded-xl overflow-hidden border border-slate-200 aspect-square bg-slate-900">
                  <img src={preprocessedUrl || originalUrl} alt="Preprocessed" className="w-full h-full object-cover" />
                </div>
                <div className="text-[11px] text-slate-400 text-center">CLAHE + Color Standardized</div>
              </div>

              <div className="space-y-2">
                <div className="text-xs font-bold text-slate-700">3. Lesion Mask</div>
                <div className="rounded-xl overflow-hidden border border-slate-200 aspect-square bg-slate-900">
                  {maskUrl ? (
                    <img src={maskUrl} alt="Mask" className="w-full h-full object-cover" />
                  ) : (
                    <div className="h-full flex items-center justify-center text-xs text-slate-500">
                      Segmenting...
                    </div>
                  )}
                </div>
                <div className="text-[11px] text-slate-400 text-center">Foreground Morphology</div>
              </div>

              <div className="space-y-2">
                <div className="text-xs font-bold text-slate-700">4. AI Saliency Heatmap</div>
                <div className="rounded-xl overflow-hidden border border-slate-200 aspect-square bg-slate-900">
                  {computedHeatmap ? (
                    <img src={computedHeatmap} alt="Heatmap" className="w-full h-full object-cover" />
                  ) : (
                    <div className="h-full flex items-center justify-center text-xs text-slate-500">
                      Computing...
                    </div>
                  )}
                </div>
                <div className="text-[11px] text-slate-400 text-center">Grad-CAM Feature Activation</div>
              </div>
            </div>

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900">
              <strong>Notice:</strong> The heatmap shows image regions that influenced the model. It is not proof of clinical correctness. AI-assisted analysis, not a standalone medical diagnosis.
            </div>
          </div>
        )}

        {/* Mandatory Clinical Decision Support Disclaimer */}
        <div className="p-3 bg-teal-50/60 border border-teal-200/80 rounded-xl text-xs text-teal-950 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-[#0E9F8E] shrink-0" />
            <span className="font-medium">
              Notice: AI-assisted analysis, not a standalone medical diagnosis.
            </span>
          </div>
          <span className="text-[11px] text-slate-400">Decision-Support Transparency</span>
        </div>
      </div>
    </div>
  );
};
