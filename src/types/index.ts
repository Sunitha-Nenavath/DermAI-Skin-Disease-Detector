export type UserRole = 'patient' | 'clinician' | 'researcher' | 'ml_engineer' | 'admin';

export type CaseStatus =
  | 'pending_review'
  | 'quality_passed'
  | 'quality_rejected'
  | 'analysis_completed'
  | 'requires_clinical_review'
  | 'closed';

export type QualityLabel = 'Good' | 'Acceptable' | 'Poor';

export type RiskTag = 'Low' | 'Moderate' | 'High' | 'Requires Clinical Review';

export type DiseaseClassKey = 'mel' | 'nv' | 'bcc' | 'akiec' | 'bkl' | 'df' | 'vasc';

export interface DiseaseClassMeta {
  code: DiseaseClassKey;
  name: string;
  category: 'Malignant' | 'Benign' | 'Pre-cancerous';
  defaultRisk: RiskTag;
  description: string;
}

export const DISEASE_CLASSES: Record<DiseaseClassKey, DiseaseClassMeta> = {
  mel: {
    code: 'mel',
    name: 'Melanoma',
    category: 'Malignant',
    defaultRisk: 'High',
    description: 'Malignant neoplasm derived from melanocytes; highest mortality among cutaneous malignancies.'
  },
  nv: {
    code: 'nv',
    name: 'Melanocytic Nevus',
    category: 'Benign',
    defaultRisk: 'Low',
    description: 'Common benign proliferation of melanocytes (moles).'
  },
  bcc: {
    code: 'bcc',
    name: 'Basal Cell Carcinoma',
    category: 'Malignant',
    defaultRisk: 'Moderate',
    description: 'Most prevalent non-melanoma skin cancer arising from basal epidermal cells.'
  },
  akiec: {
    code: 'akiec',
    name: 'Actinic Keratosis / Bowen Disease',
    category: 'Pre-cancerous',
    defaultRisk: 'Moderate',
    description: 'Dysplastic epidermal proliferation induced by chronic ultraviolet radiation.'
  },
  bkl: {
    code: 'bkl',
    name: 'Benign Keratosis',
    category: 'Benign',
    defaultRisk: 'Low',
    description: 'Seborrheic keratosis, solar lentigo, or lichen-planus-like keratosis.'
  },
  df: {
    code: 'df',
    name: 'Dermatofibroma',
    category: 'Benign',
    defaultRisk: 'Low',
    description: 'Benign fibrohistiocytic dermal lesion.'
  },
  vasc: {
    code: 'vasc',
    name: 'Vascular Lesion',
    category: 'Benign',
    defaultRisk: 'Low',
    description: 'Cherry angiomas, pyogenic granulomas, or angiokeratomas.'
  }
};

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  full_name?: string;
  role: UserRole;
  createdAt: string;
  updatedAt?: string;
}

export interface QualityMetrics {
  passed: boolean;
  quality_label: QualityLabel;
  blur_laplacian: number;
  mean_brightness: number;
  contrast_std: number;
  mean_gray?: number;
  std_gray?: number;
  width: number;
  height: number;
  center_contrast_ratio: number;
  reasons: string[];
}

export interface PreprocessingResult {
  originalDataUrl: string;
  processedDataUrl: string;
  width: number;
  height: number;
  channels: number;
  steps: {
    name: string;
    description: string;
    status: 'completed' | 'pending';
  }[];
}

export interface ClassicalSegmentationResult {
  maskDataUrl: string;
  overlayDataUrl: string;
  roiDataUrl: string;
  lesionAreaPercent: number;
  method: 'classical_otsu_saturation' | 'ml_service_unet';
}

export interface PredictionTop3Item {
  label: DiseaseClassKey;
  label_name: string;
  probability: number;
}

export interface PredictionResult {
  model_version: string;
  top3: PredictionTop3Item[];
  confidence: number;
  risk_tag: RiskTag;
  mask_png_base64?: string;
  heatmap_png_base64?: string;
  latency_ms: number;
  is_demo_mode: boolean;
  requires_clinical_review: boolean;
  disclaimer: string;
  timestamp: string;
}

export interface DeidentifiedPatient {
  case_code: string;
  age?: number;
  gender?: string;
  medical_history?: string;
  allergies?: string;
  clinical_notes?: string;
}

export interface ClinicalCase {
  id: string;
  case_code: string;
  title: string;
  body_location: string;
  status: CaseStatus;
  owner_id: string;
  owner_name: string;
  patient: DeidentifiedPatient;
  image_url?: string;
  storage_path?: string;
  images?: LesionImage[];
  quality_label?: QualityLabel;
  quality_metrics?: QualityMetrics;
  preprocessing?: PreprocessingResult;
  segmentation?: ClassicalSegmentationResult;
  latest_prediction?: PredictionResult;
  clinical_notes?: string;
  created_at: string;
  updated_at: string;
  medical_disclaimer: string;
}

export interface AuditLogEntry {
  id?: string;
  action: 'login' | 'case_create' | 'upload' | 'analysis' | 'report_download' | 'role_change';
  user_id: string;
  user_email: string;
  user_role: string;
  target_id?: string;
  details: string;
  timestamp: string;
}

export interface ModelVersionRecord {
  version: string;
  name: string;
  architecture: string;
  dataset_version: string;
  metrics: {
    accuracy: number;
    balanced_accuracy: number;
    macro_precision: number;
    macro_recall: number;
    macro_f1: number;
    sensitivity: number;
    specificity: number;
    auc_roc: number;
    mcc: number;
  };
  status: 'active' | 'inactive' | 'rollback';
  created_at: string;
}

export interface InAppNotification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  level: 'Informational' | 'Low' | 'Medium' | 'High';
  read: boolean;
  case_id?: string;
  created_at: string;
}

// Backward compatibility type aliases
export type User = UserProfile;
export type Case = ClinicalCase;

export interface LesionImage {
  id: number;
  case_id: number;
  original_filename: string;
  content_type: string;
  width: number;
  height: number;
  size_bytes: number;
  source: string;
  quality_label: QualityLabel;
  quality_metrics: QualityMetrics;
  created_at: string;
  file_url: string;
  preprocess_url: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user_id: number | string;
  email: string;
  full_name: string;
  role: UserRole;
}

