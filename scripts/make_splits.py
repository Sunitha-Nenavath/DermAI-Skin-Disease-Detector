"""
DermAI — scripts/make_splits.py
Creates train / val / test splits from HAM10000_metadata.csv
- Grouped by lesion_id (no data leakage)
- Stratified by dx label
- Saves CSVs to data/splits/ and class_weights.json

Usage:
    python scripts/make_splits.py
    python scripts/make_splits.py --csv data/raw/ham10000/HAM10000_metadata.csv
"""

import argparse
import json
import os
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.model_selection import GroupShuffleSplit

# ── Configuration ─────────────────────────────────────────────────────────────
SPLITS_DIR = Path("data/splits")
DEFAULT_CSV = Path("data/raw/ham10000/HAM10000_metadata.csv")
LABEL_COL = "dx"
GROUP_COL = "lesion_id"
VAL_RATIO = 0.15
TEST_RATIO = 0.15
RANDOM_STATE = 42

CLASS_LABELS = ["mel", "nv", "bcc", "akiec", "bkl", "df", "vasc"]
CLASS_NAMES = {
    "mel": "Melanoma",
    "nv": "Melanocytic Nevus",
    "bcc": "Basal Cell Carcinoma",
    "akiec": "Actinic Keratosis",
    "bkl": "Benign Keratosis",
    "df": "Dermatofibroma",
    "vasc": "Vascular Lesion",
}


def load_metadata(csv_path: Path) -> pd.DataFrame:
    """Load HAM10000 metadata CSV."""
    if not csv_path.exists():
        raise FileNotFoundError(
            f"Metadata CSV not found at {csv_path}.\n"
            "Please download HAM10000 from:\n"
            "  https://www.kaggle.com/datasets/kmader/skin-cancer-mnist-ham10000\n"
            "and place HAM10000_metadata.csv in data/raw/ham10000/"
        )
    df = pd.read_csv(csv_path)
    print(f"[INFO] Loaded {len(df):,} rows from {csv_path}")
    return df


def stratified_group_split(
    df: pd.DataFrame,
    label_col: str,
    group_col: str,
    val_ratio: float,
    test_ratio: float,
    random_state: int,
) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    """
    Split df into train / val / test.
    Groups by group_col so the same lesion never spans two splits.
    Approximates stratification by sorting groups by label before splitting.
    """
    # Aggregate group → majority label (for stratification proxy)
    group_labels = (
        df.groupby(group_col)[label_col]
        .agg(lambda x: x.value_counts().index[0])
        .reset_index()
    )
    group_labels.columns = [group_col, "majority_label"]

    # First: peel off (val + test) = 30%
    val_test_ratio = val_ratio + test_ratio
    gss_outer = GroupShuffleSplit(
        n_splits=1, test_size=val_test_ratio, random_state=random_state
    )
    groups = group_labels[group_col].values
    labels = group_labels["majority_label"].values

    train_group_idx, val_test_group_idx = next(gss_outer.split(groups, labels, groups))
    train_groups = set(group_labels.iloc[train_group_idx][group_col])
    val_test_groups_df = group_labels.iloc[val_test_group_idx]

    # Second: split (val + test) 50/50 → each 15%
    gss_inner = GroupShuffleSplit(
        n_splits=1,
        test_size=test_ratio / val_test_ratio,
        random_state=random_state,
    )
    vt_groups = val_test_groups_df[group_col].values
    vt_labels = val_test_groups_df["majority_label"].values
    val_group_idx, test_group_idx = next(gss_inner.split(vt_groups, vt_labels, vt_groups))

    val_groups = set(val_test_groups_df.iloc[val_group_idx][group_col])
    test_groups = set(val_test_groups_df.iloc[test_group_idx][group_col])

    train_df = df[df[group_col].isin(train_groups)].copy()
    val_df = df[df[group_col].isin(val_groups)].copy()
    test_df = df[df[group_col].isin(test_groups)].copy()

    return train_df, val_df, test_df


def compute_class_weights(df: pd.DataFrame, label_col: str) -> dict[str, float]:
    """Compute inverse-frequency class weights."""
    counts = df[label_col].value_counts()
    n_samples = len(df)
    n_classes = len(counts)
    weights = {}
    for cls in CLASS_LABELS:
        count = counts.get(cls, 1)
        weights[cls] = round(float(n_samples / (n_classes * count)), 4)
    return weights


