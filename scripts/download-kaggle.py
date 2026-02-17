#!/usr/bin/env python3
"""
Download Kaggle NBA Odds Dataset
"""

import os
import sys

# Add kaggle to path
sys.path.insert(0, r'C:\Users\isaac\AppData\Roaming\Python\Python314\site-packages')

from kaggle.api.kaggle_api_extended import KaggleApi

def download_dataset():
    """Download NBA odds dataset from Kaggle"""
    
    print('Authenticating with Kaggle...')
    api = KaggleApi()
    api.authenticate()
    
    dataset = 'rj467dj/nba-odds-data'
    output_dir = './data/kaggle'
    
    print(f'Downloading dataset: {dataset}')
    print(f'   Output: {output_dir}')
    
    # Create output directory
    os.makedirs(output_dir, exist_ok=True)
    
    # Download dataset
    api.dataset_download_files(
        dataset,
        path=output_dir,
        unzip=True
    )
    
    print('Download complete!')
    print(f'   Files saved to: {output_dir}')
    
    # List downloaded files
    files = os.listdir(output_dir)
    print(f'\nDownloaded files:')
    for f in files:
        print(f'   - {f}')

if __name__ == '__main__':
    try:
        download_dataset()
    except Exception as e:
        print(f'Error: {e}')
        sys.exit(1)
