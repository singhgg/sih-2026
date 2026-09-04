import cv2
import numpy as np
from pathlib import Path
from typing import Union, List, Dict, Tuple

def load_image(image_input: Union[str, Path, np.ndarray]) -> np.ndarray:
    """Loads an image if input is path, otherwise returns the array."""
    if isinstance(image_input, (str, Path)):
        img = cv2.imread(str(image_input))
        if img is None:
            raise FileNotFoundError(f"Could not load image at {image_input}")
        return img
    return image_input

def apply_bilateral_filter(image: np.ndarray, d: int = 9, sigma_color: float = 75.0, sigma_space: float = 75.0) -> np.ndarray:
    """
    Applies Bilateral Filter to reduce speckle noise while preserving sharp boundaries.
    Can accept grayscale or color images.
    """
    return cv2.bilateralFilter(image, d, sigma_color, sigma_space)

def apply_clahe(image: np.ndarray, clip_limit: float = 2.0, tile_grid_size: Tuple[int, int] = (8, 8)) -> np.ndarray:
    """
    Applies CLAHE (Contrast Limited Adaptive Histogram Equalization) to balance sonar contrast.
    If image is RGB, processes the L channel in LAB color space to preserve color profiles.
    """
    if len(image.shape) == 3 and image.shape[2] == 3:
        # Convert to LAB color space
        lab = cv2.cvtColor(image, cv2.COLOR_BGR2LAB)
        l_channel, a_channel, b_channel = cv2.split(lab)
        
        # Apply CLAHE to L channel
        clahe = cv2.createCLAHE(clipLimit=clip_limit, tileGridSize=tile_grid_size)
        cl = clahe.apply(l_channel)
        
        # Merge channels and convert back
        merged = cv2.merge((cl, a_channel, b_channel))
        return cv2.cvtColor(merged, cv2.COLOR_LAB2BGR)
    else:
        # Grayscale image
        clahe = cv2.createCLAHE(clipLimit=clip_limit, tileGridSize=tile_grid_size)
        return clahe.apply(image)

def tile_waterfall_image(image: np.ndarray, tile_size: int = 640, overlap: int = 128) -> List[Dict[str, Union[np.ndarray, int]]]:
    """
    Splits a large waterfall sonar image into overlapping tiles.
    Returns:
        List of dicts: [
            {"tile": np.ndarray, "x_offset": int, "y_offset": int, "w": int, "h": int}
        ]
    """
    h, w = image.shape[:2]
    tiles = []
    
    # Calculate step size
    step = tile_size - overlap
    if step <= 0:
        step = tile_size // 2  # Fallback to 50% overlap if overlap is equal to or larger than tile size
        
    y = 0
    while y < h:
        # Prevent going out of bounds for the last slice
        y_end = min(y + tile_size, h)
        y_start = max(0, y_end - tile_size)
        
        x = 0
        while x < w:
            x_end = min(x + tile_size, w)
            x_start = max(0, x_end - tile_size)
            
            tile = image[y_start:y_end, x_start:x_end]
            tiles.append({
                "tile": tile,
                "x_offset": x_start,
                "y_offset": y_start,
                "w": x_end - x_start,
                "h": y_end - y_start
            })
            
            if x_end == w:
                break
            x += step
            
        if y_end == h:
            break
        y += step
        
    return tiles

def preprocess_pipeline(image_input: Union[str, Path, np.ndarray], d: int = 9, clip_limit: float = 2.0) -> np.ndarray:
    """Runs full preprocessing pipeline: read -> denoise -> contrast enhance."""
    img = load_image(image_input)
    denoised = apply_bilateral_filter(img, d=d)
    enhanced = apply_clahe(denoised, clip_limit=clip_limit)
    return enhanced
