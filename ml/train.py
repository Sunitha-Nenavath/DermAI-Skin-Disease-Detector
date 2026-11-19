"""
ml/train.py
Production PyTorch + timm training pipeline for HAM10000 7-class skin lesion classification.

Key Safeguards:
- Strictly groups splits by `lesion_id` using StratifiedGroupKFold so duplicate photos of the
  same physical lesion never leak across Train / Validation / Test sets.
- Computes inverse-frequency class weights to handle severe HAM10000 imbalance (~67% nv vs 1.1% df).
- Applies DermAI's standardized preprocessing (EXIF orientation, optional DullRazor, L-channel CLAHE, 224x224).
- Exports trained weights (.pt) AND a Colab Evaluation JSON payload compatible with DermAI Module 10.
"""

import argparse
import json
import os
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Tuple

import cv2
import numpy as np
import pandas as pd
import timm
import torch
import torch.nn as nn
from PIL import Image
from sklearn.metrics import (
    accuracy_score,
    balanced_accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
    matthews_corrcoef,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import StratifiedGroupKFold
from torch.utils.data import DataLoader, Dataset
from torchvision import transforms

from ml.preprocessing.pipeline import (
    IMAGENET_MEAN,
    IMAGENET_STD,
    center_crop_square,
    enhance_contrast_clahe,
    remove_hair_dullrazor,
)

CLASSES: List[str] = ["mel", "nv", "bcc", "akiec", "bkl", "df", "vasc"]
CLASS_NAMES: Dict[str, str] = {
    "mel": "Melanoma",
    "nv": "Melanocytic Nevus",
    "bcc": "Basal Cell Carcinoma",
    "akiec": "Actinic Keratosis",
    "bkl": "Benign Keratosis",
    "df": "Dermatofibroma",
    "vasc": "Vascular Lesion",
}

ARCH_MAP: Dict[str, Tuple[str, str]] = {
    "resnet50": ("v1.0 ResNet50", "resnet50"),
    "efficientnet_b4": ("v1.1 EfficientNet", "tf_efficientnet_b4_ns"),
    "densenet121": ("v2.0 DenseNet", "densenet121"),
    "vit_b16": ("v2.1 Vision Transformer", "vit_base_patch16_224"),
}


def resolve_image_paths(metadata_csv: Path, image_dirs: List[Path]) -> pd.DataFrame:
    df = pd.read_csv(metadata_csv)
    path_lookup: Dict[str, str] = {}
    for folder in image_dirs:
        if not folder.exists():
            continue
        for ext in ("*.jpg", "*.jpeg", "*.png"):
            for p in folder.rglob(ext):
                path_lookup[p.stem] = str(p)

    df["image_path"] = df["image_id"].map(path_lookup)
    df = df.dropna(subset=["image_path"]).reset_index(drop=True)
    df = df[df["dx"].isin(CLASSES)].reset_index(drop=True)
    df["label_idx"] = df["dx"].map({c: i for i, c in enumerate(CLASSES)})
    return df


def make_lesion_grouped_splits(
    df: pd.DataFrame, seed: int = 42
) -> Tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    """
    70% Train / 15% Val / 15% Test grouped by lesion_id with zero lesion overlap.
    """
    sgkf_test = StratifiedGroupKFold(n_splits=7, shuffle=True, random_state=seed)
    train_val_idx, test_idx = next(sgkf_test.split(df, df["label_idx"], df["lesion_id"]))
    train_val_df = df.iloc[train_val_idx].reset_index(drop=True)
    test_df = df.iloc[test_idx].reset_index(drop=True)

    sgkf_val = StratifiedGroupKFold(n_splits=6, shuffle=True, random_state=seed)
    train_idx, val_idx = next(
        sgkf_val.split(train_val_df, train_val_df["label_idx"], train_val_df["lesion_id"])
    )
    train_df = train_val_df.iloc[train_idx].reset_index(drop=True)
    val_df = train_val_df.iloc[val_idx].reset_index(drop=True)

    assert set(train_df["lesion_id"]).isdisjoint(set(val_df["lesion_id"]))
    assert set(train_df["lesion_id"]).isdisjoint(set(test_df["lesion_id"]))
    assert set(val_df["lesion_id"]).isdisjoint(set(test_df["lesion_id"]))
    return train_df, val_df, test_df


class HAM10000Dataset(Dataset):
    def __init__(self, df: pd.DataFrame, is_train: bool = False, apply_hair_removal: bool = False):
        self.df = df
        self.is_train = is_train
        self.apply_hair_removal = apply_hair_removal
        self.aug = transforms.Compose(
            [
                transforms.RandomHorizontalFlip(p=0.5),
                transforms.RandomVerticalFlip(p=0.5),
                transforms.RandomRotation(degrees=30),
                transforms.ColorJitter(brightness=0.12, contrast=0.12, saturation=0.1),
            ]
        )
        self.to_tensor = transforms.Compose(
            [
                transforms.ToTensor(),
                transforms.Normalize(mean=IMAGENET_MEAN.tolist(), std=IMAGENET_STD.tolist()),
            ]
        )

    def __len__(self) -> int:
        return len(self.df)

    def __getitem__(self, idx: int) -> Tuple[torch.Tensor, int]:
        row = self.df.iloc[idx]
        bgr = cv2.imread(row["image_path"])
        if bgr is None:
            raise FileNotFoundError(f"Unable to load image {row['image_path']}")

        if self.apply_hair_removal:
            bgr = remove_hair_dullrazor(bgr)
        bgr = enhance_contrast_clahe(bgr)
        bgr = center_crop_square(bgr)
        bgr = cv2.resize(bgr, (224, 224), interpolation=cv2.INTER_AREA)
        rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
        pil = Image.fromarray(rgb)

        if self.is_train:
            pil = self.aug(pil)

        return self.to_tensor(pil), int(row["label_idx"])


def compute_class_weights(df: pd.DataFrame) -> torch.Tensor:
    counts = np.bincount(df["label_idx"].values, minlength=len(CLASSES)).astype(np.float32)
    counts = np.maximum(counts, 1.0)
    weights = len(df) / (len(CLASSES) * counts)
    return torch.tensor(weights, dtype=torch.float32)


def evaluate_model(
    model: nn.Module, loader: DataLoader, device: torch.device
) -> Dict[str, object]:
    model.eval()
    all_probs: List[np.ndarray] = []
    all_targets: List[int] = []

    with torch.no_grad():
        for images, targets in loader:
            images = images.to(device)
            logits = model(images)
            probs = torch.softmax(logits, dim=1).cpu().numpy()
            all_probs.append(probs)
            all_targets.extend(targets.numpy().tolist())

    y_prob = np.concatenate(all_probs, axis=0)
    y_true = np.array(all_targets)
    y_pred = np.argmax(y_prob, axis=1)

    cm = confusion_matrix(y_true, y_pred, labels=list(range(len(CLASSES))))
    report = classification_report(
        y_true, y_pred, labels=list(range(len(CLASSES))), output_dict=True, zero_division=0
    )

    per_class = []
    specificities = []
    total = cm.sum()
    for i, code in enumerate(CLASSES):
        tp = int(cm[i, i])
        fp = int(cm[:, i].sum() - tp)
        fn = int(cm[i, :].sum() - tp)
        tn = int(total - tp - fp - fn)
        spec = tn / max(1, tn + fp)
        specificities.append(spec)
        cls_stats = report.get(str(i), {})
        per_class.append(
            {
                "code": code,
                "name": CLASS_NAMES[code],
                "precision": round(float(cls_stats.get("precision", 0.0)), 4),
                "recall": round(float(cls_stats.get("recall", 0.0)), 4),
                "f1": round(float(cls_stats.get("f1-score", 0.0)), 4),
                "support": int(cls_stats.get("support", 0)),
            }
        )

    try:
        auc_roc = float(roc_auc_score(y_true, y_prob, multi_class="ovr", average="macro"))
    except ValueError:
        auc_roc = 0.0

    macro_recall = float(recall_score(y_true, y_pred, average="macro", zero_division=0))

    return {
        "accuracy": round(float(accuracy_score(y_true, y_pred)), 4),
        "balanced_accuracy": round(float(balanced_accuracy_score(y_true, y_pred)), 4),
        "macro_precision": round(float(precision_score(y_true, y_pred, average="macro", zero_division=0)), 4),
        "macro_recall": round(macro_recall, 4),
        "macro_f1": round(float(f1_score(y_true, y_pred, average="macro", zero_division=0)), 4),
        "sensitivity": round(macro_recall, 4),
        "specificity": round(float(np.mean(specificities)), 4),
        "auc_roc": round(auc_roc, 4),
        "mcc": round(float(matthews_corrcoef(y_true, y_pred)), 4),
        "confusion_matrix": cm.tolist(),
        "per_class_metrics": per_class,
    }


def train(args: argparse.Namespace) -> None:
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    version_label, timm_name = ARCH_MAP[args.arch]

    df = resolve_image_paths(Path(args.metadata), [Path(p) for p in args.image_dirs])
    if len(df) < 50:
        raise RuntimeError(
            f"Found only {len(df)} images. Download full HAM10000 (10,015 images) before training."
        )

    train_df, val_df, test_df = make_lesion_grouped_splits(df, seed=args.seed)
    train_ds = HAM10000Dataset(train_df, is_train=True, apply_hair_removal=args.hair_removal)
    val_ds = HAM10000Dataset(val_df, is_train=False, apply_hair_removal=args.hair_removal)
    test_ds = HAM10000Dataset(test_df, is_train=False, apply_hair_removal=args.hair_removal)

    train_loader = DataLoader(train_ds, batch_size=args.batch_size, shuffle=True, num_workers=args.workers)
    val_loader = DataLoader(val_ds, batch_size=args.batch_size, shuffle=False, num_workers=args.workers)
    test_loader = DataLoader(test_ds, batch_size=args.batch_size, shuffle=False, num_workers=args.workers)

    model = timm.create_model(timm_name, pretrained=True, num_classes=len(CLASSES)).to(device)
    weights = compute_class_weights(train_df).to(device)
    criterion = nn.CrossEntropyLoss(weight=weights)
    optimizer = torch.optim.AdamW(model.parameters(), lr=args.lr, weight_decay=1e-4)
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=args.epochs)

    out_dir = Path(args.output_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    ckpt_path = out_dir / f"{args.arch}_best.pt"

    best_bal_acc = -1.0
    for epoch in range(1, args.epochs + 1):
        model.train()
        running_loss = 0.0
        for images, targets in train_loader:
            images, targets = images.to(device), targets.to(device)
            optimizer.zero_grad()
            loss = criterion(model(images), targets)
            loss.backward()
            optimizer.step()
            running_loss += float(loss.item()) * images.size(0)
        scheduler.step()

        val_metrics = evaluate_model(model, val_loader, device)
        val_bal_acc = float(val_metrics["balanced_accuracy"])
        print(
            f"Epoch {epoch:02d}/{args.epochs} | Loss={running_loss/len(train_ds):.4f} "
            f"| Val BalAcc={val_bal_acc:.4f} | Val MacroF1={val_metrics['macro_f1']}"
        )

        if val_bal_acc > best_bal_acc:
            best_bal_acc = val_bal_acc
            torch.save(
                {
                    "arch": args.arch,
                    "timm_name": timm_name,
                    "version_label": version_label,
                    "classes": CLASSES,
                    "state_dict": model.state_dict(),
                    "trained_at": datetime.utcnow().isoformat(),
                },
                ckpt_path,
            )

    # Final uncorrupted evaluation on held-out lesion-grouped Test set
    best_ckpt = torch.load(ckpt_path, map_location=device)
    model.load_state_dict(best_ckpt["state_dict"])
    test_metrics = evaluate_model(model, test_loader, device)

    colab_payload = {
        "model_name": version_label,
        "architecture": timm_name,
        "dataset_version": "HAM10000-LesionGrouped-70-15-15",
        **test_metrics,
    }

    metrics_path = out_dir / f"colab_metrics_{args.arch}.json"
    with open(metrics_path, "w", encoding="utf-8") as f:
        json.dump(colab_payload, f, indent=2)

    print(f"Saved best checkpoint -> {ckpt_path}")
    print(f"Exported Module 10 evaluation JSON -> {metrics_path}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Train DermAI HAM10000 classifier")
    parser.add_argument("--arch", choices=list(ARCH_MAP.keys()), default="resnet50")
    parser.add_argument("--metadata", default="data/raw/ham10000/HAM10000_metadata.csv")
    parser.add_argument(
        "--image-dirs",
        nargs="+",
        default=["data/raw/ham10000/HAM10000_images_part_1", "data/raw/ham10000/HAM10000_images_part_2"],
    )
    parser.add_argument("--output-dir", default="ml/weights")
    parser.add_argument("--epochs", type=int, default=15)
    parser.add_argument("--batch-size", type=int, default=32)
    parser.add_argument("--lr", type=float, default=3e-4)
    parser.add_argument("--workers", type=int, default=4)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--hair-removal", action="store_true")
    train(parser.parse_args())
