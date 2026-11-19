#!/usr/bin/env python3
"""
scripts/make_splits.py
Creates leakage-free, lesion_id-grouped, stratified Train/Validation/Test (70/15/15) splits for HAM10000.
"""

import json
import os
from pathlib import Path
import numpy as np
import pandas as pd


def create_grouped_stratified_splits(
    metadata_path: str = "data/raw/ham10000/HAM10000_metadata.csv",
    output_dir: str = "data/splits",
    train_ratio: float = 0.70,
    val_ratio: float = 0.15,
    test_ratio: float = 0.15,
    random_state: int = 42,
):
    np.random.seed(random_state)
    out_path = Path(output_dir)
    out_path.mkdir(parents=True, exist_ok=True)

    if not os.path.exists(metadata_path):
        raise FileNotFoundError(f"Metadata file not found: {metadata_path}")

    df = pd.read_csv(metadata_path)
    print(f"[SPLIT] Loaded {len(df)} total image records from {metadata_path}")

    # Inspect unique lesion_id counts vs image counts
    unique_lesions = df.groupby("lesion_id").agg(
        dx=("dx", "first"),
        num_images=("image_id", "count")
    ).reset_index()

    print(f"[SPLIT] Found {len(unique_lesions)} unique lesions across {len(df)} images.")
    print(f"[SPLIT] Multiple images per lesion max: {unique_lesions['num_images'].max()}, mean: {unique_lesions['num_images'].mean():.2f}")

    # Stratified split at the lesion_id level
    train_lesions = []
    val_lesions = []
    test_lesions = []

    classes = unique_lesions["dx"].unique()

    for cls in sorted(classes):
        cls_lesions = unique_lesions[unique_lesions["dx"] == cls].copy()
        cls_lesions = cls_lesions.sample(frac=1.0, random_state=random_state).reset_index(drop=True)
        n = len(cls_lesions)

        n_train = int(round(train_ratio * n))
        n_val = int(round(val_ratio * n))
        # Ensure at least 1 in val and test if possible, remaining in test
        if n > 2:
            n_val = max(1, n_val)
        n_test = n - n_train - n_val
        if n_test <= 0 and n > 2:
            n_train -= 1
            n_test = 1

        cls_train = cls_lesions.iloc[:n_train]["lesion_id"].tolist()
        cls_val = cls_lesions.iloc[n_train:n_train + n_val]["lesion_id"].tolist()
        cls_test = cls_lesions.iloc[n_train + n_val:]["lesion_id"].tolist()

        train_lesions.extend(cls_train)
        val_lesions.extend(cls_val)
        test_lesions.extend(cls_test)

    # Set-based lookup
    train_set = set(train_lesions)
    val_set = set(val_lesions)
    test_set = set(test_lesions)

    # Verify zero overlap between lesion sets
    assert len(train_set.intersection(val_set)) == 0, "Leakage detected: train and val share lesion_ids!"
    assert len(train_set.intersection(test_set)) == 0, "Leakage detected: train and test share lesion_ids!"
    assert len(val_set.intersection(test_set)) == 0, "Leakage detected: val and test share lesion_ids!"

    df_train = df[df["lesion_id"].isin(train_set)].copy()
    df_val = df[df["lesion_id"].isin(val_set)].copy()
    df_test = df[df["lesion_id"].isin(test_set)].copy()

    # Tag split column
    df_train["split"] = "train"
    df_val["split"] = "val"
    df_test["split"] = "test"

    df_train.to_csv(out_path / "train.csv", index=False)
    df_val.to_csv(out_path / "val.csv", index=False)
    df_test.to_csv(out_path / "test.csv", index=False)

    # Combine into full annotated dataset with split tag
    df_full = pd.concat([df_train, df_val, df_test], ignore_index=True)
    df_full.to_csv(out_path / "ham10000_splits_all.csv", index=False)

    # Calculate class weights for training: weight_c = N_samples / (n_classes * count_c)
    n_total_train = len(df_train)
    class_counts_train = df_train["dx"].value_counts().to_dict()
    n_classes = len(class_counts_train)
    class_weights = {
        cls: round(float(n_total_train / (n_classes * count)), 4)
        for cls, count in class_counts_train.items()
    }

    summary = {
        "total_images": len(df),
        "total_unique_lesions": len(unique_lesions),
        "splits": {
            "train": {
                "images": len(df_train),
                "lesions": len(train_set),
                "pct_images": round(len(df_train) / len(df) * 100, 2),
                "class_counts": df_train["dx"].value_counts().to_dict(),
            },
            "val": {
                "images": len(df_val),
                "lesions": len(val_set),
                "pct_images": round(len(df_val) / len(df) * 100, 2),
                "class_counts": df_val["dx"].value_counts().to_dict(),
            },
            "test": {
                "images": len(df_test),
                "lesions": len(test_set),
                "pct_images": round(len(df_test) / len(df) * 100, 2),
                "class_counts": df_test["dx"].value_counts().to_dict(),
            },
        },
        "balanced_class_weights_train": class_weights,
        "leakage_verified": True,
    }

    with open(out_path / "split_summary.json", "w") as f:
        json.dump(summary, f, indent=2)

    print("\n=== SPLIT CREATION SUMMARY ===")
    print(f"Train: {len(df_train)} images ({len(train_set)} lesions) - {summary['splits']['train']['pct_images']}%")
    print(f"Val:   {len(df_val)} images ({len(val_set)} lesions) - {summary['splits']['val']['pct_images']}%")
    print(f"Test:  {len(df_test)} images ({len(test_set)} lesions) - {summary['splits']['test']['pct_images']}%")
    print("\nClass weights (Train):", json.dumps(class_weights, indent=2))
    print(f"\nFiles saved to {out_path.resolve()}/")
    return summary


if __name__ == "__main__":
    create_grouped_stratified_splits()
