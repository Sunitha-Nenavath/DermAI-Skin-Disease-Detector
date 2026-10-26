import type { QualityMetrics, QualityLabel } from '../types';

export async function assessImageQuality(imageSource: HTMLImageElement | HTMLCanvasElement): Promise<QualityMetrics> {
  const width = imageSource.width;
  const height = imageSource.height;

  // 1. Resolution Check
  const reasons: string[] = [];
  let isPoor = false;
  let isAcceptable = false;

  if (width < 224 || height < 224) {
    reasons.push(`Resolution (${width}x${height}) is below clinical minimum of 224x224 px.`);
    isPoor = true;
  }

  // Draw onto analysis canvas (downsample to 512 for fast real-time client computation if huge)
  const analysisWidth = Math.min(width, 512);
  const analysisHeight = Math.round((height / width) * analysisWidth);

  const canvas = document.createElement('canvas');
  canvas.width = analysisWidth;
  canvas.height = analysisHeight;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  if (!ctx) {
    throw new Error('Canvas 2D context not available for quality assessment.');
  }

  ctx.drawImage(imageSource, 0, 0, analysisWidth, analysisHeight);
  const imgData = ctx.getImageData(0, 0, analysisWidth, analysisHeight);
  const data = imgData.data;
  const numPixels = analysisWidth * analysisHeight;

  // 2. Grayscale, Brightness & Contrast Calculation
  const gray = new Float32Array(numPixels);
  let sumLum = 0;
  let sumSqLum = 0;

  for (let i = 0; i < numPixels; i++) {
    const idx = i * 4;
    // Standard sRGB perceptual luminance
    const lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
    gray[i] = lum;
    sumLum += lum;
    sumSqLum += lum * lum;
  }

  const meanBrightness = Math.round(sumLum / numPixels);
  const varianceLum = Math.max(0, sumSqLum / numPixels - (meanBrightness * meanBrightness));
  const contrastStd = Math.round(Math.sqrt(varianceLum));

  // Brightness evaluation
  if (meanBrightness < 45) {
    reasons.push('Severe underexposure: image is too dark to resolve dermoscopic structures.');
    isPoor = true;
  } else if (meanBrightness < 65) {
    reasons.push('Borderline underexposure: consider increasing ambient illumination.');
    isAcceptable = true;
  } else if (meanBrightness > 225) {
    reasons.push('Severe overexposure: flash or specular reflection washed out lesion borders.');
    isPoor = true;
  } else if (meanBrightness > 205) {
    reasons.push('Borderline overexposure: mild specular reflections detected.');
    isAcceptable = true;
  }

  // Contrast evaluation
  if (contrastStd < 18) {
    reasons.push('Very low dynamic range/contrast: lesion boundaries cannot be delineated.');
    isPoor = true;
  } else if (contrastStd < 28) {
    reasons.push('Marginal dynamic range: contrast between skin and pigment is low.');
    isAcceptable = true;
  }

  // 3. Blur Detection via Variance of Laplacian
  // Standard discrete 3x3 Laplacian: [0, 1, 0; 1, -4, 1; 0, 1, 0]
  let laplacianSum = 0;
  let laplacianSqSum = 0;
  let countedPixels = 0;

  const w = analysisWidth;
  const h = analysisHeight;

  for (let y = 1; y < h - 1; y++) {
    const rowOffset = y * w;
    for (let x = 1; x < w - 1; x++) {
      const idx = rowOffset + x;
      const lap =
        gray[idx - w] +
        gray[idx + w] +
        gray[idx - 1] +
        gray[idx + 1] -
        4 * gray[idx];

      laplacianSum += lap;
      laplacianSqSum += lap * lap;
      countedPixels++;
    }
  }

  const meanLap = laplacianSum / countedPixels;
  const blurLaplacian = Math.round(Math.max(0, (laplacianSqSum / countedPixels) - (meanLap * meanLap)));

  if (blurLaplacian < 75) {
    reasons.push(`Motion blur or optical defocus detected (Laplacian score: ${blurLaplacian}, threshold: 75).`);
    isPoor = true;
  } else if (blurLaplacian < 125) {
    reasons.push(`Slight softness in focus (Laplacian score: ${blurLaplacian}).`);
    isAcceptable = true;
  }

  // 4. Center vs Peripheral Lesion Visibility Check
  // Compare center 50% box against outer border
  const centerXStart = Math.floor(w * 0.25);
  const centerXEnd = Math.floor(w * 0.75);
  const centerYStart = Math.floor(h * 0.25);
  const centerYEnd = Math.floor(h * 0.75);

  let centerSum = 0;
  let centerCount = 0;
  let borderSum = 0;
  let borderCount = 0;

  for (let y = 0; y < h; y++) {
    const row = y * w;
    const isYCenter = y >= centerYStart && y <= centerYEnd;
    for (let x = 0; x < w; x++) {
      const val = gray[row + x];
      if (isYCenter && x >= centerXStart && x <= centerXEnd) {
        centerSum += val;
        centerCount++;
      } else {
        borderSum += val;
        borderCount++;
      }
    }
  }

  const centerMean = centerSum / Math.max(1, centerCount);
  const borderMean = borderSum / Math.max(1, borderCount);
  const centerContrastRatio = Number((Math.abs(centerMean - borderMean)).toFixed(1));

  if (centerContrastRatio < 3.5 && !isPoor) {
    reasons.push('Lesion visibility check: low color distinction between center frame and periphery. Please center lesion in guide frame.');
    isAcceptable = true;
  }

  // Determine Final Label
  let qualityLabel: QualityLabel = 'Good';
  if (isPoor) {
    qualityLabel = 'Poor';
  } else if (isAcceptable) {
    qualityLabel = 'Acceptable';
  }

  if (reasons.length === 0) {
    reasons.push('Optimal focus, illumination, and color contrast suitable for clinical preprocessing.');
  }

  return {
    passed: qualityLabel !== 'Poor',
    quality_label: qualityLabel,
    blur_laplacian: blurLaplacian,
    mean_brightness: meanBrightness,
    contrast_std: contrastStd,
    mean_gray: meanBrightness,
    std_gray: contrastStd,
    width,
    height,
    center_contrast_ratio: centerContrastRatio,
    reasons,
  };
}

export function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to decode image file. Format may be corrupt or unsupported.'));
    };
    img.src = url;
  });
}
