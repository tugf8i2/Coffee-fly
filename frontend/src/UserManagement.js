import { useEffect, useState } from 'react';
import { Alert, Image, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { API_BASE_URL } from './config';

const emptyForm = {
  nombre_usuario: '', apellido: '', correo_usuario: '', telefono_usuario: '', contrasena: '', rol_id: 1,
  licencia: '', foto_licencia: '', tiene_foto_licencia: false, departamento: '', municipio: '', vereda: '',
};

const domain = '@coffeeFly.com';

function generatedEmail(nombre, apellido) {
  const normalize = (value) => String(value || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z]/g, '').toLowerCase();
  const firstName = normalize(nombre);
  const lastName = normalize(apellido);
  const maxFirstName = Math.max(1, 30 - domain.length - 1 - 3);
  return firstName ? `${firstName.slice(0, maxFirstName)}.${lastName.slice(-3)}${domain}` : '';
}

export default function UserManagement({ go, token, styles }) {
  const [users, setUsers] = useState([]);
  const [statusByUser, setStatusByUser] = useState({});
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [message, setMessage] = useState('');

  const headers = { Authorization: `Bearer ${token}` };

  const loadUsers = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/usuarios/`, { headers });
      const list = await response.json();
      if (!response.ok || !Array.isArray(list)) throw Error(list.detail || 'No se pudieron cargar los usuarios');
      setUsers(list);
      const states = await Promise.all(list.map(async (user) => {
        const stateResponse = await fetch(`${API_BASE_URL}/usuarios/${user.id_usuario}/estado`, { headers });
        return [user.id_usuario, stateResponse.ok ? await stateResponse.json() : {}];
      }));
      setStatusByUser(Object.fromEntries(states));
    } catch (error) {
      setMessage(error.message);
    }
  };

  useEffect(() => { loadUsers(); }, []);

  const updateField = (field, value) => {
    const next = { ...form, [field]: value };
    if (field === 'nombre_usuario' || field === 'apellido') {
      next.correo_usuario = generatedEmail(
        field === 'nombre_usuario' ? value : form.nombre_usuario,
        field === 'apellido' ? value : form.apellido,
      );
    }
    setForm(next);
  };

  const selectLicensePhoto = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return setMessage('Selecciona un archivo de imagen para la licencia.');
    if (file.size > 3 * 1024 * 1024) return setMessage('La foto de la licencia no puede superar 3 MB.');
    const reader = new FileReader();
    reader.onload = () => {
      setForm((current) => ({ ...current, foto_licencia: reader.result, tiene_foto_licencia: true }));
      setMessage('Foto de licencia seleccionada correctamente.');
    };
    reader.readAsDataURL(file);
  };

  const startEdit = (user) => {
    setEditingId(user.id_usuario);
    setForm({ ...user, contrasena: '' });
    setMessage(`Editando el perfil de ${user.nombre_usuario}.`);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm(emptyForm);
    setMessage('');
  };

  const save = async () => {
    if (!form.nombre_usuario.trim() || !form.apellido.trim()) return setMessage('Nombre y apellido son obligatorios.');
    if (form.telefono_usuario.length !== 10) return setMessage('El teléfono debe tener exactamente 10 dígitos.');
    if (!editingId && form.contrasena.length < 7) return setMessage('La contraseña debe tener mínimo 7 caracteres.');
    const roleId = Number(form.rol_id);
    if (![1, 2, 3, 4].includes(roleId)) return setMessage('Selecciona un rol válido entre 1 y 4.');
    if (roleId === 2 && (!form.licencia || (!form.foto_licencia && !form.tiene_foto_licencia))) {
      return setMessage('Para el conductor debes seleccionar el tipo y agregar la foto de la licencia.');
    }
    if (roleId === 4 && (!form.departamento.trim() || !form.municipio.trim() || !form.vereda.trim())) {
      return setMessage('Para el caficultor debes completar departamento, municipio y vereda.');
    }
    const payload = { ...form, rol_id: roleId };
    if (editingId && !payload.contrasena) delete payload.contrasena;
    delete payload.tiene_foto_licencia;
    if (editingId && !payload.foto_licencia) delete payload.foto_licencia;
    if (roleId !== 2) {
      delete payload.licencia;
      delete payload.foto_licencia;
    }
    const original = users.find((user) => user.id_usuario === editingId);
    if (editingId && original && original.nombre_usuario === payload.nombre_usuario && original.apellido === payload.apellido) {
      delete payload.correo_usuario;
    }
    const response = await fetch(
      editingId ? `${API_BASE_URL}/usuarios/${editingId}` : `${API_BASE_URL}/usuarios/`,
      { method: editingId ? 'PUT' : 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) },
    );
    const result = await response.json();
    if (!response.ok) return setMessage(result.detail?.[0]?.msg || result.detail || 'No se pudo guardar el perfil.');
    setMessage(editingId ? 'Perfil actualizado correctamente.' : 'Usuario creado correctamente.');
    setEditingId(null);
    setForm(emptyForm);
    loadUsers();
  };

  const changeStatus = async (id, habilitado) => {
    const response = await fetch(`${API_BASE_URL}/usuarios/${id}/estado`, {
      method: 'PUT', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ habilitado }),
    });
    const result = await response.json();
    setMessage(response.ok ? result.mensaje : (result.detail || 'No se pudo cambiar el estado.'));
    if (response.ok) loadUsers();
  };

  const remove = async (id) => {
    const response = await fetch(`${API_BASE_URL}/usuarios/${id}`, { method: 'DELETE', headers });
    const result = await response.json();
    setMessage(response.ok ? 'Perfil eliminado.' : (result.detail || 'No se pudo eliminar el perfil.'));
    if (response.ok) loadUsers();
  };

  const confirmRemove = (user) => {
    const confirmation = `¿Seguro que quieres eliminar a ${user.nombre_usuario} ${user.apellido}? Esta acción no se puede deshacer.`;

    // React Native Web no procesa las acciones de Alert. En navegador se usa
    // confirm para que el botón Eliminar ejecute realmente la petición DELETE.
    if (Platform.OS === 'web') {
      if (window.confirm(confirmation)) remove(user.id_usuario);
      return;
    }

    Alert.alert(
      'Eliminar perfil',
      confirmation,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Eliminar', style: 'destructive', onPress: () => remove(user.id_usuario) },
      ],
    );
  };

  const field = (label, key, options = {}) => <View key={key}>
    <Text style={styles.label}>{label}</Text>
    <TextInput style={styles.input} value={String(form[key] ?? '')} onChangeText={(value) => updateField(key, value)} {...options} />
  </View>;

  return <ScrollView contentContainerStyle={styles.page}>
    <Text style={styles.title}>{editingId ? 'Editar perfil de usuario' : 'Administrar perfiles'}</Text>
    <Text style={styles.muted}>Selecciona “Editar perfil” en un usuario para cargar sus datos aquí.</Text>
    {message ? <Text style={styles.error}>{message}</Text> : null}
    <View style={styles.card}>
      {field('Nombre', 'nombre_usuario')}
      {field('Apellido', 'apellido')}
      <Text style={styles.label}>Correo institucional</Text>
      <TextInput style={styles.input} value={form.correo_usuario} editable={false} />
      <Text style={styles.muted}>Se actualiza automáticamente al cambiar nombre o apellido.</Text>
      {field('Teléfono (10 dígitos)', 'telefono_usuario', { keyboardType: 'phone-pad', maxLength: 10 })}
      {field(editingId ? 'Nueva contraseña (opcional)' : 'Contraseña (mínimo 7 caracteres)', 'contrasena', { secureTextEntry: true })}
      <Text style={styles.label}>Rol</Text>
      {Platform.OS === 'web' ? <select
        value={String(form.rol_id ?? '')}
        onChange={(event) => updateField('rol_id', event.target.value)}
        style={{ ...styles.input, width: '100%' }}
      >
        <option value="">Selecciona un rol</option>
        <option value="1">Coordinador</option>
        <option value="2">Conductor</option>
        <option value="3">Registrador</option>
        <option value="4">Caficultor</option>
      </select> : <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {[
          ['1', 'Coordinador'], ['2', 'Conductor'], ['3', 'Registrador'], ['4', 'Caficultor'],
        ].map(([id, name]) => <TouchableOpacity key={id} style={[styles.role, Number(form.rol_id) === Number(id) && styles.roleActive]} onPress={() => updateField('rol_id', id)}><Text>{name}</Text></TouchableOpacity>)}
      </View>}
      {Number(form.rol_id) === 2 ? <View>
        <Text style={styles.section}>Datos del conductor</Text>
        <Text style={styles.label}>Tipo de licencia</Text>
        {Platform.OS === 'web' ? <select
          value={form.licencia || ''}
          onChange={(event) => updateField('licencia', event.target.value)}
          style={{ ...styles.input, width: '100%' }}
        >
          <option value="">Selecciona el tipo de licencia</option>
          {['B2', 'B3', 'C1', 'C2', 'C3'].map((type) => <option key={type} value={type}>{type}</option>)}
        </select> : <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {['B2', 'B3', 'C1', 'C2', 'C3'].map((type) => <TouchableOpacity key={type} style={[styles.role, form.licencia === type && styles.roleActive]} onPress={() => updateField('licencia', type)}><Text>{type}</Text></TouchableOpacity>)}
        </View>}
        <Text style={styles.label}>Foto de la licencia de conducir</Text>
        {Platform.OS === 'web' ? <input type="file" accept="image/*" onChange={selectLicensePhoto} style={{ marginBottom: 8 }} /> : <Text style={styles.muted}>La carga de foto está disponible en la versión web.</Text>}
        {form.foto_licencia ? <Image source={{ uri: form.foto_licencia }} style={{ width: 180, height: 110, resizeMode: 'contain', alignSelf: 'flex-start' }} /> : form.tiene_foto_licencia ? <Text style={styles.muted}>Ya hay una foto guardada. Selecciona otra para reemplazarla.</Text> : <Text style={styles.muted}>Formatos permitidos: imagen. Tamaño máximo: 3 MB.</Text>}
      </View> : null}
      {Number(form.rol_id) === 4 ? <View>
        <Text style={styles.section}>Datos del caficultor</Text>
        {field('Departamento', 'departamento', { maxLength: 100 })}
        {field('Municipio', 'municipio', { maxLength: 100 })}
        {field('Vereda', 'vereda', { maxLength: 100 })}
      </View> : null}
      <TouchableOpacity style={styles.primary} onPress={save}><Text style={styles.primaryText}>{editingId ? 'Guardar cambios' : 'Crear usuario'}</Text></TouchableOpacity>
      {editingId ? <TouchableOpacity onPress={cancelEdit}><Text style={styles.link}>Cancelar edición</Text></TouchableOpacity> : null}
    </View>
    <Text style={styles.section}>Usuarios registrados</Text>
    {users.map((user) => {
      const state = statusByUser[user.id_usuario] || {};
      const label = state.habilitado === false ? 'Perfil deshabilitado' : state.bloqueado_temporalmente ? 'Bloqueado por intentos fallidos' : 'Perfil habilitado';
      return <View style={styles.card} key={user.id_usuario}>
        <Text style={styles.cardTitle}>{user.nombre_usuario} {user.apellido}</Text>
        <Text>{user.correo_usuario}</Text><Text style={styles.muted}>{label}</Text>
        <TouchableOpacity style={styles.primary} onPress={() => startEdit(user)}><Text style={styles.primaryText}>Editar perfil</Text></TouchableOpacity>
        <TouchableOpacity onPress={() => changeStatus(user.id_usuario, state.habilitado === false)}><Text style={styles.link}>{state.habilitado === false ? 'Habilitar y desbloquear' : 'Deshabilitar perfil'}</Text></TouchableOpacity>
        <TouchableOpacity onPress={() => confirmRemove(user)}><Text style={styles.error}>Eliminar perfil</Text></TouchableOpacity>
      </View>;
    })}
    <TouchableOpacity onPress={() => go('dashboard')}><Text style={styles.link}>Volver al dashboard</Text></TouchableOpacity>
  </ScrollView>;
}
