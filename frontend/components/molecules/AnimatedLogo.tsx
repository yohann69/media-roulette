import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing } from "react-native";
import Svg, { 
  G, 
  Circle, 
  Polygon, 
  Text as SvgText, 
  Defs, 
  LinearGradient, 
  RadialGradient, 
  Stop, 
  Path 
} from "react-native-svg";

type GameMode = "Photo" | "Video" | "Mix" | "Blind" | "initial" | "random";

interface AnimatedLogoProps {
  targetMode?: GameMode;
  size?: number;
}

// The ring has 8 segments, each 45 degrees
// Triangle stopper is at top (0 degrees)
// Target positions (center of each segment, measured from top):
// Yellow (Photo): -22.5° (or 337.5°)
// Blue (Mix): 22.5°
// Purple (Video): 67.5°

const SEGMENT_ANGLES = {
  Photo: -22.5, // Yellow/Orange segment (unchanged)
  Mix: 67.5,    // Blue segment (changed from purple)
  Video: 22.5,  // Purple segment (changed from blue)
  Blind: -22.5, // Use Yellow/Orange for Blind mode (same as Photo)
  initial: 0,   // Between two segments
  random: null, // Will be randomly selected
};

export function AnimatedLogo({ targetMode, size = 280 }: AnimatedLogoProps) {
  const rotationAnim = useRef(new Animated.Value(0)).current;
  const [rotation, setRotation] = useState(0);
  const [wiggle, setWiggle] = useState(0);
  const isAnimating = useRef(false);
  const lastTargetMode = useRef<GameMode | undefined>(undefined);
  const prevRotation = useRef(0);

  useEffect(() => {
    // Listen to animation value changes
    const rotationListenerId = rotationAnim.addListener(({ value }) => {
      setRotation(value);
      // Create wiggle effect based on rotation speed
      const rotationSpeed = Math.abs(value - prevRotation.current);
      prevRotation.current = value;
      // Wiggle more when spinning fast, less when slowing down
      const wiggleAmount = Math.min(rotationSpeed / 5, 5); // Max 5 degrees wiggle
      setWiggle(wiggleAmount * Math.sin(value * 0.2));
    });

    return () => {
      rotationAnim.removeListener(rotationListenerId);
    };
  }, []);

  useEffect(() => {
    // Only animate if targetMode is provided and has changed
    if (targetMode === undefined) return; // Don't animate if targetMode is undefined
    if (lastTargetMode.current === targetMode) return;
    if (isAnimating.current) return;
    
    lastTargetMode.current = targetMode;
    isAnimating.current = true;
    
    // Calculate target angle
    let targetAngle = 0;
    
    if (targetMode === "random") {
      // Randomly select one of the three colors
      const modes: ("Photo" | "Video" | "Mix")[] = ["Photo", "Video", "Mix"];
      const randomMode = modes[Math.floor(Math.random() * modes.length)];
      targetAngle = SEGMENT_ANGLES[randomMode];
    } else {
      targetAngle = SEGMENT_ANGLES[targetMode] || 0;
    }

    // Get current rotation value from state
    const currentRotation = rotation;
    
    // Normalize current rotation to 0-360 range
    const normalizedCurrent = ((currentRotation % 360) + 360) % 360;
    
    // Calculate how many full rotations to add (exactly 1 full spin)
    const spins = 1;
    
    // Calculate the final rotation
    // We want to end at targetAngle, but we need to account for current position
    // Add spins and adjust to land on target
    // If targetAngle is negative, convert it to positive equivalent
    const normalizedTarget = ((targetAngle % 360) + 360) % 360;
    let angleDiff = normalizedTarget - normalizedCurrent;
    if (angleDiff < 0) angleDiff += 360;
    
    const totalRotation = currentRotation + (spins * 360) + angleDiff;
    
    // Create animation with custom easing for realistic roulette deceleration
    Animated.timing(rotationAnim, {
      toValue: totalRotation,
      duration: 2000 + Math.random() * 1000, // 2-3 seconds
      easing: Easing.bezier(0.25, 0.1, 0.25, 1), // Smooth deceleration curve
      useNativeDriver: false, // SVG transforms don't support native driver
    }).start(() => {
      isAnimating.current = false;
      setWiggle(0); // Stop wiggling when animation ends
    });
  }, [targetMode]);

  // Render the SVG with the current rotation
  return (
    <Svg width={size} height={size} viewBox="0 0 455.36 475.68">
      <Defs>
        <LinearGradient id="linear-gradient" x1="296.3" y1="158.23" x2="433.97" y2="158.23" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#eb7e31" />
          <Stop offset="0.24" stopColor="#eb8233" />
          <Stop offset="0.5" stopColor="#ed8f39" />
          <Stop offset="0.77" stopColor="#efa544" />
          <Stop offset="1" stopColor="#f3be51" />
        </LinearGradient>
        <LinearGradient id="linear-gradient-2" x1="229.68" y1="102.47" x2="361.02" y2="102.47" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#94509f" />
          <Stop offset="0.22" stopColor="#984b9d" />
          <Stop offset="0.47" stopColor="#a53e9a" />
          <Stop offset="0.72" stopColor="#bb2894" />
          <Stop offset="0.97" stopColor="#d90a8c" />
          <Stop offset="1" stopColor="#dd078c" />
        </LinearGradient>
        <LinearGradient id="linear-gradient-3" x1="94.34" y1="102.46" x2="225.68" y2="102.46" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#134ca1" />
          <Stop offset="0.25" stopColor="#1150a4" />
          <Stop offset="0.51" stopColor="#0d5dad" />
          <Stop offset="0.79" stopColor="#0673bd" />
          <Stop offset="1" stopColor="#0089cd" />
        </LinearGradient>
        <LinearGradient id="linear-gradient-4" x1="78.08" y1="241.32" x2="108.61" y2="109.81" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#eb7e31" />
          <Stop offset="0.24" stopColor="#eb8233" />
          <Stop offset="0.5" stopColor="#ed8f39" />
          <Stop offset="0.77" stopColor="#efa544" />
          <Stop offset="1" stopColor="#f3be51" />
        </LinearGradient>
        <LinearGradient id="linear-gradient-5" x1="17.85" y1="282.36" x2="136.29" y2="282.36" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#94509f" />
          <Stop offset="0.22" stopColor="#984b9d" />
          <Stop offset="0.47" stopColor="#a53e9a" />
          <Stop offset="0.72" stopColor="#bb2894" />
          <Stop offset="0.97" stopColor="#d90a8c" />
          <Stop offset="1" stopColor="#dd078c" />
        </LinearGradient>
        <LinearGradient id="linear-gradient-6" x1="46.96" y1="373.2" x2="190.1" y2="373.2" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#134ca1" />
          <Stop offset="0.25" stopColor="#1150a4" />
          <Stop offset="0.51" stopColor="#0d5dad" />
          <Stop offset="0.79" stopColor="#0673bd" />
          <Stop offset="1" stopColor="#0089cd" />
        </LinearGradient>
        <LinearGradient id="linear-gradient-7" x1="157.79" y1="402.29" x2="297.56" y2="402.29" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#eb7e31" />
          <Stop offset="0.24" stopColor="#eb8233" />
          <Stop offset="0.5" stopColor="#ed8f39" />
          <Stop offset="0.77" stopColor="#efa544" />
          <Stop offset="1" stopColor="#f3be51" />
        </LinearGradient>
        <LinearGradient id="linear-gradient-8" x1="265.26" y1="373.2" x2="408.39" y2="373.2" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#94509f" />
          <Stop offset="0.22" stopColor="#984b9d" />
          <Stop offset="0.47" stopColor="#a53e9a" />
          <Stop offset="0.72" stopColor="#bb2894" />
          <Stop offset="0.97" stopColor="#d90a8c" />
          <Stop offset="1" stopColor="#dd078c" />
        </LinearGradient>
        <LinearGradient id="linear-gradient-9" x1="319.08" y1="282.36" x2="437.51" y2="282.36" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#134ca1" />
          <Stop offset="0.25" stopColor="#1150a4" />
          <Stop offset="0.51" stopColor="#0d5dad" />
          <Stop offset="0.79" stopColor="#0673bd" />
          <Stop offset="1" stopColor="#0089cd" />
        </LinearGradient>
        <RadialGradient id="radial-gradient" cx="227.68" cy="248" fx="227.68" fy="248" r="59.46" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#003052" />
          <Stop offset="1" stopColor="#000031" />
        </RadialGradient>
      </Defs>
      
      {/* Rotating Ring - using transform on G element */}
      <G 
        id="Ring"
        transform={`rotate(${rotation}, 227.68, 248)`}
      >
        <G>
          <G>
            <Path fill="#fff" d="M364.08,88.55c36.38,31.09,61.12,73.94,69.89,121.04l-103.85,18.31c-4.46-22.71-16.39-43.38-33.82-58.58l67.78-80.78Z" />
            <Path fill="url(#linear-gradient)" d="M364.08,88.55c36.38,31.09,61.12,73.94,69.89,121.04l-103.85,18.31c-4.46-22.71-16.39-43.38-33.82-58.58l67.78-80.78Z" />
          </G>
          <Path stroke="#000" strokeWidth="3.33" strokeLinecap="round" strokeLinejoin="round" fill="none" d="M365.14,142.61c14.73,0,26.67,11.94,26.67,26.67s-11.94,26.67-26.67,26.67-26.67-11.94-26.67-26.67,11.94-26.67,26.67-26.67ZM386.6,185.11l-15.31-26.51M358.98,158.61h30.61M352.82,169.27l15.31-26.51M358.98,179.94l-15.31-26.51M371.3,179.94h-30.61M377.46,169.27l-15.31,26.51" />
        </G>
        <G>
          <G>
            <Path fill="#fff" d="M229.68,38.18c47.86.44,94.35,17.35,131.34,47.8l-67.78,80.78c-18.02-14.53-40.44-22.7-63.56-23.13V38.18Z" />
            <Path fill="url(#linear-gradient-2)" d="M229.68,38.18c47.86.44,94.35,17.35,131.34,47.8l-67.78,80.78c-18.02-14.53-40.44-22.7-63.56-23.13V38.18Z" />
          </G>
          <Path stroke="#000" strokeWidth="3.33" strokeLinecap="round" strokeLinejoin="round" fill="none" d="M292.15,128.4l-35.08-12.77c-2.77-1.01-4.2-4.07-3.19-6.84l12.77-35.08c1.01-2.77,4.07-4.2,6.84-3.19l35.08,12.77c2.77,1.01,4.2,4.07,3.19,6.84l-12.77,35.08c-1.01,2.77-4.07,4.2-6.84,3.19ZM303.56,81.48l-16.42,45.11M301.27,118.95l-10.02-3.65M260.27,91.26l45.11,16.42M309.48,96.4l-10.02-3.65M262.08,117.46l16.42-45.11M256.16,102.54l10.02,3.65M264.37,79.98l10.02,3.65" />
        </G>
        <G>
          <G>
            <Path fill="#fff" d="M94.34,85.98c36.94-30.43,83.43-47.35,131.34-47.81v105.45c-23.14.45-45.57,8.61-63.56,23.14l-67.78-80.77Z" />
            <Path fill="url(#linear-gradient-3)" d="M94.34,85.98c36.94-30.43,83.43-47.35,131.34-47.81v105.45c-23.14.45-45.57,8.61-63.56,23.14l-67.78-80.77Z" />
          </G>
          <Path stroke="#000" strokeWidth="3.75" strokeLinecap="round" strokeLinejoin="round" fill="none" d="M170.79,73.81c2.07-.75,4.39-.31,6.04,1.15l2.29,2.04c1.65,1.47,3.97,1.91,6.04,1.15l5.63-2.05c3.11-1.13,6.56.47,7.69,3.59l9.23,25.37c1.13,3.11-.47,6.56-3.59,7.69l-45.11,16.42c-3.11,1.13-6.56-.47-7.69-3.59l-9.23-25.37c-1.13-3.11.47-6.56,3.59-7.69l5.63-2.05c2.07-.75,3.56-2.58,3.88-4.76l.45-3.05c.32-2.18,1.81-4.01,3.88-4.76l11.26-4.1ZM171.32,92.77c4.67-1.7,9.84.71,11.54,5.38s-.71,9.84-5.38,11.54-9.84-.71-11.54-5.38.71-9.84,5.38-11.54Z" />
        </G>
        <G>
          <G>
            <Path fill="#fff" d="M21.39,209.6c8.74-47.05,33.47-89.9,69.88-121.05l67.78,80.78c-17.44,15.22-29.37,35.89-33.82,58.58l-103.84-18.31Z" />
            <Path fill="url(#linear-gradient-4)" d="M21.39,209.6c8.74-47.05,33.47-89.9,69.88-121.05l67.78,80.78c-17.44,15.22-29.37,35.89-33.82,58.58l-103.84-18.31Z" />
          </G>
          <Path stroke="#000" strokeWidth="3.33" strokeLinecap="round" strokeLinejoin="round" fill="none" d="M67.68,181.65c-7.36-12.75-2.99-29.06,9.76-36.43s29.06-2.99,36.43,9.76c7.36,12.75,2.99,29.06-9.76,36.43-12.75,7.36-29.06,2.99-36.43-9.76ZM93.76,141.81l-15.3,26.51M84.61,178.99l-15.31-26.51M96.93,178.99h-30.61M103.09,168.32l-15.3,26.51M96.93,157.65l15.31,26.51M84.61,157.65h30.61" />
        </G>
        <G>
          <G>
            <Path fill="#fff" d="M44.97,351.18c-23.55-41.66-32.15-90.39-24.28-137.64l103.85,18.31c-3.58,22.87.57,46.37,11.75,66.61l-91.32,52.72Z" />
            <Path fill="url(#linear-gradient-5)" d="M44.97,351.18c-23.55-41.66-32.15-90.39-24.28-137.64l103.85,18.31c-3.58,22.87.57,46.37,11.75,66.61l-91.32,52.72Z" />
          </G>
          <Path stroke="#000" strokeWidth="3.33" strokeLinecap="round" strokeLinejoin="round" fill="none" d="M91.87,251.96l6.48,36.77c.51,2.9-1.43,5.67-4.33,6.18l-36.77,6.48c-2.9.51-5.67-1.43-6.18-4.33l-6.48-36.77c-.51-2.9,1.43-5.67,4.33-6.18l36.77-6.48c2.9-.51,5.67,1.43,6.18,4.33ZM45.53,265.55l47.27-8.34M79.13,248.79l1.85,10.5M75.64,298.15l-8.34-47.27M55.49,252.96l1.85,10.5M97.43,283.48l-47.27,8.34M87.46,296.07l-1.85-10.5M63.83,300.23l-1.85-10.5" />
        </G>
        <G>
          <G>
            <Path fill="#fff" d="M154.04,444.48c-44.82-16.78-82.72-48.58-107.07-89.84l91.32-52.72c11.96,19.82,30.24,35.16,51.82,43.48l-36.06,99.09Z" />
            <Path fill="url(#linear-gradient-6)" d="M154.04,444.48c-44.82-16.78-82.72-48.58-107.07-89.84l91.32-52.72c11.96,19.82,30.24,35.16,51.82,43.48l-36.06,99.09Z" />
          </G>
          <Path stroke="#000" strokeWidth="3.75" strokeLinecap="round" strokeLinejoin="round" fill="none" d="M105.27,384.36c-1.69-1.42-2.46-3.65-2.02-5.81l.62-3.01c.44-2.16-.33-4.39-2.02-5.81l-4.59-3.85c-2.54-2.13-2.87-5.91-.74-8.45l17.36-20.68c2.13-2.54,5.91-2.87,8.45-.74l36.77,30.85c2.54,2.13,2.87,5.91.74,8.45l-17.36,20.68c-2.13,2.54-5.91,2.87-8.45.74l-4.59-3.85c-1.69-1.42-4.01-1.79-6.06-.98l-2.87,1.13c-2.05.81-4.38.43-6.06-.98l-9.18-7.7ZM121.43,374.42c-3.81-3.2-4.3-8.87-1.11-12.68,3.2-3.81,8.87-4.3,12.68-1.11,3.81,3.2,4.3,8.87,1.11,12.68s-8.87,4.3-12.68,1.11Z" />
        </G>
        <G>
          <G>
            <Path fill="#fff" d="M297.56,445.85c-45.12,15.96-94.59,15.96-139.77,0l36.07-99.09c21.9,7.5,45.76,7.5,67.64,0l36.06,99.09Z" />
            <Path fill="url(#linear-gradient-7)" d="M297.56,445.85c-45.12,15.96-94.59,15.96-139.77,0l36.07-99.09c21.9,7.5,45.76,7.5,67.64,0l36.06,99.09Z" />
          </G>
          <Path stroke="#000" strokeWidth="3.33" strokeLinecap="round" strokeLinejoin="round" fill="none" d="M250.22,419.74c-7.36,12.75-23.67,17.12-36.43,9.76-12.75-7.36-17.12-23.67-9.76-36.43,7.36-12.75,23.67-17.12,36.43-9.76,12.75,7.36,17.12,23.67,9.76,36.43ZM202.68,417.08h30.61M239.45,406.4l-15.31,26.51M233.29,395.74l15.3,26.51M220.97,395.74h30.61M214.81,406.41l15.31-26.51M220.97,417.07l-15.3-26.51" />
        </G>
        <G>
          <G>
            <Path fill="#fff" d="M408.39,354.64c-24.31,41.23-62.2,73.03-107.06,89.85l-36.07-99.09c21.6-8.33,39.88-23.68,51.81-43.48l91.32,52.72Z" />
            <Path fill="url(#linear-gradient-8)" d="M408.39,354.64c-24.31,41.23-62.2,73.03-107.06,89.85l-36.07-99.09c21.6-8.33,39.88-23.68,51.81-43.48l91.32,52.72Z" />
          </G>
          <Path stroke="#000" strokeWidth="3.33" strokeLinecap="round" strokeLinejoin="round" fill="none" d="M299.02,363.63l28.6-24c2.26-1.89,5.62-1.6,7.51.66l24,28.6c1.89,2.26,1.6,5.62-.66,7.51l-28.6,24c-2.26,1.89-5.62,1.6-7.51-.66l-24-28.6c-1.89-2.26-1.6-5.62.66-7.51ZM333.96,396.97l-30.85-36.77M302.64,376.25l8.17-6.86M347.13,354.59l-36.77,30.85M318.07,394.64l8.17-6.86M323.53,343.06l30.85,36.77M339.41,345.4l-8.17,6.86M354.84,363.78l-8.17,6.86" />
        </G>
        <G>
          <G>
            <Path fill="#fff" d="M434.66,213.53c7.88,47.21-.71,95.93-24.26,137.65l-91.32-52.72c11.19-20.27,15.33-43.77,11.74-66.61l103.84-18.31Z" />
            <Path fill="url(#linear-gradient-9)" d="M434.66,213.53c7.88,47.21-.71,95.93-24.26,137.65l-91.32-52.72c11.19-20.27,15.33-43.77,11.74-66.61l103.84-18.31Z" />
          </G>
          <Path stroke="#000" strokeWidth="3.75" strokeLinecap="round" strokeLinejoin="round" fill="none" d="M406.98,285.83c-.38,2.17-1.93,3.96-4.02,4.65l-2.91.97c-2.09.69-3.64,2.48-4.02,4.65l-1.04,5.9c-.58,3.26-3.69,5.44-6.95,4.87l-26.59-4.69c-3.26-.58-5.44-3.69-4.87-6.95l8.34-47.27c.58-3.26,3.69-5.44,6.95-4.87l26.59,4.69c3.26.58,5.44,3.69,4.87,6.95l-1.04,5.9c-.38,2.17.45,4.37,2.18,5.74l2.42,1.92c1.73,1.37,2.56,3.57,2.18,5.74l-2.08,11.8ZM390.29,276.8c-.86,4.9-5.53,8.16-10.43,7.3s-8.16-5.53-7.3-10.43,5.53-8.16,10.43-7.3,8.16,5.53,7.3,10.43Z" />
        </G>
      </G>
      
      {/* Fixed Center Circle */}
      <Circle cx="227.68" cy="248" r="225.18" stroke="#ffe5cc" strokeWidth="5" fill="none" />
      
      {/* Fixed Triangle Toggle (Stopper) - wiggles as wheel spins */}
      <G 
        transform={`rotate(${wiggle}, 227.68, 60)`}
      >
        <Polygon points="227.68,60 262.32,0 193.04,0 227.68,60" fill="#ffe5cc" />
      </G>
      
      {/* Fixed Center */}
      <G id="Center">
        <Circle cx="227.68" cy="248" r="59.46" fill="url(#radial-gradient)" />
        <G transform="translate(185.58, 298.15)">
          <SvgText 
            x="0" 
            y="0" 
            fontSize="140" 
            fontFamily="ArialRoundedMTBold, Arial Rounded MT Bold" 
            fill="#00aeef" 
            stroke="#00aeef" 
            strokeWidth="2" 
            textAnchor="middle" 
            alignmentBaseline="middle"
          >
            ?
          </SvgText>
        </G>
        <G id="Dots">
          <Circle cx="183.4" cy="266.24" r="2.36" fill="#00aeef" stroke="#00aeef" strokeWidth="2" />
          <Circle cx="282.33" cy="256.3" r=".95" fill="#00aeef" stroke="#00aeef" strokeWidth="2" />
          <Circle cx="268.54" cy="196.16" r=".58" fill="#00aeef" stroke="#00aeef" strokeWidth="2" />
          <Circle cx="202.68" cy="181.58" r=".8" fill="#00aeef" stroke="#00aeef" strokeWidth="2" />
        </G>
      </G>
    </Svg>
  );
}