def verify_no_leakage(
    train_df: pd.DataFrame,
    val_df: pd.DataFrame,
    test_df: pd.DataFrame,
    group_col: str,
) -> None:
    """Assert no lesion_id appears in more than one split."""
    train_groups = set(train_df[group_col])
    val_groups = set(val_df[group_col])
    test_groups = set(test_df[group_col])

    tv = train_groups & val_groups
    tt = train_groups & test_groups
    vt = val_groups & test_groups

    if tv or tt or vt:
        raise AssertionError(
            f"Data leakage detected!\n"
            f"  train∩val:  {len(tv)}\n"
            f"  train∩test: {len(tt)}\n"
            f"  val∩test:   {len(vt)}\n"
        )
    print("[OK] No lesion_id leakage between splits.")


def print_split_summary(
    train_df: pd.DataFrame,
    val_df: pd.DataFrame,
    test_df: pd.DataFrame,
    label_col: str,
) -> None:
    """Print per-split class distribution."""
    total = len(train_df) + len(val_df) + len(test_df)
    print(f"\n{'─'*60}")
    print(f"  Split summary (total images: {total:,})")
    print(f"{'─'*60}")
    print(f"  {'Class':<25} {'Train':>7} {'Val':>7} {'Test':>7}")
    print(f"  {'─'*52}")
    for cls in CLASS_LABELS:
        tr = (train_df[label_col] == cls).sum()
        vl = (val_df[label_col] == cls).sum()
        te = (test_df[label_col] == cls).sum()
        print(f"  {CLASS_NAMES[cls]:<25} {tr:>7} {vl:>7} {te:>7}")
    print(f"  {'─'*52}")
    print(
        f"  {'TOTAL':<25} {len(train_df):>7} {len(val_df):>7} {len(test_df):>7}"
    )
    print(
        f"  {'%':<25} {100*len(train_df)/total:>6.1f}%"
        f" {100*len(val_df)/total:>6.1f}%"
        f" {100*len(test_df)/total:>6.1f}%"
    )
    print(f"{'─'*60}\n")


def main() -> None:
    parser = argparse.ArgumentParser(description="Create HAM10000 train/val/test splits")
    parser.add_argument(
        "--csv",
        type=Path,
        default=DEFAULT_CSV,
        help="Path to HAM10000_metadata.csv",
    )
    args = parser.parse_args()

    # Load
    df = load_metadata(args.csv)

    # Validate expected columns
    required = {GROUP_COL, LABEL_COL, "image_id", "age", "sex", "localization"}
    missing = required - set(df.columns)
    if missing:
        raise ValueError(f"CSV is missing columns: {missing}")

    # Encode label as integer
    label_map = {cls: i for i, cls in enumerate(CLASS_LABELS)}
    df["label"] = df[LABEL_COL].map(label_map)

    # Split
    print(f"[INFO] Splitting by {GROUP_COL} (no leakage), stratified by {LABEL_COL}...")
    train_df, val_df, test_df = stratified_group_split(
        df, LABEL_COL, GROUP_COL, VAL_RATIO, TEST_RATIO, RANDOM_STATE
    )

    # Verify
    verify_no_leakage(train_df, val_df, test_df, GROUP_COL)
    print_split_summary(train_df, val_df, test_df, LABEL_COL)

    # Compute class weights from train split only
    weights = compute_class_weights(train_df, LABEL_COL)
    print("[INFO] Class weights (from train split):")
    for cls, w in weights.items():
        print(f"  {cls:<6} ({CLASS_NAMES[cls]:<25}) → weight = {w:.4f}")

    # Save
    SPLITS_DIR.mkdir(parents=True, exist_ok=True)
    train_df.to_csv(SPLITS_DIR / "train.csv", index=False)
    val_df.to_csv(SPLITS_DIR / "val.csv", index=False)
    test_df.to_csv(SPLITS_DIR / "test.csv", index=False)

    weights_path = SPLITS_DIR / "class_weights.json"
    with open(weights_path, "w") as f:
        json.dump(weights, f, indent=2)

    print(f"\n[OK] Splits saved to {SPLITS_DIR}/")
    print(f"[OK] Class weights saved to {weights_path}")


if __name__ == "__main__":
    main()
