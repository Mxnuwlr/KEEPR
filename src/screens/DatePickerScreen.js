/**
 * screens/DatePickerScreen.js — Datums-Picker Modal
 *
 * Leichtgewichtiger Modal-Screen für Datumsauswahl.
 * Wird mit route.params { currentDate, onSelect } aufgerufen.
 * onSelect(dateString) wird beim Bestätigen aufgerufen, dann goBack().
 *
 * Verwendet @react-native-community/datetimepicker (native iOS/Android Picker).
 */

// React/RN
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

// Third-party
import DateTimePicker from '@react-native-community/datetimepicker';

export default function DatePickerScreen({ route, navigation }) {
  const { currentDate, onSelect } = route.params;
  const [date, setDate] = useState(currentDate ? new Date(currentDate + 'T12:00:00') : new Date());

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.cancel}>Abbrechen</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Datum auswählen</Text>
        <TouchableOpacity onPress={() => {
          onSelect(date.toISOString().split('T')[0]);
          navigation.goBack();
        }}>
          <Text style={styles.done}>Fertig</Text>
        </TouchableOpacity>
      </View>
      <DateTimePicker
        value={date}
        mode="date"
        display="inline"
        minimumDate={new Date()}
        locale="de-DE"
        accentColor="#e8c547"
        style={{ backgroundColor: '#0a0a0a' }}
        onChange={(event, d) => { if (d) setDate(d); }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: 60, borderBottomWidth: 1, borderBottomColor: '#222' },
  title: { color: '#fff', fontSize: 16, fontWeight: '700' },
  cancel: { color: '#666', fontSize: 16 },
  done: { color: '#e8c547', fontSize: 16, fontWeight: '700' },
});
