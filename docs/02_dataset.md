# DermAI: Dataset Selection, Diagnostics, and Splitting Strategy
## Milestone 1: HAM10000 Exploratory Analysis & Mobile Adaptation

> **Regulatory & Clinical Notice**: AI-assisted analysis, not a standalone medical diagnosis. DermAI is an automated screening and clinical decision support system, not an autonomous medical device.

---

### 1. Choice of Benchmark Dataset: HAM10000

For Milestone 1, DermAI establishes its core dataset foundations on the **HAM10000 ("Human Against Machine with 10,000 training images")** dataset (Tschandl et al., *Scientific Data* 2018; Harvard Dataverse DOI:10.7910/DVN/DBW86T):
- **Total Records**: 10,015 dermatoscopic images.
- **Unique Lesions**: 7,470 distinct lesions (`lesion_id`).
- **Ground Truth Verification**: Over 50% confirmed via histopathology (`histo`), with follow-up consensus (`follow_up`), expert consensus (`consensus`), and in-vivo confocal microscopy (`confocal`).

#### Target Disease Classes:
| Class Code | Full Medical Diagnosis | Lesion Category | Image Count | % of Dataset | Computed Class Weight |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `nv` | Melanocytic Nevus | Benign mole | 6,705 | 66.95% | 0.2134 |
| `mel` | Melanoma | Malignant skin cancer | 1,113 | 11.11% | 1.2855 |
| `bkl` | Benign Keratosis-like Lesions | Benign (solar lentigo, seborrheic keratosis) | 1,099 | 10.97% | 1.3019 |
| `bcc` | Basal Cell Carcinoma | Malignant epithelial cancer | 514 | 5.13% | 2.7836 |
| `akiec` | Actinic Keratosis / Intraepithelial Carcinoma | Pre-cancerous / Carcinoma in situ | 327 | 3.27% | 4.3754 |
| `vasc` | Vascular Lesions | Benign vascular (angiomas, pyogenic) | 142 | 1.42% | 10.0757 |
| `df` | Dermatofibroma | Benign dermal nodule | 115 | 1.15% | 12.4413 |
| **Total** | | | **10,015** | **100.0%** | |

---

### 2. Crucial Methodological Risks & Architectural Mitigation

#### A. Extreme Class Imbalance
The dataset exhibits severe imbalance: `nv` accounts for **67.0%** of all samples, while life-threatening malignancies (`mel`, `bcc`) and rare lesions (`df`, `vasc`) represent small fractions.
- **Risk**: Naive training results in models with ~67% accuracy that predict everything as nevus, failing to detect deadly melanomas.
- **Mitigation Strategy**:
  1. Balanced loss weights ($w_c = \frac{N}{K \cdot N_c}$) implemented in Milestone 1 splits (`scripts/make_splits.py`).
  2. Focal loss $(\gamma=2.0)$ and stratified sampling planned for Milestones 2 & 3.
  3. Metric evaluation focused on Balanced Accuracy, Macro F1, and Sensitivity (Recall) for melanoma/BCC rather than raw top-1 accuracy.

#### B. The Lesion ID Leakage Trap
Out of 10,015 images, there are only 7,470 unique lesions. Many lesions were photographed multiple times at different angles, polarizations, or follow-up visits (up to 6 images per lesion).
- **Critical Risk**: Standard random train/test splitting puts different photos of the *same* patient lesion into both train and test sets. This creates artificial feature leakage, producing falsely inflated test performance (~95%) that collapses on unseen clinical cases.
- **Mitigation**: DermAI enforces **Grouped Stratified Splitting** (`scripts/make_splits.py`) strictly grouping by `lesion_id`:
  - **Train**: 7,014 images (5,230 lesions, 70.03%)
  - **Val**: 1,499 images (1,120 lesions, 14.97%)
  - **Test**: 1,502 images (1,120 lesions, 15.00%)
  - **Leakage check**: Verified $0$ common lesion IDs across splits.

---

### 3. The Dermoscopy vs. Mobile Phone Camera Gap

| Dimension | HAM10000 Dermoscopy | Real-World Mobile Smartphone Photo |
| :--- | :--- | :--- |
| **Illumination** | Contact epiluminescence / cross-polarized uniform ring light | Ambient indoor/outdoor light, harsh flash glare, shadows |
| **Optics & Focal Depth** | Fixed magnification dermatoscope lens against skin | Variable smartphone lens, auto-focus hunting, perspective distortion |
| **Artifacts** | Immersion oil bubbles, glass plate pressure bluing | Motion blur, skin hair occlusion, background clutter (clothing, bedsheets) |
| **Resolution & Crop** | Standard 600x450 centered on lesion | High-res (12–48 MP) with small lesion in large skin field |
| **Skin Tone Diversity** | Predominantly Fitzpatrick types I–III (Austrian/Australian cohorts) | Broad multi-ethnic Fitzpatrick types I–VI |

#### Path to Multi-Modal Domain Generalization:
To bridge this domain shift in future milestones:
1. **Milestone 1 Quality Pre-Screening**: Rejects mobile images with severe motion blur (Laplacian variance < 80), underexposure (mean gray < 40), or low resolution.
2. **Preprocessing Pipeline**: OpenCV DullRazor hair removal and CLAHE contrast equalization normalize varying smartphone lighting conditions.
3. **Clinical Expansion Datasets**:
   - **PAD-UFES-20**: 2,298 real smartphone images from Brazilian public clinics with Fitzpatrick I–VI diversity.
   - **SCIN (Skin Condition Image Network)**: Crowdsourced smartphone dermatology dataset developed with dermatologists.
   Both will be integrated into Milestone 2/3 for cross-modality domain adaptation.

---

### 4. Dataset Status for Local Demonstration
- **Full Metadata**: Successfully downloaded and parsed (`data/raw/ham10000/HAM10000_metadata.csv`, 10,015 rows).
- **Leakage-Free Splits**: Created under `data/splits/` (`train.csv`, `val.csv`, `test.csv`, `split_summary.json`).
- **Benchmark Sample Lesion Images**: Generated 21 representative benchmark samples (3 per class) under `data/raw/ham10000/sample_images/` with standardized 600x450 dimensions for unit tests, preprocessing verification, and offline visualization.
