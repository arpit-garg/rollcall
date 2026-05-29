"""
MiniFASNet: Lightweight Face Anti-Spoofing Network architectures.

Ported from MiniVision's Silent-Face-Anti-Spoofing repository.
Licensed under Apache License 2.0.
Ref: github.com/minivision-ai/Silent-Face-Anti-Spoofing/blob/master/src/model_lib/MiniFASNet.py

Two model variants:
  - MiniFASNetV2: no SE blocks, crop scale 2.7
  - MiniFASNetV1SE: with SE blocks, crop scale 4.0

Both accept (batch, 3, 80, 80) input and produce 3-class logits.
"""

from typing import List, Tuple

import torch
import torch.nn.functional as F
from torch.nn import (
    Linear,
    Conv2d,
    BatchNorm1d,
    BatchNorm2d,
    PReLU,
    ReLU,
    Sigmoid,
    Dropout,
    AdaptiveAvgPool2d,
    Sequential,
    Module,
)


# Channel configurations for the two model variants.
# Each flat list encodes [stem, dw_stem, transition_expand, transition_dw, transition_out,
# ...residual triples..., transition..., ...residual triples..., head_dw, head_pw]
_KEEP_DICT = {
    # MiniFASNetV1SE (with SE blocks)
    "1.8M": [
        32, 32,
        103, 103, 64,
        13, 13, 64, 26, 26, 64, 13, 13, 64, 52, 52, 64,
        231, 231, 128,
        154, 154, 128, 52, 52, 128, 26, 26, 128, 52, 52, 128, 26, 26, 128, 26, 26, 128,
        308, 308, 128,
        26, 26, 128, 26, 26, 128,
        512, 512,
    ],
    # MiniFASNetV2 (no SE blocks)
    "1.8M_": [
        32, 32,
        103, 103, 64,
        13, 13, 64, 13, 13, 64, 13, 13, 64, 13, 13, 64,
        231, 231, 128,
        231, 231, 128, 52, 52, 128, 26, 26, 128, 77, 77, 128, 26, 26, 128, 26, 26, 128,
        308, 308, 128,
        26, 26, 128, 26, 26, 128,
        512, 512,
    ],
}


class _L2Norm(Module):
    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return F.normalize(x)


class _Flatten(Module):
    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return x.view(x.size(0), -1)


class _ConvBlock(Module):
    """Conv2d + BatchNorm2d + PReLU."""

    def __init__(
        self,
        in_c: int,
        out_c: int,
        kernel: Tuple[int, int] = (1, 1),
        stride: Tuple[int, int] = (1, 1),
        padding: Tuple[int, int] = (0, 0),
        groups: int = 1,
    ) -> None:
        super().__init__()
        self.conv = Conv2d(
            in_c, out_c, kernel_size=kernel, groups=groups,
            stride=stride, padding=padding, bias=False,
        )
        self.bn = BatchNorm2d(out_c)
        self.prelu = PReLU(out_c)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.prelu(self.bn(self.conv(x)))


class _LinearBlock(Module):
    """Conv2d + BatchNorm2d (no activation)."""

    def __init__(
        self,
        in_c: int,
        out_c: int,
        kernel: Tuple[int, int] = (1, 1),
        stride: Tuple[int, int] = (1, 1),
        padding: Tuple[int, int] = (0, 0),
        groups: int = 1,
    ) -> None:
        super().__init__()
        self.conv = Conv2d(
            in_c, out_c, kernel_size=kernel, groups=groups,
            stride=stride, padding=padding, bias=False,
        )
        self.bn = BatchNorm2d(out_c)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.bn(self.conv(x))


class _DepthWise(Module):
    """Depthwise separable convolution block (expand → depthwise → project)."""

    def __init__(
        self,
        c1: Tuple[int, int],
        c2: Tuple[int, int],
        c3: Tuple[int, int],
        residual: bool = False,
        kernel: Tuple[int, int] = (3, 3),
        stride: Tuple[int, int] = (2, 2),
        padding: Tuple[int, int] = (1, 1),
        groups: int = 1,
    ) -> None:
        super().__init__()
        c1_in, c1_out = c1
        c2_in, c2_out = c2
        c3_in, c3_out = c3
        self.conv = _ConvBlock(c1_in, c1_out, kernel=(1, 1), padding=(0, 0), stride=(1, 1))
        self.conv_dw = _ConvBlock(
            c2_in, c2_out, groups=c2_in, kernel=kernel, padding=padding, stride=stride,
        )
        self.project = _LinearBlock(c3_in, c3_out, kernel=(1, 1), padding=(0, 0), stride=(1, 1))
        self.residual = residual

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        if self.residual:
            short_cut = x
        output = self.conv(x)
        output = self.conv_dw(output)
        output = self.project(output)
        if self.residual:
            output = short_cut + output
        return output


