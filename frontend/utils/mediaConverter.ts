/**
 * Convert image URI to Base64 (React Native compatible)
 */
export async function convertImageToBase64(uri: string): Promise<string> {
  try {
    const response = await fetch(uri);
    const blob = await response.blob();
    
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        const base64 = base64String.includes(",") 
          ? base64String.split(",")[1] 
          : base64String;
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error("Error converting image to Base64:", error);
    return uri; // Fallback: return the URI as-is
  }
}

/**
 * Process media pool for upload (convert photos to Base64)
 */
export async function processMediaPool(mediaPool: any[]) {
  return Promise.all(
    mediaPool.map(async (item) => {
      if (item.mediaType === "photo") {
        try {
          const base64 = await convertImageToBase64(item.uri);
          return {
            id: item.id,
            mediaType: item.mediaType,
            base64: base64,
          };
        } catch (error) {
          console.error("Error converting image to Base64:", error);
          return {
            id: item.id,
            mediaType: item.mediaType,
            uri: item.uri,
          };
        }
      } else {
        return {
          id: item.id,
          mediaType: item.mediaType,
          uri: item.uri,
        };
      }
    })
  );
}

