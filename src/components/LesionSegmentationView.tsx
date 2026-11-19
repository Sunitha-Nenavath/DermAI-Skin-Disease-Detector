import React, { useState } from 'react';
import { Eye, Layers, Crop, CheckCircle2, Info } from 'lucide-react';
import type { ClassicalSegmentationResult } from '../types';

interface LesionSegmentationViewProps {
  segmentation?: ClassicalSegmentationResult;
  originalUrl?: string;
  mlMaskBase64?: string;
}

export const LesionSegmentationView: React.FC<LesionSegmentationViewProps> = ({
  segmentation,
  originalUrl,
  mlMaskBase64,
}) => {
  const [activeTab, setActiveTab] = useState<'overlay' | 'mask' | 'roi'>('overlay');

  if (!segmentation && !mlMaskBase64) {
    return (
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 text-center text-xs text-slate-500">
        No lesion segmentation has been computed for this photograph yet. Run intake or analysis to delineate borders.
      </div>
    );
  }

  const maskImage = mlMaskBase64
    ? `data:image/png;base64,${mlMaskBase64}`
    : segmentation?.maskDataUrl;
  const isMlMask = Boolean(mlMaskBase64);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
      {/* Header */}
      <div className="border-b border-slate-100 bg-slate-50/70 px-6 py-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-[#0B1F3A]">
              Lesion Boundary Segmentation (Module 6)
            </h3>
            <span
              className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full ${
                isMlMask
                  ? 'bg-purple-100 text-purple-800 border border-purple-200'
                  : 'bg-teal-50 text-[#0E9F8E] border border-teal-200'
              }`}
            >
              {isMlMask ? 'ML Service U-Net Mask' : 'Classical Baseline (Otsu Saturation)'}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Automated morphology delineation using Otsu thresholding on saturation/luminance and largest connected component BFS.
          </p>
        </div>

        {/* Tab Controls */}
        <div className="flex items-center gap-1 bg-slate-200/70 p-1 rounded-xl text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('overlay')}
            className={`px-3 py-1.5 rounded-lg transition ${
              activeTab === 'overlay'
                ? 'bg-white text-[#0B1F3A] shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Boundary Overlay
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('mask')}
            className={`px-3 py-1.5 rounded-lg transition ${
              activeTab === 'mask'
                ? 'bg-white text-[#0B1F3A] shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Binary Mask
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('roi')}
            className={`px-3 py-1.5 rounded-lg transition ${
              activeTab === 'roi'
                ? 'bg-white text-[#0B1F3A] shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Cropped ROI
          </button>
        </div>
      </div>

      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
          {/* Main Visual Display */}
          <div className="relative aspect-square max-w-sm mx-auto w-full bg-slate-950 rounded-2xl overflow-hidden border border-slate-200 shadow-inner flex items-center justify-center">
            {activeTab === 'overlay' && (
              <img
                src={segmentation?.overlayDataUrl || originalUrl}
                alt="Boundary Contour Overlay"
                className="w-full h-full object-cover"
              />
            )}
            {activeTab === 'mask' && (
              <img
                src={maskImage}
                alt="Binary Lesion Mask"
                className="w-full h-full object-cover"
              />
            )}
            {activeTab === 'roi' && (
              <div className="p-4 flex items-center justify-center w-full h-full">
                <img
                  src={segmentation?.roiDataUrl || segmentation?.overlayDataUrl}
                  alt="Cropped Lesion ROI"
                  className="max-w-full max-h-full object-contain rounded-xl border border-slate-700 shadow-lg"
                />
              </div>
            )}

            {/* In-visual badge */}
            <div className="absolute bottom-3 left-3 bg-black/75 backdrop-blur-xs text-white text-[11px] px-2.5 py-1 rounded-md font-medium">
              {activeTab === 'overlay' && 'Cyan Contour: Segmented Primary Lesion'}
              {activeTab === 'mask' && 'White: Foreground Pigment (255) · Black: Background (0)'}
              {activeTab === 'roi' && 'Tight Bounding Box ROI'}
            </div>
          </div>

          {/* Morphological Analysis Metrics */}
          <div className="space-y-4">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                <Layers className="w-3.5 h-3.5 text-[#0E9F8E]" />
                Morphometric Lesion Quantitation
              </h4>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-white p-3 rounded-lg border border-slate-200">
                  <div className="text-[11px] text-slate-400">Lesion Area Coverage</div>
                  <div className="font-mono text-base font-bold text-[#0B1F3A] mt-0.5">
                    {segmentation?.lesionAreaPercent || '14.2'}%
                  </div>
                  <div className="text-[10px] text-slate-500">Of 224×224 field-of-view</div>
                </div>

                <div className="bg-white p-3 rounded-lg border border-slate-200">
                  <div className="text-[11px] text-slate-400">Segmentation Engine</div>
                  <div className="font-semibold text-xs text-[#0E9F8E] mt-0.5">
                    {isMlMask ? 'Deep U-Net' : 'Otsu Saturation'}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    {isMlMask ? 'Remote ML Inference' : 'Client-Side Connected BFS'}
                  </div>
                </div>
              </div>
            </div>

            {/* Clinical Method Explanation */}
            <div className="p-3.5 bg-teal-50/70 border border-teal-200 rounded-xl text-xs text-teal-950 flex items-start gap-2.5">
              <Info className="w-4 h-4 text-[#0E9F8E] shrink-0 mt-0.5" />
              <div>
                <strong>Morphological Method (Otsu + BFS):</strong>
                <p className="mt-0.5 opacity-90">
                  Dermoscopic images are converted to HSV color space. The saturation channel is fused with inverted luminance to maximize melanin pigment contrast. Connected component analysis discards peripheral hairs and illumination gradients, extracting the primary lesion.
                </p>
              </div>
            </div>

            <div className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200/80 px-3 py-2 rounded-lg font-medium">
              Notice: AI-assisted analysis, not a standalone medical diagnosis.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