class _DepthWiseSE(Module):
    """Depthwise separable convolution block with Squeeze-and-Excitation."""

    def __init__(
        self,
        c1: Tuple[int, int],
        c2: Tuple[int, int],
        c3: Tuple[int, int],
        residual: bool = False,
        kernel: Tuple[int, int] = (3, 3),
        stride: Tuple[int, int] = (2, 2),
        padding: Tuple[int, int] = (1, 1),
        groups: int = 1,
        se_reduction: int = 4,
    ) -> None:
        super().__init__()
        c1_in, c1_out = c1
        c2_in, c2_out = c2
        c3_in, c3_out = c3
        self.conv = _ConvBlock(c1_in, c1_out, kernel=(1, 1), padding=(0, 0), stride=(1, 1))
        self.conv_dw = _ConvBlock(
            c2_in, c2_out, groups=c2_in, kernel=kernel, padding=padding, stride=stride,
        )
        self.project = _LinearBlock(c3_in, c3_out, kernel=(1, 1), padding=(0, 0), stride=(1, 1))
        self.residual = residual
        # Squeeze-and-Excitation block
        mid_ch = max(c3_out // se_reduction, 1)
        self.se = Sequential(
            AdaptiveAvgPool2d(1),
            Conv2d(c3_out, mid_ch, 1, bias=True),
            ReLU(inplace=True),
            Conv2d(mid_ch, c3_out, 1, bias=True),
            Sigmoid(),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        if self.residual:
            short_cut = x
        output = self.conv(x)
        output = self.conv_dw(output)
        output = self.project(output)
        output = output * self.se(output)
        if self.residual:
            output = short_cut + output
        return output


def _build_residual_stages(
    keep: List[int],
    block_cls: type,
    offset: int,
    n_blocks: int,
    base_channels: int,
) -> Tuple[Sequential, int]:
    """Build a sequence of residual depthwise blocks from the channel config list."""
    layers = []
    idx = offset
    for _ in range(n_blocks):
        expand = keep[idx]
        dw = keep[idx + 1]
        out = keep[idx + 2]
        layers.append(
            block_cls(
                (base_channels, expand),
                (expand, dw),
                (dw, out),
                residual=True,
                kernel=(3, 3),
                stride=(1, 1),
                padding=(1, 1),
            )
        )
        idx += 3
    return Sequential(*layers), idx


class _MiniFASNet(Module):
    """MiniFASNet without SE blocks (base architecture for V2)."""

    def __init__(
        self,
        keep: List[int],
        embedding_size: int = 128,
        conv6_kernel: Tuple[int, int] = (5, 5),
        drop_p: float = 0.2,
        num_classes: int = 3,
        img_channel: int = 3,
    ) -> None:
        super().__init__()
        idx = 0

        # Stem
        self.conv1 = _ConvBlock(img_channel, keep[idx], (3, 3), (2, 2), (1, 1))
        idx += 1
        self.conv2 = _ConvBlock(keep[idx], keep[idx], (3, 3), (1, 1), (1, 1), groups=keep[idx])
        idx += 1

        # Transition 1 (stride-2 downsample)
        self.conv3 = _DepthWise(
            (keep[idx - 1], keep[idx]),
            (keep[idx], keep[idx + 1]),
            (keep[idx + 1], keep[idx + 2]),
            kernel=(3, 3), stride=(2, 2), padding=(1, 1),
        )
        idx += 3

        # Stage 2: 4 residual blocks
        self.stage2, idx = _build_residual_stages(keep, _DepthWise, idx, 4, keep[idx + 2])

        # Transition 2
        self.conv4 = _DepthWise(
            (64, keep[idx]),
            (keep[idx], keep[idx + 1]),
            (keep[idx + 1], keep[idx + 2]),
            kernel=(3, 3), stride=(2, 2), padding=(1, 1),
        )
        idx += 3

        # Stage 3: 6 residual blocks
        self.stage3, idx = _build_residual_stages(keep, _DepthWise, idx, 6, keep[idx + 2])

        # Transition 3
        self.conv5 = _DepthWise(
            (128, keep[idx]),
            (keep[idx], keep[idx + 1]),
            (keep[idx + 1], keep[idx + 2]),
            kernel=(3, 3), stride=(2, 2), padding=(1, 1),
        )
        idx += 3

        # Stage 4: 2 residual blocks
        self.stage4, idx = _build_residual_stages(keep, _DepthWise, idx, 2, keep[idx + 2])

        # Head
        self.conv6 = _ConvBlock(128, keep[idx], conv6_kernel, (1, 1), (0, 0), groups=128)
        idx += 1
        self.conv7 = _ConvBlock(keep[idx], keep[idx], (1, 1), (1, 1), (0, 0))
        idx += 1

        self.output_layer = Sequential(
            _Flatten(),
            Dropout(p=drop_p),
            Linear(512 * 1 * 1, embedding_size, bias=False),
            BatchNorm1d(embedding_size),
        )
        self.fc = Linear(embedding_size, num_classes, bias=False)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        out = self.conv1(x)
        out = self.conv2(out)
        out = self.conv3(out)
        out = self.stage2(out)
        out = self.conv4(out)
        out = self.stage3(out)
        out = self.conv5(out)
        out = self.stage4(out)
        out = self.conv6(out)
        out = self.conv7(out)
        out = self.output_layer(out)
        out = self.fc(out)
        return out


class _MiniFASNetSE(Module):
    """MiniFASNet with Squeeze-and-Excitation blocks (base architecture for V1SE)."""

    def __init__(
        self,
        keep: List[int],
        embedding_size: int = 128,
        conv6_kernel: Tuple[int, int] = (5, 5),
        drop_p: float = 0.75,
        num_classes: int = 3,
        img_channel: int = 3,
    ) -> None:
        super().__init__()
        idx = 0

        # Stem
        self.conv1 = _ConvBlock(img_channel, keep[idx], (3, 3), (2, 2), (1, 1))
        idx += 1
        self.conv2 = _ConvBlock(keep[idx], keep[idx], (3, 3), (1, 1), (1, 1), groups=keep[idx])
        idx += 1

        # Transition 1
        self.conv3 = _DepthWiseSE(
            (keep[idx - 1], keep[idx]),
            (keep[idx], keep[idx + 1]),
            (keep[idx + 1], keep[idx + 2]),
            kernel=(3, 3), stride=(2, 2), padding=(1, 1),
        )
        idx += 3

        # Stage 2: 4 residual blocks
        self.stage2, idx = _build_residual_stages(keep, _DepthWiseSE, idx, 4, keep[idx + 2])

        # Transition 2
        self.conv4 = _DepthWiseSE(
            (64, keep[idx]),
            (keep[idx], keep[idx + 1]),
            (keep[idx + 1], keep[idx + 2]),
            kernel=(3, 3), stride=(2, 2), padding=(1, 1),
        )
        idx += 3

        # Stage 3: 6 residual blocks
        self.stage3, idx = _build_residual_stages(keep, _DepthWiseSE, idx, 6, keep[idx + 2])

        # Transition 3
        self.conv5 = _DepthWiseSE(
            (128, keep[idx]),
            (keep[idx], keep[idx + 1]),
            (keep[idx + 1], keep[idx + 2]),
            kernel=(3, 3), stride=(2, 2), padding=(1, 1),
        )
        idx += 3

        # Stage 4: 2 residual blocks
        self.stage4, idx = _build_residual_stages(keep, _DepthWiseSE, idx, 2, keep[idx + 2])

        # Head
        self.conv6 = _ConvBlock(128, keep[idx], conv6_kernel, (1, 1), (0, 0), groups=128)
        idx += 1
        self.conv7 = _ConvBlock(keep[idx], keep[idx], (1, 1), (1, 1), (0, 0))
        idx += 1

        self.output_layer = Sequential(
            _Flatten(),
            Dropout(p=drop_p),
            Linear(512 * 1 * 1, embedding_size, bias=False),
            BatchNorm1d(embedding_size),
        )
        self.fc = Linear(embedding_size, num_classes, bias=False)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        out = self.conv1(x)
        out = self.conv2(out)
        out = self.conv3(out)
        out = self.stage2(out)
        out = self.conv4(out)
        out = self.stage3(out)
        out = self.conv5(out)
        out = self.stage4(out)
        out = self.conv6(out)
        out = self.conv7(out)
        out = self.output_layer(out)
        out = self.fc(out)
        return out


# ── Factory functions (matching DeepFace's interface) ──────────────────────


def MiniFASNetV2(
    embedding_size: int = 128,
    conv6_kernel: Tuple[int, int] = (5, 5),
    drop_p: float = 0.2,
    num_classes: int = 3,
    img_channel: int = 3,
) -> _MiniFASNet:
    """Create MiniFASNetV2 (no SE blocks). Use with crop scale 2.7."""
    return _MiniFASNet(
        _KEEP_DICT["1.8M_"], embedding_size, conv6_kernel, drop_p, num_classes, img_channel,
    )


def MiniFASNetV1SE(
    embedding_size: int = 128,
    conv6_kernel: Tuple[int, int] = (5, 5),
    drop_p: float = 0.75,
    num_classes: int = 3,
    img_channel: int = 3,
) -> _MiniFASNetSE:
    """Create MiniFASNetV1SE (with SE blocks). Use with crop scale 4.0."""
    return _MiniFASNetSE(
        _KEEP_DICT["1.8M"], embedding_size, conv6_kernel, drop_p, num_classes, img_channel,
    )
