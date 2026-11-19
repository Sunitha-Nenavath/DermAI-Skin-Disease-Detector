import type { ClassicalSegmentationResult } from '../types';

export function runClassicalLesionSegmentation(
  imageSource: HTMLImageElement | HTMLCanvasElement
): ClassicalSegmentationResult {
  const width = 224;
  const height = 224;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Cannot get 2D context for segmentation');

  ctx.drawImage(imageSource, 0, 0, width, height);
  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;
  const totalPixels = width * height;

  // 1. Extract Saturation (S) channel from HSV & Inverted Grayscale
  // Pigmented lesions have distinct saturation and darker luminance
  const satValues = new Uint8Array(totalPixels);
  const histogram = new Uint32Array(256);

  for (let i = 0; i < totalPixels; i++) {
    const r = data[i * 4] / 255;
    const g = data[i * 4 + 1] / 255;
    const b = data[i * 4 + 2] / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;

    const s = max === 0 ? 0 : delta / max;
    // Combine Saturation with inverted luminance (darker lesions produce higher values)
    const gray = 0.299 * r + 0.587 * g + 0.114 * b;
    const invLum = 1.0 - gray;

    // Weighted fusion: 0.65 saturation + 0.35 inverted luminance
    const combined = Math.min(255, Math.max(0, Math.round((s * 0.65 + invLum * 0.35) * 255)));
    satValues[i] = combined;
    histogram[combined]++;
  }

  // 2. Otsu Automated Threshold Calculation
  let sumTotal = 0;
  for (let t = 0; t < 256; t++) {
    sumTotal += t * histogram[t];
  }

  let sumBackground = 0;
  let weightBackground = 0;
  let maxVariance = 0;
  let threshold = 128;

  for (let t = 0; t < 256; t++) {
    weightBackground += histogram[t];
    if (weightBackground === 0) continue;

    const weightForeground = totalPixels - weightBackground;
    if (weightForeground === 0) break;

    sumBackground += t * histogram[t];
    const meanBackground = sumBackground / weightBackground;
    const meanForeground = (sumTotal - sumBackground) / weightForeground;

    // Inter-class variance
    const variance = weightBackground * weightForeground * Math.pow(meanBackground - meanForeground, 2);

    if (variance > maxVariance) {
      maxVariance = variance;
      threshold = t;
    }
  }

  // 3. Binary Thresholding
  const binaryMask = new Uint8Array(totalPixels);
  for (let i = 0; i < totalPixels; i++) {
    binaryMask[i] = satValues[i] >= threshold ? 1 : 0;
  }

  // 4. Connected Component Analysis (BFS) to find Largest Connected Lesion
  const visited = new Uint8Array(totalPixels);
  let maxComponentSize = 0;
  let bestComponentIndices: number[] = [];

  const neighbors = [-1, 1, -width, width];

  for (let i = 0; i < totalPixels; i++) {
    if (binaryMask[i] === 1 && visited[i] === 0) {
      // Start BFS
      const currentIndices: number[] = [];
      const queue: number[] = [i];
      visited[i] = 1;

      while (queue.length > 0) {
        const curr = queue.pop()!;
        currentIndices.push(curr);

        const currX = curr % width;
        const currY = Math.floor(curr / width);

        // Check 4-connected neighbors
        for (const n of neighbors) {
          const next = curr + n;
          if (next >= 0 && next < totalPixels && visited[next] === 0 && binaryMask[next] === 1) {
            const nextX = next % width;
            const nextY = Math.floor(next / width);
            if (Math.abs(currX - nextX) + Math.abs(currY - nextY) === 1) {
              visited[next] = 1;
              queue.push(next);
            }
          }
        }
      }

      if (currentIndices.length > maxComponentSize) {
        maxComponentSize = currentIndices.length;
        bestComponentIndices = currentIndices;
      }
    }
  }

  // Generate Clean Mask with only the largest lesion component
  const finalMask = new Uint8Array(totalPixels);
  let minX = width, maxX = 0, minY = height, maxY = 0;

  for (const idx of bestComponentIndices) {
    finalMask[idx] = 255;
    const px = idx % width;
    const py = Math.floor(idx / width);
    if (px < minX) minX = px;
    if (px > maxX) maxX = px;
    if (py < minY) minY = py;
    if (py > maxY) maxY = py;
  }

  const lesionAreaPercent = Number(((bestComponentIndices.length / totalPixels) * 100).toFixed(1));

  // 5. Render Binary Mask Canvas
  const maskCanvas = document.createElement('canvas');
  maskCanvas.width = width;
  maskCanvas.height = height;
  const maskCtx = maskCanvas.getContext('2d')!;
  const maskImgData = maskCtx.createImageData(width, height);
  for (let i = 0; i < totalPixels; i++) {
    const val = finalMask[i];
    maskImgData.data[i * 4] = val;
    maskImgData.data[i * 4 + 1] = val;
    maskImgData.data[i * 4 + 2] = val;
    maskImgData.data[i * 4 + 3] = 255;
  }
  maskCtx.putImageData(maskImgData, 0, 0);
  const maskDataUrl = maskCanvas.toDataURL('image/png');

  // 6. Render Boundary Contour Overlay Canvas
  const overlayCanvas = document.createElement('canvas');
  overlayCanvas.width = width;
  overlayCanvas.height = height;
  const overlayCtx = overlayCanvas.getContext('2d')!;
  overlayCtx.drawImage(imageSource, 0, 0, width, height);

  const overlayImgData = overlayCtx.getImageData(0, 0, width, height);
  const oData = overlayImgData.data;

  // Detect edge pixels where mask transition occurs
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      if (finalMask[idx] === 255) {
        const isBorder =
          finalMask[idx - 1] === 0 ||
          finalMask[idx + 1] === 0 ||
          finalMask[idx - width] === 0 ||
          finalMask[idx + width] === 0;

        if (isBorder) {
          // Vibrant cyan contour (#00F0FF)
          oData[idx * 4] = 0;
          oData[idx * 4 + 1] = 240;
          oData[idx * 4 + 2] = 255;
          oData[idx * 4 + 3] = 255;
        } else {
          // Slight 25% tint over lesion area to highlight segmentation region
          oData[idx * 4 + 1] = Math.min(255, oData[idx * 4 + 1] + 30);
        }
      }
    }
  }
  overlayCtx.putImageData(overlayImgData, 0, 0);
  const overlayDataUrl = overlayCanvas.toDataURL('image/png');

  // 7. Render Bounding Box Cropped ROI Canvas
  const pad = 10;
  const roiX = Math.max(0, minX - pad);
  const roiY = Math.max(0, minY - pad);
  const roiW = Math.min(width - roiX, Math.max(32, maxX - minX + 2 * pad));
  const roiH = Math.min(height - roiY, Math.max(32, maxY - minY + 2 * pad));

  const roiCanvas = document.createElement('canvas');
  roiCanvas.width = roiW;
  roiCanvas.height = roiH;
  const roiCtx = roiCanvas.getContext('2d')!;
  roiCtx.drawImage(imageSource, roiX, roiY, roiW, roiH, 0, 0, roiW, roiH);
  const roiDataUrl = roiCanvas.toDataURL('image/png');

  return {
    maskDataUrl,
    overlayDataUrl,
    roiDataUrl,
    lesionAreaPercent,
    method: 'classical_otsu_saturation',
  };
}
