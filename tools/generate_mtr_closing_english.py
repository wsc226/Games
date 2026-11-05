#!/usr/bin/env python3
"""Generate the MTR platform-screen-door English closing announcement."""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path


DEFAULT_PROJECT = Path(
    "/Users/william/Library/Application Support/"
    "com.debpalash.omnivoice-studio/project"
)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--omnivoice-project", type=Path, default=DEFAULT_PROJECT)
    parser.add_argument(
        "--reference",
        type=Path,
        default=Path("audio/mtr/references/MTR-EN.mp3"),
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("audio/mtr/closing/mtr-platform-screen-doors-english.wav"),
    )
    args = parser.parse_args()

    project = args.omnivoice_project.resolve()
    sys.path[:0] = [str(project), str(project / "backend")]
    os.environ.setdefault("HF_HUB_OFFLINE", "1")
    os.environ.setdefault("TRANSFORMERS_OFFLINE", "1")

    import torch
    import torchaudio
    from omnivoice.models.omnivoice import OmniVoice
    from services.audio_dsp import (
        apply_effects_chain,
        apply_mastering,
        get_effect_chain,
        normalize_audio,
    )

    device = "mps" if torch.backends.mps.is_available() else "cpu"
    dtype = torch.float16 if device == "mps" else torch.float32
    seed = 20260907
    torch.manual_seed(seed)

    model = OmniVoice.from_pretrained(
        "k2-fsa/OmniVoice", device_map=device, dtype=dtype
    )
    generated = model.generate(
        text="Please stand clear from the platform screen doors.",
        language="en",
        ref_audio=str(args.reference.resolve()),
        ref_text="Please stand back from the train doors",
        num_step=32,
        guidance_scale=2.0,
        speed=1.0,
        t_shift=0.1,
        denoise=True,
        postprocess_output=True,
        layer_penalty_factor=5.0,
        position_temperature=5.0,
        class_temperature=0.0,
    )[0]

    sample_rate = model.sampling_rate
    generated = apply_mastering(generated, sample_rate=sample_rate)
    chain = get_effect_chain("broadcast")
    if chain:
        generated = apply_effects_chain(
            generated, sample_rate=sample_rate, chain=chain
        )
    generated = normalize_audio(generated, target_dBFS=-2.0)

    output = args.output.resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    torchaudio.save(str(output), generated.cpu(), sample_rate)
    print(f"Saved {output}")


if __name__ == "__main__":
    main()
