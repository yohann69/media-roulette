import { View, Text, Modal, TouchableOpacity, ScrollView } from "react-native";

interface ModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  showCloseButton?: boolean;
}

export function CustomModal({
  visible,
  onClose,
  title,
  subtitle,
  children,
  showCloseButton = true,
}: ModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-black/80 justify-center items-center p-5">
        <View className="bg-gray-800 rounded-3xl p-6 w-full max-w-md" style={{ maxHeight: "80%" }}>
          <View className="mb-4">
            <View className="flex-row justify-between items-start mb-2">
              <Text className="text-white text-2xl font-bold flex-1 pr-2">{title}</Text>
              {showCloseButton && (
                <TouchableOpacity onPress={onClose} className="pt-1">
                  <Text className="text-gray-400 text-3xl">×</Text>
                </TouchableOpacity>
              )}
            </View>
            {subtitle && (
              <Text className="text-gray-400 text-sm mt-1">{subtitle}</Text>
            )}
          </View>
          <ScrollView 
            showsVerticalScrollIndicator={false} 
            style={{ flexGrow: 0, flexShrink: 1 }}
            contentContainerStyle={{ flexGrow: 1 }}
          >
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
