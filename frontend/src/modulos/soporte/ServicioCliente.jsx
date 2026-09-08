import { useCallback, useState } from 'react';
import { ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';

import FeedbackMessage from '../../componentes/comunes/MensajeRetroalimentacion';
import { API_BASE_URL, fetchApi } from '../../configuracion';
import usePolling from '../../ganchos/usarSondeo';
import { styles } from './ServicioCliente.styles';

const estadoVisible = {
  pendiente: 'Pendiente',
  'en camino': 'En camino',
  entregado: 'Entregado',
  cancelado: 'Cancelado',
};

const fechaCorta = (value) => value
  ? new Date(value).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })
  : '';

export default function ServicioCliente({ go, token, user }) {
  const [conversations, setConversations] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const role = String(user?.rol || '').toLowerCase();

  const loadMessages = useCallback(async (deliveryId) => {
    if (!deliveryId) return;
    const response = await fetchApi(`${API_BASE_URL}/soporte/conversaciones/${deliveryId}/mensajes`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const result = await response.json();
    if (!response.ok) throw Error(result.detail || 'No se pudo abrir la conversación.');
    setMessages(result);
  }, [token]);

  const load = useCallback(async () => {
    try {
      const response = await fetchApi(`${API_BASE_URL}/soporte/conversaciones`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = await response.json();
      if (!response.ok) throw Error(result.detail || 'No se pudieron cargar las conversaciones.');
      setConversations(result);
      const nextId = result.some((item) => item.entrega_id === selectedId)
        ? selectedId
        : result[0]?.entrega_id;
      if (nextId) {
        setSelectedId(nextId);
        await loadMessages(nextId);
      } else {
        setSelectedId(null);
        setMessages([]);
      }
      setError('');
    } catch (reason) {
      setError(reason.message);
    }
  }, [loadMessages, selectedId, token]);

  usePolling(load, 12000);

  const openConversation = async (deliveryId) => {
    setSelectedId(deliveryId);
    setError('');
    try {
      await loadMessages(deliveryId);
      setConversations((current) => current.map((item) => (
        item.entrega_id === deliveryId ? { ...item, mensajes_no_leidos: 0 } : item
      )));
    } catch (reason) {
      setError(reason.message);
    }
  };

  const send = async () => {
    const content = draft.trim();
    if (!selectedId || !content || sending) return;
    setSending(true);
    setError('');
    try {
      const response = await fetchApi(`${API_BASE_URL}/soporte/conversaciones/${selectedId}/mensajes`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ mensaje: content }),
      });
      const result = await response.json();
      if (!response.ok) throw Error(result.detail || 'No se pudo enviar el mensaje.');
      setMessages((current) => [...current, result]);
      setDraft('');
      await load();
    } catch (reason) {
      setError(reason.message);
    } finally {
      setSending(false);
    }
  };

  const selected = conversations.find((item) => item.entrega_id === selectedId);
  const contactName = role === 'caficultor' ? selected?.coordinador_nombre : selected?.caficultor_nombre;

  return <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
    <View style={styles.intro}>
      <Text style={styles.title}>Servicio al cliente</Text>
      <Text style={styles.muted}>{role === 'caficultor'
        ? 'Habla directamente con el coordinador responsable de tu carga.'
        : 'Responde las consultas de los caficultores cuyas cargas coordinaste.'}</Text>
    </View>
    {error ? <FeedbackMessage type="error">{error}</FeedbackMessage> : null}

    {!conversations.length && !error ? <View style={styles.emptyCard}>
      <Text style={styles.cardTitle}>Aún no hay conversaciones disponibles</Text>
      <Text style={styles.muted}>{role === 'caficultor'
        ? 'El canal se habilitará automáticamente cuando un coordinador asigne conductor y vehículo a tu carga.'
        : 'Aquí aparecerán las cargas que hayas tomado y sus mensajes.'}</Text>
    </View> : null}

    {conversations.length ? <View style={styles.chatLayout}>
      <View style={styles.conversationColumn}>
        <Text style={styles.sectionLabel}>Cargas atendidas</Text>
        {conversations.map((item) => {
          const active = item.entrega_id === selectedId;
          const otherName = role === 'caficultor' ? item.coordinador_nombre : item.caficultor_nombre;
          return <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={`Abrir conversación con ${otherName}`}
            key={item.entrega_id}
            style={[styles.conversationCard, active && styles.conversationCardActive]}
            onPress={() => openConversation(item.entrega_id)}
          >
            <View style={styles.conversationHeader}>
              <Text style={styles.contactName}>{otherName}</Text>
              {item.mensajes_no_leidos ? <View style={styles.unreadBadge}><Text style={styles.unreadText}>{item.mensajes_no_leidos}</Text></View> : null}
            </View>
            <Text style={styles.loadMeta}>{Number(item.cantidad_kg).toLocaleString('es-CO')} kg · {estadoVisible[item.estado_entrega] || item.estado_entrega}</Text>
            <Text numberOfLines={2} style={styles.preview}>{item.ultimo_mensaje || 'Inicia la conversación sobre esta carga.'}</Text>
            {item.ultimo_mensaje_en ? <Text style={styles.messageTime}>{fechaCorta(item.ultimo_mensaje_en)}</Text> : null}
          </TouchableOpacity>;
        })}
      </View>

      {selected ? <View style={styles.chatPanel}>
        <View style={styles.chatHeader}>
          <Text style={styles.chatTitle}>{contactName}</Text>
          <Text style={styles.chatSubtitle}>Carga de {Number(selected.cantidad_kg).toLocaleString('es-CO')} kg · {estadoVisible[selected.estado_entrega] || selected.estado_entrega}</Text>
        </View>
        <View style={styles.messageArea}>
          {!messages.length ? <View style={styles.chatEmpty}>
            <Text style={styles.cardTitle}>¿Cómo podemos ayudarte?</Text>
            <Text style={styles.muted}>Escribe el primer mensaje de esta conversación.</Text>
          </View> : messages.map((message) => <View key={message.id_mensaje} style={[styles.messageRow, message.es_propio && styles.messageRowOwn]}>
            <View style={[styles.messageBubble, message.es_propio && styles.messageBubbleOwn]}>
              <Text style={[styles.sender, message.es_propio && styles.senderOwn]}>{message.es_propio ? 'Tú' : message.remitente_nombre}</Text>
              <Text style={[styles.messageText, message.es_propio && styles.messageTextOwn]}>{message.mensaje}</Text>
              <Text style={[styles.messageTime, message.es_propio && styles.messageTimeOwn]}>{fechaCorta(message.fecha_hora)}</Text>
            </View>
          </View>)}
        </View>
        <View style={styles.composer}>
          <TextInput
            accessibilityLabel="Mensaje para servicio al cliente"
            style={styles.composerInput}
            value={draft}
            onChangeText={(value) => setDraft(value.slice(0, 800))}
            placeholder={`Escribe a ${contactName || 'tu contacto'}…`}
            multiline
            maxLength={800}
          />
          <View style={styles.composerFooter}>
            <Text style={styles.characterCount}>{draft.length}/800</Text>
            <TouchableOpacity style={[styles.sendButton, (!draft.trim() || sending) && styles.buttonDisabled]} disabled={!draft.trim() || sending} onPress={send}>
              <Text style={styles.primaryText}>{sending ? 'Enviando…' : 'Enviar mensaje'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View> : null}
    </View> : null}

  </ScrollView>;
}
