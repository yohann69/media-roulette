import { useEffect } from "react";
import { Canvas, Image as SkiaImage, RuntimeShader, Skia, useImage } from "@shopify/react-native-skia";

/** Draws the image as square blocks of `cell` pixels, each with the colour at its centre. */
const pixelate = Skia.RuntimeEffect.Make(`
uniform shader image;
uniform float cell;
uniform float2 size;

half4 main(float2 xy) {
  float2 center = (floor(xy / cell) + 0.5) * cell;
  // The last row and column can be partial: sample inside the image.
  return image.eval(min(center, size - 0.5));
}`)!;

interface PixelatedImageProps {
  uri: string;
  width: number;
  height: number;
  /** Block size in points. 1 or less shows the photo sharp. */
  pixelSize: number;
  onLoad?: (size: { width: number; height: number }) => void;
}

/** A photo shown pixelated (Slow Reveal rounds), drawn with Skia. */
export function PixelatedImage({ uri, width, height, pixelSize, onLoad }: PixelatedImageProps) {
  const image = useImage(uri);

  useEffect(() => {
    if (image) onLoad?.({ width: image.width(), height: image.height() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [image]);

  if (!image) return null;
  const cell = Math.max(1, pixelSize);

  return (
    <Canvas style={{ width, height }}>
      <SkiaImage image={image} x={0} y={0} width={width} height={height} fit="cover">
        {cell > 1 && <RuntimeShader source={pixelate} uniforms={{ cell, size: [width, height] }} />}
      </SkiaImage>
    </Canvas>
  );
}
