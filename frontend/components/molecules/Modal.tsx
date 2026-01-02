import { View, Text, Modal, TouchableOpacity, ScrollView } from "react-native";

interface ModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  showCloseButton?: boolean;
}

export function CustomModal({
  visible,
  onClose,
  title,
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
        <View className="bg-gray-800 rounded-3xl p-6 w-full max-w-md max-h-[80%]">
          <View className="flex-row justify-between items-center mb-5">
            <Text className="text-white text-2xl font-bold">{title}</Text>
            {showCloseButton && (
              <TouchableOpacity onPress={onClose}>
                <Text className="text-gray-400 text-3xl">×</Text>
              </TouchableOpacity>
            )}
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
