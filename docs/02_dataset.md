# DermAI — Dataset Selection & Analysis

> ⚠️ **AI-assisted analysis, not a standalone medical diagnosis.**

---

## 1. Dataset: HAM10000 ("Human Against Machine with 10,000 training images")

| Attribute | Value |
|-----------|-------|
| Source | ISIC Archive (Harvard Dataverse) |
| DOI | 10.7910/DVN/DBW86T |
| Total images | 10,015 dermoscopic images |
| Image format | JPEG, 600×450 px |
| Metadata | CSV with lesion_id, image_id, dx, dx_type, age, sex, localization |
| License | CC BY-NC 4.0 |
| Capture type | **Dermoscopy** (polarized light + immersion fluid) |

### Why HAM10000?

- Largest publicly available, license-friendly, multi-class dermoscopy dataset.
- 7 clinically significant classes covering ~95% of all skin lesions seen in practice.
- Ground-truth labels confirmed by histopathology, expert consensus, or follow-up.
- Well-studied benchmark enabling fair comparison with published literature (ISIC 2018 winner: AUC 0.86).

---

## 2. Disease Classes

| Code | Disease | Clinical Significance |
|------|---------|----------------------|
| `mel` | **Melanoma** | Malignant — most dangerous skin cancer |
| `nv` | Melanocytic Nevus | Benign mole — most common class |
| `bcc` | **Basal Cell Carcinoma** | Malignant — most common skin cancer overall |
| `akiec` | Actinic Keratosis / Intraepithelial Carcinoma | Pre-malignant |
| `bkl` | Benign Keratosis-like lesion | Benign |
| `df` | Dermatofibroma | Benign |
| `vasc` | Vascular Lesion | Benign (angiomas, hemorrhage) |

---

## 3. Class Imbalance

HAM10000 is **severely imbalanced**:

| Class | Approx Count | % |
|-------|-------------|---|
| nv | ~6,705 | 66.9% |
| mel | ~1,113 | 11.1% |
| bkl | ~1,099 | 11.0% |
| bcc | ~514 | 5.1% |
| akiec | ~327 | 3.3% |
| vasc | ~142 | 1.4% |
| df | ~115 | 1.1% |

**Mitigation strategies** (applied in training, not preprocessing):
- **Class-weighted loss** — weights = total / (n_classes × class_count)
- **Oversampling** — duplicate minority-class images during data loading
- **Augmentation** — rotations, flips, color jitter applied to minority classes
- Class weights are pre-computed and saved to `data/splits/class_weights.json`

---

## 4. Data Leakage Risk (Critical)

HAM10000 contains **multiple images of the same lesion** (captured at different angles or follow-up visits). A naive random split would leak the same lesion into both train and test, inflating metrics by ~5–15%.

**Prevention:** All splits are **grouped by `lesion_id`** — all images of a single lesion appear in exactly one split. Stratification by `dx` label ensures class proportions are maintained.

```
scripts/make_splits.py — GroupShuffleSplit(groups=lesion_id) + StratifiedGroupKFold
```

---

## 5. Dermoscopy vs Phone-Photo Gap

| | Dermoscopy | Smartphone Camera |
|--|-----------|------------------|
| Equipment | Polarized dermatoscope | Standard camera |
| Lighting | Controlled, uniform | Variable, shadows |
| Contact | Immersion fluid | Varies |
| Resolution | 600×450px (typical) | 3000×4000px (typical) |
| Hair artifact | Less prominent | Very prominent |
| Application | Specialist clinic | Home / remote |

**DermAI must bridge this gap** because patients will use smartphone cameras. Planned mitigations:
- Hair removal algorithm (morphological blackhat + inpaint)
- CLAHE contrast enhancement
- Strong augmentation during training (blur, noise, color jitter)
- Domain adaptation (planned M4)

---

## 6. Planned Future Datasets (Milestone 4+)

| Dataset | Source | Content | Why |
|---------|--------|---------|-----|
| **PAD-UFES-20** | University of Espírito Santo | 2,298 smartphone photos, 6 classes | Real phone photos from patients |
| **SCIN** | Google Research | 5,000 crowd-sourced smartphone images | Diverse skin tones, real-world conditions |

---

## 7. Split Sizes

| Split | % | Approx images |
|-------|---|--------------|
| Train | 70% | ~7,011 |
| Val | 15% | ~1,502 |
| Test | 15% | ~1,502 |

Splits saved to:
- `data/splits/train.csv`
- `data/splits/val.csv`
- `data/splits/test.csv`
- `data/splits/class_weights.json`

---

## 8. Image Statistics (from HAM10000 sample)

- **Size:** 600 × 450 px (all images uniform)
- **Color space:** RGB / JPEG
- **Mean pixel values:** approximately R=180, G=140, B=130 (skin-toned)
- **Notes:** Some images contain dermoscopy circle border artifact (crop/resize handles this)
