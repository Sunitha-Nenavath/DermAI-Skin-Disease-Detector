"""
tests/test_splits.py
Unit test verifying that HAM10000 splits have ZERO lesion_id overlap across
Train, Validation, and Test sets, preventing patient/lesion-level data leakage.
"""

import os
import pandas as pd
import pytest


def test_zero_lesion_id_overlap():
    train_path = "data/splits/train.csv"
    val_path = "data/splits/val.csv"
    test_path = "data/splits/test.csv"

    assert os.path.exists(train_path), "train.csv does not exist"
    assert os.path.exists(val_path), "val.csv does not exist"
    assert os.path.exists(test_path), "test.csv does not exist"

    df_train = pd.read_csv(train_path)
    df_val = pd.read_csv(val_path)
    df_test = pd.read_csv(test_path)

    train_lesions = set(df_train["lesion_id"].unique())
    val_lesions = set(df_val["lesion_id"].unique())
    test_lesions = set(df_test["lesion_id"].unique())

    # Check zero overlap
    train_val_overlap = train_lesions.intersection(val_lesions)
    train_test_overlap = train_lesions.intersection(test_lesions)
    val_test_overlap = val_lesions.intersection(test_lesions)

    assert len(train_val_overlap) == 0, f"Data leakage: {len(train_val_overlap)} lesions shared between Train and Val!"
    assert len(train_test_overlap) == 0, f"Data leakage: {len(train_test_overlap)} lesions shared between Train and Test!"
    assert len(val_test_overlap) == 0, f"Data leakage: {len(val_test_overlap)} lesions shared between Val and Test!"

    # Verify all 7 HAM10000 classes are represented in all splits
    expected_classes = {"akiec", "bcc", "bkl", "df", "mel", "nv", "vasc"}
    assert set(df_train["dx"].unique()) == expected_classes
    assert set(df_val["dx"].unique()) == expected_classes
    assert set(df_test["dx"].unique()) == expected_classes

    # Verify proportions ~ 70 / 15 / 15
    total = len(df_train) + len(df_val) + len(df_test)
    assert 0.68 <= len(df_train) / total <= 0.72
    assert 0.13 <= len(df_val) / total <= 0.17
    assert 0.13 <= len(df_test) / total <= 0.17
