import { Platform } from 'react-native';

import { colores } from '../../estilos/colores';
import { crearEstilosModulo } from '../../estilos/crearEstilosModulo';

export const styles = crearEstilosModulo({
  intro: { gap: 5, marginBottom: 3 },
  chatLayout: {
    width: '100%',
    flexDirection: Platform.OS === 'web' ? 'row' : 'column',
    alignItems: 'flex-start',
    gap: 16,
  },
  conversationColumn: { width: Platform.OS === 'web' ? 330 : '100%', gap: 9 },
  sectionLabel: { color: colores.bosque, fontSize: 16, fontWeight: '900', marginBottom: 2 },
  conversationCard: {
    width: '100%', backgroundColor: colores.blanco, borderRadius: 13, padding: 14, gap: 5,
    borderWidth: 1, borderColor: 'rgba(56,102,65,.18)',
  },
  conversationCardActive: { borderWidth: 2, borderColor: colores.verde, backgroundColor: '#F5F8E8' },
  conversationHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  contactName: { flex: 1, color: colores.bosque, fontSize: 16, fontWeight: '900' },
  unreadBadge: { minWidth: 24, height: 24, paddingHorizontal: 6, borderRadius: 12, backgroundColor: colores.verde, alignItems: 'center', justifyContent: 'center' },
  unreadText: { color: '#fff', fontSize: 12, fontWeight: '900' },
  loadMeta: { color: colores.bosque, fontSize: 12, fontWeight: '700' },
  preview: { color: colores.textoSuave, fontSize: 13, lineHeight: 18 },
  chatPanel: {
    flex: Platform.OS === 'web' ? 1 : undefined, width: Platform.OS === 'web' ? undefined : '100%',
    minHeight: 480, backgroundColor: colores.blanco, borderRadius: 16, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(56,102,65,.18)',
  },
  chatHeader: { paddingHorizontal: 18, paddingVertical: 15, backgroundColor: '#EEF4D5', borderBottomWidth: 1, borderBottomColor: 'rgba(56,102,65,.18)', gap: 3 },
  chatTitle: { color: colores.bosque, fontSize: 19, fontWeight: '900' },
  chatSubtitle: { color: colores.textoSuave, fontSize: 13 },
  messageArea: { minHeight: 280, padding: 16, gap: 10, backgroundColor: '#FBFCF5' },
  chatEmpty: { flex: 1, minHeight: 250, alignItems: 'center', justifyContent: 'center', gap: 4 },
  messageRow: { width: '100%', flexDirection: 'row', justifyContent: 'flex-start' },
  messageRowOwn: { justifyContent: 'flex-end' },
  messageBubble: { maxWidth: '82%', paddingHorizontal: 13, paddingVertical: 10, borderRadius: 14, backgroundColor: '#E7EDD3', gap: 3 },
  messageBubbleOwn: { backgroundColor: colores.bosque, borderBottomRightRadius: 4 },
  sender: { color: colores.bosque, fontSize: 12, fontWeight: '900' },
  senderOwn: { color: colores.crema },
  messageText: { color: colores.tinta, fontSize: 15, lineHeight: 21 },
  messageTextOwn: { color: '#fff' },
  messageTime: { color: colores.textoSuave, fontSize: 10, lineHeight: 14 },
  messageTimeOwn: { color: '#DCE8B4', textAlign: 'right' },
  composer: { padding: 14, borderTopWidth: 1, borderTopColor: 'rgba(56,102,65,.18)', gap: 8 },
  composerInput: { width: '100%', minHeight: 78, maxHeight: 150, textAlignVertical: 'top', backgroundColor: '#fff', borderWidth: 1, borderColor: 'rgba(56,102,65,.38)', borderRadius: 11, padding: 12, fontSize: 15, color: colores.tinta },
  composerFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  characterCount: { color: colores.textoSuave, fontSize: 11 },
  sendButton: { backgroundColor: colores.bosque, minHeight: 44, paddingHorizontal: 18, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  emptyCard: { width: '100%', maxWidth: 700, alignSelf: 'center', backgroundColor: colores.blanco, borderRadius: 16, padding: 24, gap: 7, borderWidth: 1, borderColor: 'rgba(56,102,65,.16)' },
});
