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
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(0, 0, 0, 0.8)",
          justifyContent: "center",
          alignItems: "center",
          padding: 20,
        }}
      >
        <View
          style={{
            backgroundColor: "#111827",
            borderRadius: 20,
            padding: 24,
            width: "100%",
            maxWidth: 400,
            maxHeight: "80%",
          }}
        >
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 20,
            }}
          >
            <Text
              style={{
                color: "#ffffff",
                fontSize: 24,
                fontWeight: "bold",
              }}
            >
              {title}
            </Text>
            {showCloseButton && (
              <TouchableOpacity onPress={onClose}>
                <Text style={{ color: "#9ca3af", fontSize: 24 }}>×</Text>
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

