import { useState, useEffect } from "react";
import { View, Text, Modal, TouchableOpacity } from "react-native";
import { useTranslation } from "../../hooks/useTranslation";

let CameraView: any = null;
let CameraType: any = null;
let useCameraPermissions: any = null;
let cameraAvailable = false;

try {
  const expoCamera = require("expo-camera");
  CameraView = expoCamera.CameraView;
  CameraType = expoCamera.CameraType;
  useCameraPermissions = expoCamera.useCameraPermissions;
  cameraAvailable = true;
} catch (e) {
  cameraAvailable = false;
}

interface QRScannerProps {
  visible: boolean;
  onClose: () => void;
  onScan: (pin: string) => void;
}

export function QRScanner({ visible, onClose, onScan }: QRScannerProps) {
  const { t } = useTranslation();
  const [permission, requestPermission] = cameraAvailable && useCameraPermissions 
    ? useCameraPermissions() 
    : [null, () => Promise.resolve({ granted: false })];
  const [scanned, setScanned] = useState(false);

  useEffect(() => {
    if (visible) {
      setScanned(false);
    }
  }, [visible]);

  const handleBarCodeScanned = ({ data }: { data: string }) => {
    if (scanned) return;
    
    setScanned(true);
    
    if (data.startsWith("photoroulette://")) {
      try {
        const httpUrl = data.replace("photoroulette://", "http://");
        const url = new URL(httpUrl);
        const pin = url.searchParams.get("pin");
        if (pin && /^\d{6}$/.test(pin)) {
          onScan(pin);
          onClose();
          return;
        }
      } catch (e) {
        // Fall through
      }
    }
    
    const pinMatch = data.match(/\d{6}/);
    if (pinMatch && pinMatch[0].length === 6) {
      onScan(pinMatch[0]);
      onClose();
      return;
    }
    
    setScanned(false);
  };

  if (!visible) return null;

  if (!cameraAvailable) {
    return (
      <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
        <View className="flex-1 bg-black/80 justify-center items-center p-5">
          <View className="bg-gray-800 rounded-3xl p-6 w-full max-w-md">
            <Text className="text-white text-2xl font-bold mb-4 text-center">
              {t("qrScanner.notAvailable")}
            </Text>
            <Text className="text-gray-400 text-center mb-6">
              {t("qrScanner.notAvailableMessage")}
            </Text>
            <Text className="text-gray-500 text-sm text-center mb-6">
              {t("qrScanner.notAvailableMessage2")}
            </Text>
            <TouchableOpacity
              onPress={onClose}
              className="bg-primary py-4 px-6 rounded-xl items-center"
            >
              <Text className="text-white text-lg font-bold">{t("common.close")}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  }

  if (!permission) {
    return (
      <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
        <View className="flex-1 bg-black/80 justify-center items-center p-5">
          <View className="bg-gray-800 rounded-3xl p-6 w-full max-w-md">
            <Text className="text-white text-xl font-bold mb-4 text-center">
              {t("qrScanner.cameraPermission")}
            </Text>
            <Text className="text-gray-400 text-center mb-6">
              {t("qrScanner.cameraPermissionMessage")}
            </Text>
            <TouchableOpacity
              onPress={onClose}
              className="bg-primary py-4 px-6 rounded-xl items-center"
            >
              <Text className="text-white text-lg font-bold">{t("common.close")}</Text>
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
              {t("qrScanner.cameraPermissionRequired")}
            </Text>
            <Text className="text-gray-400 text-center mb-6">
              {t("qrScanner.cameraPermissionMessage2")}
            </Text>
            <View className="gap-3">
              <TouchableOpacity
                onPress={requestPermission}
                className="bg-primary py-4 px-6 rounded-xl items-center"
              >
                <Text className="text-white text-lg font-bold">{t("qrScanner.grantPermission")}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={onClose}
                className="bg-gray-700 py-4 px-6 rounded-xl items-center"
              >
                <Text className="text-white text-lg font-bold">{t("common.cancel")}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  }

  if (!CameraView) {
    return null;
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
                  {t("qrScanner.title")}
                </Text>
                <Text className="text-gray-300 text-center">
                  {t("qrScanner.description")}
                </Text>
              </View>

              <View className="items-center mb-8">
                <View className="w-64 h-64 border-4 border-primary rounded-2xl items-center justify-center">
                  {scanned && (
                    <View className="bg-primary/20 rounded-xl p-4">
                      <Text className="text-white text-center font-semibold">
                        {t("qrScanner.scanned")}
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
                  <Text className="text-white text-lg font-bold">{t("common.cancel")}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </CameraView>
      </View>
    </Modal>
  );
}
