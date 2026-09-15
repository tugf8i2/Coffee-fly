import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

export default function SelectorFormulario({ label, value, onValueChange, options, placeholder = 'Selecciona una opción', disabled = false }) {
  const [open, setOpen] = useState(false);
  const selectedLabel = options.find(([key]) => key === value)?.[1];
  return <>
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityValue={{ text: selectedLabel || placeholder }}
      accessibilityState={{ expanded: open, disabled }} disabled={disabled} onPress={() => setOpen(true)} style={[s.field, disabled && { opacity: 0.6 }]}>
      <Text style={s.value}>{selectedLabel || placeholder}</Text><Text style={s.arrow}>▾</Text>
    </Pressable>
    <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
      <View style={s.overlay}>
        <Pressable style={StyleSheet.absoluteFill} accessibilityRole="button" accessibilityLabel="Cerrar opciones" onPress={() => setOpen(false)} />
        <View style={s.dialog} accessibilityViewIsModal>
          <Text style={s.title}>{label}</Text>
          <ScrollView keyboardShouldPersistTaps="handled">
            {options.map(([key, text]) => <Pressable key={key} accessibilityRole="radio" accessibilityState={{ checked: value === key }}
              onPress={() => { onValueChange(key); setOpen(false); }} style={[s.option, value === key && s.selected]}>
              <Text style={s.value}>{text}</Text>{value === key ? <Text style={s.arrow}>✓</Text> : null}
            </Pressable>)}
          </ScrollView>
          <Pressable accessibilityRole="button" onPress={() => setOpen(false)} style={s.option}><Text style={s.arrow}>Cancelar</Text></Pressable>
        </View>
      </View>
    </Modal>
  </>;
}

const s = StyleSheet.create({
  field: { width: '100%', maxWidth: 620, minHeight: 48, borderWidth: 1, borderColor: '#B7CBBE', borderRadius: 10, backgroundColor: '#FFFFFF', paddingHorizontal: 14, paddingVertical: 11, flexDirection: 'row', alignItems: 'center', gap: 12 },
  value: { flex: 1, fontSize: 16, lineHeight: 22, color: '#23372A' },
  arrow: { fontSize: 16, color: '#287457', fontWeight: '700' },
  overlay: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: 'rgba(0,0,0,.4)' },
  dialog: { width: '100%', maxWidth: 480, maxHeight: '75%', alignSelf: 'center', backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16 },
  title: { fontSize: 18, fontWeight: '700', color: '#123F34', marginBottom: 12 },
  option: { minHeight: 48, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 8 },
  selected: { backgroundColor: '#E8F2EB' },
});
