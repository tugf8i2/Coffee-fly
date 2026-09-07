import { Platform, StyleSheet } from 'react-native';

const colors = { cream: '#DCE8B4', lime: '#A7C957', green: '#6A994E', forest: '#386641', white: '#FFFDF7', ink: '#23372A' };

export const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.cream },
  header: { minHeight: 64, backgroundColor: colors.forest, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingVertical: 6 },
  logo: { width: 46, height: 46, resizeMode: 'contain' }, brand: { color: '#fff', fontWeight: '800', letterSpacing: 2, fontSize: 19 },
  headerButton: { backgroundColor: colors.lime, color: colors.forest, fontWeight: '800', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 18 },
  connectionBanner: { backgroundColor: '#EEF4D5', borderBottomWidth: 1, borderColor: 'rgba(56,102,65,.2)', paddingHorizontal: 18, paddingVertical: 6 },
  connectionText: { color: colors.forest, fontWeight: '700', maxWidth: 1180, width: '100%', alignSelf: 'center' },
  page: { width: '100%', maxWidth: 1180, alignSelf: 'center', paddingHorizontal: 16, paddingVertical: 18, gap: 11 },
  content: { width: '100%', maxWidth: 720, alignSelf: 'center', gap: 11 },
  title: { fontSize: 25, lineHeight: 31, fontWeight: '800', color: colors.forest }, section: { fontSize: 20, lineHeight: 26, fontWeight: '800', color: colors.forest, marginTop: 5 },
  label: { fontWeight: '700', color: colors.forest, marginBottom: 4 }, field: { width: '100%', maxWidth: 620 },
  input: { width: '100%', maxWidth: 620, minHeight: 44, backgroundColor: '#fff', borderWidth: 1, borderColor: 'rgba(56,102,65,.32)', borderRadius: 9, paddingHorizontal: 12, paddingVertical: 9, fontSize: 15, color: colors.ink },
  textArea: { minHeight: 82, textAlignVertical: 'top' },
  formCard: { width: '100%', maxWidth: 680, alignSelf: 'center', backgroundColor: colors.white, borderRadius: 14, padding: 16, gap: 10, borderWidth: 1, borderColor: 'rgba(56,102,65,.12)' },
  primary: { backgroundColor: colors.forest, paddingHorizontal: 16, paddingVertical: 11, minHeight: 44, borderRadius: 9, alignItems: 'center', justifyContent: 'center' }, primaryText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  link: { color: colors.forest, fontWeight: '800', textAlign: 'center', paddingVertical: 7 }, error: { color: '#B42318', fontWeight: '700' }, success: { color: '#256029', fontWeight: '700' }, muted: { color: '#526451', fontSize: 14, lineHeight: 20 },
  grid: { width: '100%', flexDirection: 'row', flexWrap: 'wrap', alignItems: 'stretch', gap: 12 },
  card: { flexGrow: 1, flexBasis: Platform.OS === 'web' ? 270 : '100%', maxWidth: Platform.OS === 'web' ? 370 : '100%', minWidth: Platform.OS === 'web' ? 250 : '100%', backgroundColor: colors.white, borderRadius: 12, padding: 14, gap: 6, borderWidth: 1, borderColor: 'rgba(56,102,65,.13)', shadowColor: '#1d3322', shadowOpacity: .07, shadowRadius: 6, elevation: 2 },
  fullCard: { width: '100%', backgroundColor: colors.white, borderRadius: 12, padding: 14, gap: 8, borderWidth: 1, borderColor: 'rgba(56,102,65,.13)', overflow: 'hidden' },
  mapPanel: { width: '100%', minHeight: 320, backgroundColor: colors.white, borderRadius: 14, padding: 12, overflow: 'hidden' },
  formRow: { width: '100%', flexDirection: Platform.OS === 'web' ? 'row' : 'column', flexWrap: 'wrap', gap: 10 },
  bagGroup: { width: '100%', backgroundColor: '#F2F8DF', borderRadius: 10, padding: 12, gap: 7, borderWidth: 1, borderColor: 'rgba(56,102,65,.18)' },
  secondary: { borderWidth: 2, borderColor: colors.green, borderStyle: 'dashed', borderRadius: 9, padding: 11, alignItems: 'center' }, secondaryText: { color: colors.forest, fontWeight: '800' }, removeLink: { color: '#B42318', fontWeight: '700', paddingVertical: 5 },
  cardSelected: { borderWidth: 2, borderColor: colors.green, backgroundColor: '#F2F8DF' }, cardTitle: { fontSize: 17, lineHeight: 22, fontWeight: '800', color: colors.forest }, cardLink: { color: colors.green, fontWeight: '800' },
  statusActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 4 }, statusButton: { backgroundColor: colors.lime, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8 }, statusButtonText: { color: colors.forest, fontWeight: '800' },
  history: { gap: 4, marginTop: 6, paddingTop: 7, borderTopWidth: 1, borderColor: 'rgba(56,102,65,.18)' }, role: { backgroundColor: colors.cream, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 18 }, roleActive: { backgroundColor: colors.lime },
  metric: { flexGrow: 1, flexBasis: Platform.OS === 'web' ? 190 : '45%', minWidth: 145, backgroundColor: colors.forest, borderRadius: 11, padding: 12, gap: 2 }, metricLabel: { color: '#DCE8B4', fontWeight: '700', textTransform: 'capitalize' }, metricValue: { color: '#fff', fontSize: 23, fontWeight: '800' },
  totalBox: { backgroundColor: '#EEF4D5', borderRadius: 10, padding: 12, borderLeftWidth: 5, borderLeftColor: colors.green }, totalLabel: { color: colors.forest, fontWeight: '700' }, totalValue: { color: colors.forest, fontSize: 27, fontWeight: '900' },
  readonly: { width: '100%', maxWidth: 620, backgroundColor: '#EEF4D5', color: colors.forest, padding: 10, borderRadius: 8, fontWeight: '700' },
});
