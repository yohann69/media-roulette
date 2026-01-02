import { useState, useEffect } from "react";
import { View, Text, Modal, TouchableOpacity, ActivityIndicator } from "react-native";
import { CameraView, CameraType, useCameraPermissions } from "expo-camera";

interface QRScannerProps {
  visible: boolean;
  onClose: () => void;
  onScan: (pin: string) => void;
}

export function QRScanner({ visible, onClose, onScan }: QRScannerProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);

  useEffect(() => {
    if (visible) {
      setScanned(false);
    }
  }, [visible]);

  const handleBarCodeScanned = ({ data }: { data: string }) => {
    if (scanned) return;
    
    setScanned(true);
    
    // Extract PIN from deep link format: photoroulette://join?pin=123456
    if (data.startsWith("photoroulette://")) {
      try {
        // Replace custom protocol with http:// for URL parsing
        const httpUrl = data.replace("photoroulette://", "http://");
        const url = new URL(httpUrl);
        const pin = url.searchParams.get("pin");
        if (pin && /^\d{6}$/.test(pin)) {
          onScan(pin);
          onClose();
          return;
        }
      } catch (e) {
        // Fall through to direct PIN extraction
      }
    }
    
    // Fallback: try to extract 6-digit PIN directly
    const pinMatch = data.match(/\d{6}/);
    if (pinMatch && pinMatch[0].length === 6) {
      onScan(pinMatch[0]);
      onClose();
      return;
    }
    
    // If we get here, the QR code didn't contain a valid PIN
    setScanned(false);
  };

  if (!visible) return null;

  if (!permission) {
    return (
      <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
        <View className="flex-1 bg-black/80 justify-center items-center p-5">
          <View className="bg-gray-800 rounded-3xl p-6 w-full max-w-md">
            <Text className="text-white text-xl font-bold mb-4 text-center">
              Camera Permission
            </Text>
            <Text className="text-gray-400 text-center mb-6">
              We need access to your camera to scan QR codes.
            </Text>
            <TouchableOpacity
              onPress={onClose}
              className="bg-primary py-4 px-6 rounded-xl items-center"
            >
              <Text className="text-white text-lg font-bold">Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  }

  if (!permission.granted) {
    return (
      <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
        <View className="flex-1 bg-black/80 justify-center items-center p-5">
          <View className="bg-gray-800 rounded-3xl p-6 w-full max-w-md">
            <Text className="text-white text-xl font-bold mb-4 text-center">
              Camera Permission Required
            </Text>
            <Text className="text-gray-400 text-center mb-6">
              Please grant camera permission to scan QR codes.
            </Text>
            <View className="gap-3">
              <TouchableOpacity
                onPress={requestPermission}
                className="bg-primary py-4 px-6 rounded-xl items-center"
              >
                <Text className="text-white text-lg font-bold">Grant Permission</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={onClose}
                className="bg-gray-700 py-4 px-6 rounded-xl items-center"
              >
                <Text className="text-white text-lg font-bold">Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 bg-black">
        <CameraView
          style={{ flex: 1 }}
          facing={CameraType.back}
          onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
          barcodeScannerSettings={{
            barcodeTypes: ["qr"],
          }}
        >
          <View className="flex-1 bg-black/50">
            <View className="flex-1 justify-between p-6">
              <View className="items-center pt-12">
                <Text className="text-white text-2xl font-bold mb-2">
                  Scan QR Code
                </Text>
                <Text className="text-gray-300 text-center">
                  Point your camera at the QR code
                </Text>
              </View>

              <View className="items-center mb-8">
                <View className="w-64 h-64 border-4 border-primary rounded-2xl items-center justify-center">
                  {scanned && (
                    <View className="bg-primary/20 rounded-xl p-4">
                      <Text className="text-white text-center font-semibold">
                        QR Code Scanned!
                      </Text>
                    </View>
                  )}
                </View>
              </View>

              <View className="gap-3">
                <TouchableOpacity
                  onPress={onClose}
                  className="bg-gray-800 py-4 px-6 rounded-xl items-center"
                >
                  <Text className="text-white text-lg font-bold">Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </CameraView>
      </View>
    </Modal>
  );
}

